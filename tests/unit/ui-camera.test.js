// tests/unit/ui-camera.test.js - owns camera pose math and mode switching tests for src/player/camera.js (no three needed).
import test from "node:test";
import assert from "node:assert/strict";
import { CAMERA_MODE } from "../../src/contracts.js";
import { TUNING } from "../../src/tuning.js";
import { createHeadBob, walkPose, weaponPose, impactPose, deathPose, ghostPose, applyPose, createCameraRig } from "../../src/player/camera.js";

const R = TUNING.ruler;
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const nearV = (a, b, e = 1e-9) => a.every((v, i) => near(v, b[i], e));
const DEG = Math.PI / 180;

function fakeCamera() {
  const calls = [];
  return {
    calls, fov: 75, near: 0.1, far: 500,
    position: { set(x, y, z) { calls.push(["pos", x, y, z]); } },
    rotation: { set(x, y, z, o) { calls.push(["rot", x, y, z, o]); } },
    updateProjectionMatrix() { calls.push(["proj"]); },
  };
}

test("head bob: seeded, stepped, amplitude and frequency per DESIGN 5, off when disabled", () => {
  const a = createHeadBob(1), b = createHeadBob(1), c = createHeadBob(2);
  const seqA = [], seqB = [], seqC = [];
  for (let i = 0; i < 60; i++) { a.step(true, 1 / 30); b.step(true, 1 / 30); c.step(true, 1 / 30); seqA.push(a.offset()); seqB.push(b.offset()); seqC.push(c.offset()); }
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
  for (const o of seqA) assert.ok(Math.abs(o) <= R.headBobM + 1e-12);
  const p0 = a.phase; for (let i = 0; i < 15; i++) a.step(true, 1 / 30);
  const cyc = (x) => { const f = ((x % 1) + 1) % 1; return Math.min(f, 1 - f); };
  assert.ok(cyc(a.phase - p0 - R.headBobHz * 0.5) < 1e-9);
  const p1 = a.phase; a.step(false, 1 / 30); assert.equal(a.phase, p1);
  const off = createHeadBob(1, { enabled: false }); off.step(true, 0.1); assert.equal(off.offset(), 0);
});

test("walk pose: eye height above the feet, FOV 60", () => {
  const p = walkPose({ pos: [3, 10, -4], yaw: 1, pitch: 0.2 }, 0.01);
  assert.ok(nearV(p.pos, [3, 10 + R.eye + 0.01, -4]));
  assert.equal(p.yaw, 1); assert.equal(p.pitch, 0.2); assert.equal(p.roll, 0); assert.equal(p.fov, R.fovDeg);
});

test("weapon pose: 1.2 m behind and 0.6 m above the yaw pivot along the azimuth, FOV 50", () => {
  const e = weaponPose({ pivot: [0, 0, 0], azDeg: 90 });
  assert.ok(nearV(e.pos, [-R.sightBackM, R.sightUpM, 0], 1e-9));
  assert.ok(near(e.yaw, 90 * DEG)); assert.equal(e.fov, R.weaponFovDeg);
  const n = weaponPose({ pivot: [10, 5, 10], azDeg: 0 }, { yaw: 0.1, pitch: -0.2 });
  assert.ok(nearV(n.pos, [10, 5 + R.sightUpM, 10 + R.sightBackM]));
  assert.ok(near(n.yaw, 0.1)); assert.ok(near(n.pitch, -0.2 + weaponPose({ pivot: [0, 0, 0], azDeg: 0 }).pitch));
  const s = weaponPose({ pivot: [0, 0, 0], azDeg: 0, sight: [1, 2, 3] });
  assert.ok(nearV(s.pos, [1, 2, 3]));
});

test("impact pose: 30 m behind, 20 m above the impact on the azimuth, looking at it", () => {
  const p = impactPose({ point: [0, 0, 0], azDeg: 0 });
  assert.ok(nearV(p.pos, [0, R.impactUpM, R.impactBackM]));
  assert.ok(near(p.pitch, -Math.atan2(R.impactUpM, R.impactBackM)));
  assert.equal(p.yaw, 0);
});

