// src/player/feel.js - owns first-person feel offsets (recoil, FOV punch, impact shake, head bob, landing dip) and the projectile follow cam state.
// Pure and deterministic: everything advances once per sim tick (step) from sim state and sim events,
// noise is an integer hash of (seed, tick, axis), and render frames only interpolate between the last
// two tick samples (sample(alpha)). Numbers are proposals for TUNING.feel (orchestrator-owned file).

import { TUNING } from "../tuning.js";
import { K } from "../contracts.js";

const R = TUNING.ruler;

/** Feel constants (proposed TUNING.feel). Angles in radians, distances in metres, times in ticks. */
export const FEEL = Object.freeze({
  hard: Object.freeze({ pitch: 0.06, back: 0.35 }), // cannon-class (straight) recoil
  throw: Object.freeze({ pitch: 0.025, back: 0.1, riseTicks: 6 }), // catapult-class (lobbed) slow throw
  fovPunchDeg: 5, fovPunchTau: 4,
  shakePerM: 0.012, shakeFalloffM: 12, shakeMaxRad: 0.035, shakeMaxM: 120, shakeTau: 7, shakeMoveM: 0.04,
  bobMinSpeed: 0.3, bobRollRad: 0.004, bobRamp: 0.3,
  landMinSpeed: 4, landPerMs: 0.02, landMaxM: 0.3, landTau: 3,
  followHoldTicks: Math.round(1.5 * TUNING.sim.tickHz), followLostTicks: 2,
});

const ZERO = Object.freeze({ back: 0, up: 0, pitch: 0, yaw: 0, roll: 0, fov: 0 });

/** Recoil envelope n ticks after the shot: {pitch, back}. 'hard' kicks at once, 'throw' rises over riseTicks. */
export function recoilCurve(n, cls) {
  if (cls === "throw") {
    const c = FEEL.throw;
    const e = n < c.riseTicks ? Math.sin((Math.PI / 2) * (n / c.riseTicks)) : Math.exp(-(n - c.riseTicks) / 8) * Math.cos((n - c.riseTicks) * 0.15);
    return { pitch: c.pitch * e, back: c.back * e };
  }
  const e = Math.exp(-n / 5) * Math.cos(n * 0.18);
  return { pitch: FEEL.hard.pitch * e, back: FEEL.hard.back * Math.max(0, e) };
}

/** Peak shake angle for a blast of radius r metres at distance d metres from the camera. */
export function shakeAmplitude(r, d) {
  if (d > FEEL.shakeMaxM) return 0;
  return Math.min(FEEL.shakeMaxRad, FEEL.shakePerM * r / (1 + d / FEEL.shakeFalloffM));
}

