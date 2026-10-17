// tests/unit/ui-people.test.js - owns the procedural walk-cycle state of src/render/people-view.js (phase by distance, swing by speed).
import test from "node:test";
import assert from "node:assert/strict";
import { TUNING } from "../../src/tuning.js";
import { WALK, walkUpdate } from "../../src/render/people-view.js";

const TAU = 2 * Math.PI;

test("walk phase advances with distance walked (one stride per cycle), not with time", () => {
  const rec = {};
  let s = walkUpdate(rec, { pos: [0, 0, 0], prev: { x: 0, y: 0, z: 0 }, now: { x: 0, y: 0, z: 0 } });
  assert.equal(s.amp, 0);
  for (let i = 0; i < 5; i++) s = walkUpdate(rec, { pos: [0, 0, 0], prev: { x: 0, y: 0, z: 0 }, now: { x: 0, y: 0, z: 0 } });
  assert.equal(s.phase, 0, "standing still keeps the phase");
  s = walkUpdate(rec, { pos: [WALK.strideM / 4, 0, 0], prev: { x: 0, y: 0, z: 0 }, now: { x: 0.1, y: 0, z: 0 } });
  assert.ok(Math.abs(s.phase - TAU / 4) < 1e-9);
  s = walkUpdate(rec, { pos: [WALK.strideM, 0, 0], prev: { x: 0, y: 0, z: 0 }, now: { x: 0.1, y: 0, z: 0 } });
  assert.ok(Math.abs(s.phase) < 1e-9 || Math.abs(s.phase - TAU) < 1e-9, "full stride wraps");
});

test("swing grows with speed and is capped; vertical motion (ladders) does not swing the legs", () => {
  const sp = (v) => walkUpdate({}, { pos: [0, 0, 0], prev: { x: 0, y: 0, z: 0 }, now: { x: v / TUNING.sim.tickHz, y: 0, z: 0 } }).amp;
  assert.ok(sp(1) > 0 && sp(3) > sp(1));
  assert.ok(sp(50) <= WALK.maxSwingRad + 1e-12);
  assert.equal(walkUpdate({}, { pos: [0, 0, 0], prev: { x: 0, y: 0, z: 0 }, now: { x: 0, y: 0.1, z: 0 } }).amp, 0);
});
