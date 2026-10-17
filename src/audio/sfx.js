// src/audio/sfx.js - owns synthesised WebAudio one-shots keyed by EV event names (no sample files).
// IO. Each recipe is layered filtered noise and/or swept oscillators with an attack/decay envelope;
// noise comes from a seeded hash (no Math.random), so a recipe always sounds the same.

import { EV } from "../contracts.js";
import { hashNoise } from "../ui/paint.js";

/** Silent beyond this distance (m). */
export const EARSHOT_M = 600;
/** Max voices per event type per handle() call (blasts emit many block events). */
export const VOICES_PER_TYPE = 4;

/**
 * Layers: noise {dur, filter, freq, to?, q?, gain, attack?} or tone {wave, freq, to?, dur, gain, attack?}.
 * Frequencies in Hz, durations in s.
 */
export const RECIPES = Object.freeze({
  [EV.SHOT_FIRED]: { gain: 0.9, layers: [
    { noise: true, dur: 0.6, filter: "lowpass", freq: 1800, to: 300, gain: 1 },
    { wave: "sine", freq: 90, to: 38, dur: 0.45, gain: 0.9 }] },
  [EV.IMPACT]: { gain: 0.8, layers: [
    { noise: true, dur: 0.5, filter: "lowpass", freq: 900, to: 200, gain: 1 },
    { wave: "sine", freq: 60, to: 30, dur: 0.35, gain: 0.6 }] },
  [EV.BLOCK_DAMAGED]: { gain: 0.25, layers: [{ noise: true, dur: 0.12, filter: "bandpass", freq: 1400, q: 2, gain: 1 }] },
  [EV.BLOCK_DESTROYED]: { gain: 0.5, layers: [
    { noise: true, dur: 0.45, filter: "bandpass", freq: 700, to: 250, q: 1.2, gain: 1 }] },
  [EV.BLOCK_BUILT]: { gain: 0.3, layers: [{ wave: "triangle", freq: 420, to: 380, dur: 0.12, gain: 1 }, { noise: true, dur: 0.08, filter: "highpass", freq: 2500, gain: 0.4 }] },
  [EV.COLLAPSE]: { gain: 0.9, layers: [
    { noise: true, dur: 1.6, filter: "lowpass", freq: 500, to: 120, gain: 1, attack: 0.08 },
    { wave: "sine", freq: 45, to: 28, dur: 1.2, gain: 0.7 }] },
  [EV.MAGAZINE_EXPLODED]: { gain: 1, layers: [
    { noise: true, dur: 2.2, filter: "lowpass", freq: 2500, to: 90, gain: 1 },
    { wave: "sine", freq: 70, to: 22, dur: 1.4, gain: 1 }] },
  [EV.FIRE_IGNITED]: { gain: 0.35, layers: [{ noise: true, dur: 0.7, filter: "bandpass", freq: 3000, to: 1200, q: 0.8, gain: 1, attack: 0.1 }] },
  [EV.NPC_DIED]: { gain: 0.35, layers: [{ wave: "sawtooth", freq: 320, to: 140, dur: 0.35, gain: 0.6 }] },
  [EV.RULER_DIED]: { gain: 0.8, layers: [{ wave: "sawtooth", freq: 220, to: 55, dur: 1.6, gain: 0.7 }, { wave: "sine", freq: 110, to: 40, dur: 1.8, gain: 0.6 }] },
  [EV.WEAPON_LOADED]: { gain: 0.35, layers: [{ wave: "square", freq: 900, to: 600, dur: 0.06, gain: 0.5 }, { wave: "square", freq: 1200, to: 900, dur: 0.05, gain: 0.4, delay: 0.08 }] },
  [EV.WEAPON_DESTROYED]: { gain: 0.8, layers: [{ noise: true, dur: 0.9, filter: "lowpass", freq: 1500, to: 150, gain: 1 }, { wave: "square", freq: 200, to: 60, dur: 0.5, gain: 0.3 }] },
  [EV.WEAPON_PLACED]: { gain: 0.4, layers: [{ wave: "triangle", freq: 300, to: 450, dur: 0.2, gain: 1 }] },
  [EV.WIND_CHANGED]: { gain: 0.3, layers: [{ noise: true, dur: 1.4, filter: "bandpass", freq: 500, to: 1400, q: 3, gain: 1, attack: 0.5 }] },
  [EV.SHELTER_TOGGLED]: { gain: 0.4, layers: [{ wave: "triangle", freq: 660, dur: 0.15, gain: 1 }, { wave: "triangle", freq: 880, dur: 0.2, gain: 1, delay: 0.16 }] },
  [EV.CASTLE_ELIMINATED]: { gain: 0.7, layers: [{ wave: "triangle", freq: 392, dur: 0.3, gain: 1 }, { wave: "triangle", freq: 330, dur: 0.3, gain: 1, delay: 0.3 }, { wave: "triangle", freq: 262, dur: 0.6, gain: 1, delay: 0.6 }] },
  [EV.GAME_OVER]: { gain: 0.7, layers: [{ wave: "triangle", freq: 262, dur: 0.25, gain: 1 }, { wave: "triangle", freq: 330, dur: 0.25, gain: 1, delay: 0.25 }, { wave: "triangle", freq: 392, dur: 0.8, gain: 1, delay: 0.5 }] },
});