test("death pose: drops to 0.3 m and rolls 70 deg over 3 s", () => {
  const start = walkPose({ pos: [0, 5, 0], yaw: 0.5, pitch: 0.1 }, 0);
  const d0 = deathPose(start, 5, 0);
  assert.ok(nearV(d0.pos, start.pos)); assert.equal(d0.roll, 0);
  const d3 = deathPose(start, 5, R.deathCamS);
  assert.ok(near(d3.pos[1], 5 + R.deathCamY)); assert.ok(near(d3.roll, R.deathRollDeg * DEG));
  const d9 = deathPose(start, 5, 9); assert.deepEqual(d9, d3);
  const dh = deathPose(start, 5, R.deathCamS / 2); assert.ok(dh.pos[1] < start.pos[1] && dh.pos[1] > 5 + R.deathCamY);
});

test("ghost pose passes through position and look", () => {
  const g = ghostPose({ pos: [1, 40, 2], yaw: 2, pitch: -0.5 });
  assert.deepEqual(g.pos, [1, 40, 2]); assert.equal(g.yaw, 2); assert.equal(g.pitch, -0.5); assert.equal(g.fov, R.fovDeg);
});

test("applyPose maps clockwise yaw to three's YXZ euler and updates FOV once", () => {
  const cam = fakeCamera();
  applyPose(cam, { pos: [1, 2, 3], yaw: 0.5, pitch: 0.25, roll: 0.1, fov: 60 });
  assert.deepEqual(cam.calls[0], ["pos", 1, 2, 3]);
  assert.deepEqual(cam.calls[1], ["rot", 0.25, -0.5, 0.1, "YXZ"]);
  assert.deepEqual(cam.calls[2], ["proj"]);
  assert.equal(cam.fov, 60);
  cam.calls.length = 0;
  applyPose(cam, { pos: [1, 2, 3], yaw: 0.5, pitch: 0.25, roll: 0.1, fov: 60 });
  assert.equal(cam.calls.filter((c) => c[0] === "proj").length, 0);
});

test("rig switches modes via CAMERA_MODE and runs the death clock in ticks", () => {
  const cam = fakeCamera();
  const rig = createCameraRig(cam, { seed: 1, golden: true });
  const ruler = { pos: [0, 5, 0], yaw: 0, pitch: 0 };
  rig.update({ mode: CAMERA_MODE.WALK, ruler, dt: 1 / 30 });
  assert.equal(rig.mode, CAMERA_MODE.WALK);
  assert.ok(near(rig.pose.pos[1], 5 + R.eye));
  rig.update({ mode: CAMERA_MODE.WEAPON, weapon: { pivot: [0, 5, 0], azDeg: 180 }, dt: 1 / 30 });
  assert.equal(rig.mode, CAMERA_MODE.WEAPON); assert.equal(rig.pose.fov, R.weaponFovDeg);
  rig.update({ mode: CAMERA_MODE.IMPACT, impact: { point: [0, 0, -100], azDeg: 0 }, dt: 1 / 30 });
  assert.ok(near(rig.pose.pos[2], -100 + R.impactBackM));
  rig.update({ mode: CAMERA_MODE.WALK, ruler, dt: 1 / 30 });
  for (let i = 0; i < 90; i++) rig.update({ mode: CAMERA_MODE.DEATH, ruler, groundY: 5, dt: 1 / 30 });
  assert.ok(near(rig.pose.roll, R.deathRollDeg * DEG, 1e-9));
  rig.update({ mode: CAMERA_MODE.GHOST, ghost: { pos: [0, 50, 0], yaw: 0, pitch: -1 }, dt: 1 / 30 });
  assert.equal(rig.mode, CAMERA_MODE.GHOST); assert.deepEqual(rig.pose.pos, [0, 50, 0]);
  assert.throws(() => rig.update({ mode: "orbit", dt: 1 / 30 }), /camera mode/);
});
