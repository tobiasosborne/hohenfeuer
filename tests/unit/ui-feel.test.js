// tests/unit/ui-feel.test.js - owns the first-person feel tests (src/player/feel.js, camera.js feel/follow poses): tick-driven, seeded, deterministic.
import test from "node:test";
import assert from "node:assert/strict";
import { CAMERA_MODE } from "../../src/contracts.js";
import { TUNING } from "../../src/tuning.js";
import { FEEL, createFeel, recoilCurve, createFollow, shakeAmplitude } from "../../src/player/feel.js";
import { createCameraRig, followPose, weaponPose } from "../../src/player/camera.js";

const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const ruler = (o = {}) => ({ pos: { x: 0, y: 5, z: 0 }, vel: { x: 0, y: 0, z: 0 }, grounded: true, ...o });
function run(feel, n, r = ruler()) { const out = []; for (let i = 0; i < n; i++) { feel.step({ ruler: r }); out.push(feel.sample(1)); } return out; }

test("recoil: cannon kicks hard and settles fast, catapult throws slowly; both return to rest", () => {
  const hard = Array.from({ length: 40 }, (_, n) => recoilCurve(n, "hard"));
  const slow = Array.from({ length: 40 }, (_, n) => recoilCurve(n, "throw"));
  const peak = (xs) => xs.reduce((b, x, i) => (x.pitch > xs[b].pitch ? i : b), 0);
  assert.ok(peak(hard) <= 2, "cannon peaks within 2 ticks");
  assert.ok(peak(slow) >= 4, "catapult peaks later");
  assert.ok(hard[peak(hard)].pitch > slow[peak(slow)].pitch, "cannon kicks harder");
  assert.ok(hard[peak(hard)].back > 0);
  assert.ok(Math.abs(hard[39].pitch) < 1e-3 && Math.abs(slow[39].pitch) < 0.01, "settles");
  assert.ok(hard[4].pitch > 0.2 * hard[peak(hard)].pitch, "still visible 4 ticks after the shot");
});

test("feel: own shot adds recoil and an FOV punch; sampling interpolates between ticks", () => {
  const f = createFeel({ seed: 1 });
  run(f, 2);
  assert.deepEqual(f.sample(1), f.sample(0), "at rest");
  f.ownShot("hard");
  f.step({ ruler: ruler() });
  const s1 = f.sample(1), s0 = f.sample(0);
  assert.ok(s1.fov > 0 && near(s1.fov, FEEL.fovPunchDeg, 1e-9) || s1.fov > 0);
  assert.ok(s1.pitch > 0 && s1.back > 0);
  const mid = f.sample(0.5);
  assert.ok(near(mid.pitch, (s0.pitch + s1.pitch) / 2));
  const later = run(f, 60);
  assert.ok(Math.abs(later[59].pitch) < 1e-3 && Math.abs(later[59].fov) < 1e-3);
});

test("shake scales with blast radius and falls off with distance; seeded and deterministic", () => {
  assert.ok(shakeAmplitude(2.5, 10) > shakeAmplitude(1.25, 10));
  assert.ok(shakeAmplitude(2.5, 10) > shakeAmplitude(2.5, 60));
  assert.equal(shakeAmplitude(2.5, FEEL.shakeMaxM + 1), 0);
  assert.ok(shakeAmplitude(100, 0) <= FEEL.shakeMaxRad + 1e-12, "capped");
  const a = createFeel({ seed: 7 }), b = createFeel({ seed: 7 }), c = createFeel({ seed: 8 });
  for (const f of [a, b, c]) f.impact(2.5, 12);
  const ra = run(a, 20), rb = run(b, 20), rc = run(c, 20);
  assert.deepEqual(ra, rb);
  assert.notDeepEqual(ra, rc);
  assert.ok(ra.some((s) => Math.abs(s.yaw) > 0) && ra.some((s) => Math.abs(s.roll) > 0));
  assert.ok(Math.abs(run(a, 60)[59].yaw) < 1e-4, "dies out");
  const far = createFeel({ seed: 7 }); far.impact(2.5, 5000);
  assert.ok(run(far, 5).every((s) => s.yaw === 0));
});