/** Seeded white noise in [-1, 1]. */
export function noiseSamples(n, seed) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = hashNoise(i, 0, seed) * 2 - 1;
  return out;
}

/** Gain factor for a source `d` metres from the listener. */
export function attenuation(d) { return d >= EARSHOT_M ? 0 : 1 / (1 + d / 40); }

/**
 * @param {{context?: object|null, volume?: number}} [o] context: an AudioContext, null to disable,
 *   undefined to create one lazily on unlock().
 */
export function createSfx(o = {}) {
  let ctx = o.context === undefined ? null : o.context;
  const lazy = o.context === undefined;
  let volume = o.volume ?? 0.6;
  let noiseBuf = null;

  function noise() {
    if (!noiseBuf) {
      const n = Math.floor(ctx.sampleRate * 2.5);
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      noiseBuf.getChannelData(0).set(noiseSamples(n, 7));
    }
    return noiseBuf;
  }

  function envelope(g, t0, peak, attack, dur) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  function layer(l, out, t) {
    const t0 = t + (l.delay || 0), attack = l.attack ?? 0.005;
    const g = ctx.createGain();
    envelope(g, t0, l.gain, attack, l.dur);
    g.connect(out);
    if (l.noise) {
      const src = ctx.createBufferSource();
      src.buffer = noise();
      const f = ctx.createBiquadFilter();
      f.type = l.filter; f.frequency.setValueAtTime(l.freq, t0);
      if (l.to) f.frequency.exponentialRampToValueAtTime(l.to, t0 + l.dur);
      if (l.q) f.Q.setValueAtTime(l.q, t0);
      src.connect(f); f.connect(g);
      src.start(t0); src.stop(t0 + l.dur + 0.05);
    } else {
      const osc = ctx.createOscillator();
      osc.type = l.wave; osc.frequency.setValueAtTime(l.freq, t0);
      if (l.to) osc.frequency.exponentialRampToValueAtTime(l.to, t0 + l.dur);
      osc.connect(g);
      osc.start(t0); osc.stop(t0 + l.dur + 0.05);
    }
  }

  const api = {
    /** Create/resume the AudioContext; call from a user gesture. */
    async unlock() {
      if (!ctx && lazy) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (AC) ctx = new AC();
      }
      if (ctx && ctx.state === "suspended" && ctx.resume) await ctx.resume();
    },
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); },
    /**
     * Play the recipe for an EV type. payload.pos and listener are world [x,y,z].
     * @returns {boolean} whether anything was scheduled
     */
    play(type, payload = {}, listener = null) {
      const r = RECIPES[type];
      if (!r || !ctx || volume <= 0) return false;
      let d = 0;
      if (payload && payload.pos && listener) {
        const dx = payload.pos[0] - listener[0], dy = payload.pos[1] - listener[1], dz = payload.pos[2] - listener[2];
        d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      const a = attenuation(d);
      if (a <= 0) return false;
      const master = ctx.createGain();
      master.gain.setValueAtTime(volume * r.gain * a, ctx.currentTime);
      master.connect(ctx.destination);
      for (const l of r.layers) layer(l, master, ctx.currentTime);
      return true;
    },
    /** Play a drained event batch, at most VOICES_PER_TYPE per type. @returns {number} voices started */
    handle(events, listener = null) {
      if (!ctx) return 0;
      const count = {};
      let n = 0;
      for (const e of events) {
        if ((count[e.type] || 0) >= VOICES_PER_TYPE) continue;
        if (api.play(e.type, e.payload, listener)) { count[e.type] = (count[e.type] || 0) + 1; n++; }
      }
      return n;
    },
  };
  return api;
}