/** Integer hash -> [-1, 1). */
function noise(seed, tick, axis) {
  let h = Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(tick | 0, 0x85ebca6b) ^ Math.imul(axis + 1, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

/**
 * @param {{seed?: number, bob?: boolean}} [o] bob: head bob on (off on the golden path, DESIGN 5)
 */
export function createFeel(o = {}) {
  const seed = (o.seed ?? 1) >>> 0;
  const bobOn = o.bob !== false;
  let tick = 0;
  let prev = { ...ZERO }, cur = { ...ZERO };
  const recoils = [], punches = [], shakes = [], dips = [];
  let bobPhase = (seed % 997) / 997, bobAmp = 0;
  let wasGrounded = true, lastVy = 0;
  const pending = { shots: [], impacts: [] };

  return {
    /** Own shot from the weapon view: recoil class 'hard' (straight weapons) or 'throw' (lobbed). */
    ownShot(cls) { pending.shots.push(cls); },
    /** Blast of radius r at distance d metres from the camera. */
    impact(r, d) { pending.impacts.push(shakeAmplitude(r, d)); },
    /** Advance one sim tick. @param {{ruler?: {vel: {x: number, y: number, z: number}, grounded: boolean}}} ctx */
    step(ctx) {
      tick++;
      for (const cls of pending.shots.splice(0)) { recoils.push({ cls, n: 0 }); punches.push({ n: 0 }); }
      for (const a of pending.impacts.splice(0)) if (a > 0) shakes.push({ a, n: 0 });
      const r = ctx.ruler;
      if (r) {
        const grounded = r.grounded !== false;
        if (grounded && !wasGrounded && -lastVy >= FEEL.landMinSpeed) dips.push({ a: Math.min(FEEL.landMaxM, FEEL.landPerMs * -lastVy), n: 0 });
        wasGrounded = grounded; lastVy = r.vel ? r.vel.y : 0;
        const speed = r.vel ? Math.hypot(r.vel.x, r.vel.z) : 0;
        const moving = grounded && speed > FEEL.bobMinSpeed && bobOn;
        bobAmp += ((moving ? 1 : 0) - bobAmp) * FEEL.bobRamp;
        if (bobAmp < 1e-4 && !moving) bobAmp = 0;
        if (moving) bobPhase = (bobPhase + R.headBobHz * K.DT * (speed / R.walk)) % 1;
      }
      const next = { ...ZERO };
      for (const rc of recoils) { const c = recoilCurve(rc.n, rc.cls); next.pitch += c.pitch; next.back += c.back; rc.n++; }
      for (const p of punches) { next.fov += FEEL.fovPunchDeg * Math.exp(-p.n / FEEL.fovPunchTau); p.n++; }
      let amp = 0;
      for (const s of shakes) { amp += s.a * Math.exp(-s.n / FEEL.shakeTau); s.n++; }
      if (amp > 0) {
        next.yaw += amp * noise(seed, tick, 0); next.pitch += amp * noise(seed, tick, 1); next.roll += 0.6 * amp * noise(seed, tick, 2);
        next.up += (amp / FEEL.shakeMaxRad) * FEEL.shakeMoveM * noise(seed, tick, 3);
      }
      for (const d of dips) { next.up -= d.a * (d.n < 2 ? (d.n + 1) / 2 : Math.exp(-(d.n - 1) / FEEL.landTau)); d.n++; }
      if (bobAmp > 0) {
        next.up += bobAmp * R.headBobM * Math.sin(2 * Math.PI * bobPhase);
        next.roll += bobAmp * FEEL.bobRollRad * Math.sin(Math.PI * 2 * bobPhase / 2);
      }
      const alive = (list, lim) => { for (let i = list.length - 1; i >= 0; i--) if (list[i].n > lim) list.splice(i, 1); };
      alive(recoils, 90); alive(punches, 40); alive(shakes, 70); alive(dips, 40);
      prev = cur; cur = next;
    },
    /** Offsets interpolated between the last two ticks: {back, up, pitch, yaw, roll, fov}. */
    sample(alpha = 1) {
      const out = {};
      for (const k of Object.keys(ZERO)) out[k] = prev[k] + (cur[k] - prev[k]) * alpha;
      return out;
    },
  };
}

/**
 * Projectile follow cam (the original's "Trefferansicht" after firing): ride the ball, hold on the
 * impact for 1.5 s, then hand back to the weapon view.
 * @param {{enabled?: boolean}} [o]
 */
export function createFollow(o = {}) {
  let enabled = o.enabled !== false;
  let phase = "off", id = null, prevPos = null, curPos = null, vel = null, impactPos = null, hold = 0, lost = 0;
  const off = () => { phase = "off"; id = null; prevPos = curPos = vel = impactPos = null; hold = 0; lost = 0; };
  return {
    get active() { return phase !== "off"; },
    get phase() { return phase; },
    get enabled() { return enabled; },
    setEnabled(v) { enabled = !!v; if (!enabled) off(); },
    /** Start riding projectile `projectileId` (call on the own SHOT_FIRED). */
    start(projectileId) { if (!enabled) return; off(); phase = "ride"; id = projectileId; },
    /** Impact of the ridden ball at world pos [x,y,z]. */
    impact(pos) { if (phase === "ride") impactPos = [pos[0], pos[1], pos[2]]; },
    /** Advance one sim tick with the sim state. */
    step(state) {
      if (phase === "ride") {
        const p = state.projectiles.find((x) => x.id === id);
        if (p) { prevPos = curPos ?? [p.pos.x, p.pos.y, p.pos.z]; curPos = [p.pos.x, p.pos.y, p.pos.z]; vel = [p.vel.x, p.vel.y, p.vel.z]; lost = 0; return; }
        if (impactPos) { phase = "hold"; hold = 1; return; }
        if (++lost >= FEEL.followLostTicks) off();
        return;
      }
      if (phase === "hold" && ++hold > FEEL.followHoldTicks) off();
    },
    /** What the camera should look at: {pos, vel} while riding, {impact} while holding, null otherwise. */
    target(alpha = 1) {
      if (phase === "ride" && curPos) return { pos: prevPos.map((v, i) => v + (curPos[i] - v) * alpha), vel };
      if (phase === "hold") return { impact: impactPos };
      return null;
    },
  };
}