test("head bob is tick-stepped by walking speed and off when disabled; landing dips after a fall", () => {
  const f = createFeel({ seed: 3, bob: true });
  const walking = ruler({ vel: { x: TUNING.ruler.walk, y: 0, z: 0 } });
  const s = run(f, 30, walking);
  assert.ok(s.some((x) => x.up > 0) && s.some((x) => x.up < 0));
  for (const x of s) assert.ok(Math.abs(x.up) <= TUNING.ruler.headBobM + 1e-12);
  const still = run(createFeel({ seed: 3, bob: true }), 30);
  assert.ok(still.every((x) => x.up === 0));
  const off = run(createFeel({ seed: 3, bob: false }), 30, walking);
  assert.ok(off.every((x) => x.up === 0));
  // fall then land
  const g = createFeel({ seed: 1 });
  g.step({ ruler: ruler({ grounded: false, vel: { x: 0, y: -9, z: 0 } }) });
  g.step({ ruler: ruler() });
  const dip = run(g, 12);
  assert.ok(Math.min(...dip.map((x) => x.up)) < -0.05, "dips");
  assert.ok(Math.abs(run(g, 30)[29].up) < 1e-3, "recovers");
  const soft = createFeel({ seed: 1 });
  soft.step({ ruler: ruler({ grounded: false, vel: { x: 0, y: -1, z: 0 } }) });
  soft.step({ ruler: ruler() });
  assert.ok(run(soft, 5).every((x) => x.up === 0), "a step down does not dip");
});

test("follow cam: rides the projectile, holds 1.5 s on the impact, then returns", () => {
  const fo = createFollow({ enabled: true });
  assert.equal(fo.active, false);
  fo.start(42);
  const proj = (x) => ({ projectiles: [{ id: 42, pos: { x, y: 10, z: 0 }, vel: { x: 70, y: 2, z: 0 } }] });
  fo.step(proj(0)); fo.step(proj(2));
  assert.equal(fo.active, true); assert.equal(fo.phase, "ride");
  assert.deepEqual(fo.target(0.5).pos, [1, 10, 0]);
  fo.impact([150, 3, 0]);
  fo.step({ projectiles: [] });
  assert.equal(fo.phase, "hold");
  for (let i = 0; i < FEEL.followHoldTicks - 1; i++) fo.step({ projectiles: [] });
  assert.equal(fo.active, true);
  fo.step({ projectiles: [] });
  assert.equal(fo.active, false, "returns after the hold");
  const off = createFollow({ enabled: false }); off.start(1); assert.equal(off.active, false);
  const lost = createFollow({ enabled: true }); lost.start(5); lost.step({ projectiles: [] }); lost.step({ projectiles: [] });
  assert.equal(lost.active, false, "a projectile that vanished without an impact ends the ride");
});

test("followPose sits behind and above the ball, looking along its flight", () => {
  const p = followPose({ pos: [100, 20, 0], vel: [50, 0, 0] });
  assert.ok(p.pos[0] < 100 && p.pos[1] > 20);
  assert.ok(near(p.yaw, Math.PI / 2, 1e-9), "east");
  const q = followPose({ pos: [0, 0, 0], vel: [0, -10, -30] });
  assert.ok(q.pos[2] > 0 && q.pitch < 0);
});

test("rig composes feel offsets onto the base pose (weapon view recoil pitches up and pulls back)", () => {
  const calls = [];
  const cam = { fov: 60, position: { set: (...a) => calls.push(["pos", ...a]) }, rotation: { set: (...a) => calls.push(["rot", ...a]) }, updateProjectionMatrix() {} };
  const rig = createCameraRig(cam, { seed: 1, golden: true });
  const weapon = { pivot: [0, 0, 0], azDeg: 90 };
  const base = rig.update({ mode: CAMERA_MODE.WEAPON, weapon, dt: 1 / 30 });
  const kicked = rig.update({ mode: CAMERA_MODE.WEAPON, weapon, dt: 1 / 30, feel: { back: 0.3, up: 0, pitch: 0.05, yaw: 0, roll: 0, fov: 4 } });
  assert.ok(kicked.pitch > base.pitch); assert.ok(kicked.pos[0] < base.pos[0], "pulled back against the east azimuth");
  assert.equal(kicked.fov, weaponPose(weapon).fov + 4);
  const fol = rig.update({ mode: CAMERA_MODE.IMPACT, follow: { pos: [1, 2, 3], yaw: 0, pitch: 0, roll: 0, fov: 60 }, dt: 1 / 30 });
  assert.deepEqual(fol.pos, [1, 2, 3]);
});
