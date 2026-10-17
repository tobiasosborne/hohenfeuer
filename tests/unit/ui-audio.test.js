// tests/unit/ui-audio.test.js - owns the synthesised one-shot SFX tests for src/audio/sfx.js against a fake WebAudio context.
import test from "node:test";
import assert from "node:assert/strict";
import { EV } from "../../src/contracts.js";
import { RECIPES, createSfx, attenuation, noiseSamples } from "../../src/audio/sfx.js";

function fakeAudio() {
  const log = { started: 0, nodes: 0, resumed: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = (extra = {}) => { log.nodes++; return { connect() { return this; }, disconnect() {}, gain: param(), frequency: param(), Q: param(), pan: param(), detune: param(), type: "", ...extra }; };
  const ctx = {
    currentTime: 1, sampleRate: 48000, state: "suspended", destination: {},
    resume() { log.resumed++; this.state = "running"; return Promise.resolve(); },
    createGain: () => node(), createBiquadFilter: () => node(), createStereoPanner: () => node(),
    createOscillator: () => node({ start() { log.started++; }, stop() {} }),
    createBufferSource: () => node({ buffer: null, start() { log.started++; }, stop() {}, playbackRate: param() }),
    createBuffer: (ch, n, sr) => ({ length: n, sampleRate: sr, getChannelData: () => new Float32Array(n) }),
  };
  return { ctx, log };
}

test("every recipe is keyed by an EV value and the combat events all have one", () => {
  const evs = new Set(Object.values(EV));
  for (const k of Object.keys(RECIPES)) assert.ok(evs.has(k), k);
  for (const k of [EV.SHOT_FIRED, EV.IMPACT, EV.BLOCK_DESTROYED, EV.COLLAPSE, EV.MAGAZINE_EXPLODED, EV.WEAPON_LOADED,
    EV.WIND_CHANGED, EV.RULER_DIED, EV.GAME_OVER, EV.NPC_DIED, EV.WEAPON_DESTROYED, EV.BLOCK_BUILT]) assert.ok(RECIPES[k], k);
});

test("noise is deterministic and in [-1, 1]", () => {
  const a = noiseSamples(256, 3), b = noiseSamples(256, 3);
  assert.deepEqual(a, b);
  for (const v of a) assert.ok(v >= -1 && v <= 1);
});

test("distance attenuation: 1 at the listener, falls off, silent beyond the cutoff", () => {
  assert.equal(attenuation(0), 1);
  assert.ok(attenuation(50) < 1 && attenuation(50) > attenuation(200));
  assert.equal(attenuation(5000), 0);
});

test("play starts nodes for known events, ignores unknown ones, unlock resumes", async () => {
  const { ctx, log } = fakeAudio();
  const sfx = createSfx({ context: ctx });
  await sfx.unlock();
  assert.equal(log.resumed, 1);
  assert.equal(sfx.play(EV.SHOT_FIRED, { pos: [0, 0, 0] }, [10, 0, 0]), true);
  assert.ok(log.started > 0);
  assert.equal(sfx.play("not-an-event", {}), false);
  assert.equal(sfx.play(EV.IMPACT, { pos: [0, 0, 0] }, [0, 0, 9000]), false, "out of earshot");
  const before = log.started;
  const n = sfx.handle(Array.from({ length: 20 }, () => ({ type: EV.BLOCK_DESTROYED, payload: {} })));
  assert.ok(n <= 4 && n > 0, `voices capped per type (${n})`);
  assert.ok(log.started > before);
  sfx.setVolume(0);
  assert.equal(sfx.play(EV.SHOT_FIRED, {}), false);
});

test("createSfx without WebAudio is a silent no-op", () => {
  const sfx = createSfx({ context: null });
  assert.equal(sfx.play(EV.SHOT_FIRED, {}), false);
  assert.equal(sfx.handle([{ type: EV.IMPACT, payload: {} }]), 0);
});

import { panFor, ambienceLevels } from "../../src/audio/sfx.js";
import { TUNING } from "../../src/tuning.js";

test("panning: sources right of the listener's view pan right, left pan left, ahead centre", () => {
  const north = { pos: [0, 0, 0], yaw: 0 };
  assert.ok(Math.abs(panFor(north, [10, 0, 0]) - 1) < 1e-9);
  assert.ok(Math.abs(panFor(north, [-10, 0, 0]) + 1) < 1e-9);
  assert.ok(Math.abs(panFor(north, [0, 0, -10])) < 1e-9);
  const east = { pos: [0, 0, 0], yaw: Math.PI / 2 };
  assert.ok(Math.abs(panFor(east, [0, 0, 10]) - 1) < 1e-9, "south is right when facing east");
  assert.equal(panFor(north, [0, 0, 0]), 0);
  assert.equal(panFor(null, [5, 0, 0]), 0);
});

test("ambience: wind bed follows wind speed against the strongest setting, crowd follows population", () => {
  const max = Math.max(...TUNING.wind.maxSpeedByStrength);
  assert.equal(ambienceLevels({ windSpeed: 0, population: 0 }).wind, 0);
  assert.ok(ambienceLevels({ windSpeed: max, population: 0 }).wind <= 1);
  assert.ok(ambienceLevels({ windSpeed: max / 2, population: 0 }).wind < ambienceLevels({ windSpeed: max, population: 0 }).wind);
  assert.equal(ambienceLevels({ windSpeed: 0, population: 0 }).crowd, 0);
  assert.ok(ambienceLevels({ windSpeed: 0, population: 20 }).crowd < ambienceLevels({ windSpeed: 0, population: 60 }).crowd);
  assert.ok(ambienceLevels({ windSpeed: 0, population: 1000 }).crowd <= 1);
});

test("positional play uses a stereo panner; ambience loops start once; the morale bell rings", async () => {
  const { ctx, log } = fakeAudio();
  let panners = 0;
  ctx.createStereoPanner = () => { panners++; return { connect() { return this; }, pan: { value: 0, setValueAtTime() {} } }; };
  const sfx = createSfx({ context: ctx });
  assert.equal(sfx.play(EV.SHOT_FIRED, { pos: [10, 0, 0] }, { pos: [0, 0, 0], yaw: 0 }), true);
  assert.equal(panners, 1);
  const started = log.started;
  sfx.setAmbience({ windSpeed: 5, population: 40 });
  const afterFirst = log.started;
  assert.equal(afterFirst - started, 2, "wind and crowd loops");
  sfx.setAmbience({ windSpeed: 9, population: 10 });
  assert.equal(log.started, afterFirst, "loops are reused");
  assert.equal(sfx.bell(), true);
  assert.ok(log.started > afterFirst);
});
