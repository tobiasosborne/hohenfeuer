// tests/unit/ui-commands.test.js - owns the input-sample -> integer Command tests for src/player/commands.js.
import test from "node:test";
import assert from "node:assert/strict";
import { CMD, CMD_FIELDS, CAMERA_MODE, K, validateCommand } from "../../src/contracts.js";
import { TUNING } from "../../src/tuning.js";
import {
  ACTION, BUILD, buildCommands, quantizeYaw, dequantizeYaw, quantizePitch, dequantizePitch, quantizeAxis,
  aimAfter, dragUnits, emptySample,
} from "../../src/player/commands.js";

const A = TUNING.aim;
const TAU = 2 * Math.PI;
const AZ_TAP = A.azTapDeg * A.azUnitsPerDeg;
const AZ_CTRL = A.azCtrlDeg * A.azUnitsPerDeg;
const RANGE_TAP = A.rangeTapDial * A.rangeUnitsPerDial;
const RANGE_CTRL = A.rangeCtrlDial * A.rangeUnitsPerDial;

function sample(extra = {}) { return { ...emptySample(0), ...extra }; }
const ownWeapon = (dist, extra = {}) => ({ kind: "weapon", own: true, dist, weaponId: 7, crewOrdered: false, ...extra });
const ownBlock = (dist, extra = {}) => ({ kind: "block", own: true, dist, cell: [5, 3, 9], normal: [0, 0, 1], designated: false, ...extra });
const types = (cmds) => cmds.map((c) => c.type);

function allValid(cmds) {
  for (const c of cmds) assert.equal(validateCommand(c), true, JSON.stringify(c));
  cmds.forEach((c, i) => assert.equal(c.seq, i));
}

test("yaw quantisation round-trips every uint16 and errs <= half a unit on angles", () => {
  for (let u = 0; u < K.YAW_UNITS; u += 1) assert.equal(quantizeYaw(dequantizeYaw(u)), u);
  const halfUnit = TAU / K.YAW_UNITS / 2;
  for (let i = -2000; i <= 2000; i++) {
    const rad = i * 0.01237;
    const back = dequantizeYaw(quantizeYaw(rad));
    const d = Math.abs(((back - rad) % TAU + TAU + Math.PI) % TAU - Math.PI);
    assert.ok(d <= halfUnit + 1e-12, `yaw ${rad}`);
    const q = quantizeYaw(rad);
    assert.ok(Number.isInteger(q) && q >= 0 && q < K.YAW_UNITS);
  }
});

test("pitch quantisation round-trips and clamps to the pitch clamp", () => {
  const lim = Math.round(TUNING.ruler.pitchClampDeg / 90 * K.PITCH_LIMIT);
  for (let u = -lim; u <= lim; u += 7) assert.equal(quantizePitch(dequantizePitch(u)), u);
  assert.equal(quantizePitch(Math.PI), lim);
  assert.equal(quantizePitch(-Math.PI), -lim);
  assert.equal(quantizePitch(0.3), Math.round(0.3 / (Math.PI / 2) * K.PITCH_LIMIT));
});

test("move axes quantise to int8 and clamp", () => {
  assert.equal(quantizeAxis(1), K.MOVE_AXIS_MAX);
  assert.equal(quantizeAxis(-1), -K.MOVE_AXIS_MAX);
  assert.equal(quantizeAxis(5), K.MOVE_AXIS_MAX);
  assert.equal(quantizeAxis(0), 0);
  assert.equal(quantizeAxis(0.5), 64);
  for (let i = -127; i <= 127; i++) assert.equal(quantizeAxis(i / 127), i);
});

test("walk mode emits one MOVE per tick with integer fields", () => {
  const cmds = buildCommands(sample({ move: { fwd: 1, strafe: -0.5, sprint: true, jump: false }, look: { yaw: 1.0, pitch: -0.2 } }), 42);
  assert.deepEqual(types(cmds), [CMD.MOVE]);
  allValid(cmds);
  const m = cmds[0];
  assert.equal(m.tick, 42);
  assert.equal(m.slot, 0);
  assert.equal(m.fwd, 127);
  assert.equal(m.strafe, -64);
  assert.equal(m.sprint, 1);
  assert.equal(m.jump, 0);
  assert.equal(m.yaw, quantizeYaw(1.0));
  assert.equal(m.pitch, quantizePitch(-0.2));
  assert.deepEqual(Object.keys(m).sort(), ["type", "slot", "tick", "seq", ...Object.keys(CMD_FIELDS[CMD.MOVE])].sort());
});

test("aim taps: 0.5 deg / 0.2 dial per tap, Ctrl x10, az wraps, range clamps", () => {
  const w = { id: 3, az: 0, range: 380, autoFire: false };
  assert.deepEqual(aimAfter(w, { azTaps: 1, rangeTaps: 0, dragX: 0, dragY: 0 }, false), { az: AZ_TAP, range: 380 });
  assert.deepEqual(aimAfter(w, { azTaps: -1, rangeTaps: 2, dragX: 0, dragY: 0 }, false), { az: 3600 - AZ_TAP, range: 380 + 2 * RANGE_TAP });
  assert.deepEqual(aimAfter(w, { azTaps: 1, rangeTaps: -1, dragX: 0, dragY: 0 }, true), { az: AZ_CTRL, range: 380 - RANGE_CTRL });
  assert.equal(aimAfter({ ...w, range: 1 }, { azTaps: 0, rangeTaps: -5, dragX: 0, dragY: 0 }, false).range, 0);
  assert.equal(aimAfter({ ...w, range: 9998 }, { azTaps: 0, rangeTaps: 5, dragX: 0, dragY: 0 }, false).range, 9999);
  // drag: 0.1 deg/px right, 0.05 dial/px up (screen y negative)
  assert.deepEqual(aimAfter(w, { azTaps: 0, rangeTaps: 0, dragX: 10, dragY: -10 }, false),
    { az: Math.round(10 * A.azDragDegPerPx * A.azUnitsPerDeg), range: 380 + Math.round(10 * A.rangeDragDialPerPx * A.rangeUnitsPerDial) });
});

test("dragUnits truncates toward zero and returns the pixel remainder", () => {
  assert.deepEqual(dragUnits(3, 0.5), { units: 1, restPx: 1 });
  assert.deepEqual(dragUnits(-3, 0.5), { units: -1, restPx: -1 });
  assert.deepEqual(dragUnits(4, 0.5), { units: 2, restPx: 0 });
  assert.deepEqual(dragUnits(7, 1), { units: 7, restPx: 0 });
  let rest = 0, total = 0;
  for (let i = 0; i < 9; i++) { const r = dragUnits(rest + 1, 0.5); total += r.units; rest = r.restPx; }
  assert.equal(total, 4); assert.equal(rest, 1);
});

test("weapon view: AIM only on change, FIRE / RESTORE / AUTO_FIRE / LEAVE", () => {
  const weapon = { id: 3, az: 0, range: 380, autoFire: false };
  const base = { mode: CAMERA_MODE.WEAPON, weapon };
  assert.deepEqual(buildCommands(sample(base), 1), []);
  const cmds = buildCommands(sample({ ...base, aim: { azTaps: 2, rangeTaps: 1, dragX: 0, dragY: 0 },
    actions: [ACTION.FIRE, ACTION.RESTORE, ACTION.AUTO_FIRE, ACTION.LEAVE] }), 9);
  assert.deepEqual(types(cmds), [CMD.AIM, CMD.FIRE, CMD.RESTORE_AIM, CMD.AUTO_FIRE, CMD.LEAVE_WEAPON]);
  allValid(cmds);
  assert.equal(cmds[0].az, 2 * AZ_TAP);
  assert.equal(cmds[0].range, 380 + RANGE_TAP);
  assert.equal(cmds[3].on, 1);
  for (const c of cmds.slice(0, 4)) assert.equal(c.weaponId, 3);
  const off = buildCommands(sample({ ...base, weapon: { ...weapon, autoFire: true }, actions: [ACTION.AUTO_FIRE] }), 9);
  assert.equal(off[0].on, 0);
  // E also leaves; impact mode behaves like weapon mode
  assert.deepEqual(types(buildCommands(sample({ ...base, actions: [ACTION.INTERACT] }), 2)), [CMD.LEAVE_WEAPON]);
  assert.deepEqual(types(buildCommands(sample({ ...base, mode: CAMERA_MODE.IMPACT, actions: [ACTION.FIRE] }), 2)), [CMD.FIRE]);
  // Mannschaft button / Q in weapon view toggles the crew order for this weapon
  const crew = buildCommands(sample({ ...base, weapon: { ...weapon, crewOrdered: true }, actions: [ACTION.ORDER_CREW] }), 4);
  assert.deepEqual(types(crew), [CMD.ORDER_CREW]); assert.equal(crew[0].on, 0); assert.equal(crew[0].weaponId, 3);
  allValid(crew);
  // no MOVE while manning
  assert.ok(!types(buildCommands(sample({ ...base, move: { fwd: 1, strafe: 0, sprint: false, jump: false } }), 2)).includes(CMD.MOVE));
});

test("ruler orders (DESIGN 4.8): E man, Q crew, R repair/ammo, X shelter, with range gates", () => {
  const I = TUNING.ruler;
  const pick = (target, action, extra = {}) => buildCommands(sample({ target, actions: [action], ...extra }), 5).slice(1);
  assert.deepEqual(types(pick(ownWeapon(I.interactWeaponM), ACTION.INTERACT)), [CMD.ORDER_CREW, CMD.MAN_WEAPON]);
  assert.deepEqual(types(pick(ownWeapon(I.interactWeaponM + 0.01), ACTION.INTERACT)), []);
  assert.deepEqual(types(pick(ownWeapon(10, { own: false }), ACTION.INTERACT)), []);
  const q = pick(ownWeapon(I.interactOrderM), ACTION.ORDER_CREW);
  assert.deepEqual(types(q), [CMD.ORDER_CREW]); assert.equal(q[0].on, 1);
  assert.equal(pick(ownWeapon(5, { crewOrdered: true }), ACTION.ORDER_CREW)[0].on, 0);
  assert.deepEqual(types(pick(ownWeapon(I.interactOrderM + 1), ACTION.ORDER_CREW)), []);
  const r = pick(ownBlock(12), ACTION.PRIORITY);
  assert.deepEqual(types(r), [CMD.REPAIR_PRIORITY]); assert.deepEqual(r[0].cell, [5, 3, 9]);
  assert.deepEqual(types(pick(ownWeapon(12), ACTION.PRIORITY)), [CMD.AMMO_PRIORITY]);
  assert.deepEqual(types(pick(ownBlock(12, { own: false }), ACTION.PRIORITY)), []);
  const x = pick(null, ACTION.SHELTER, { shelterOn: true });
  assert.deepEqual(types(x), [CMD.SHELTER]); assert.equal(x[0].on, 0);
  for (const a of [ACTION.INTERACT, ACTION.ORDER_CREW, ACTION.PRIORITY, ACTION.SHELTER]) {
    allValid(buildCommands(sample({ target: ownWeapon(2), actions: [a] }), 5));
    allValid(buildCommands(sample({ target: ownBlock(2), actions: [a] }), 5));
  }
});

test("build mode: LMB designates a valid ghost, RMB cancels or demolishes; weapon placement", () => {
  const ghost = { cell: [5, 4, 9], valid: true, facing: 2 };
  const build = { mode: "block", block: 1, weapon: "cannon" };
  const d = buildCommands(sample({ build, ghost, target: ownBlock(4), actions: [ACTION.PRIMARY] }), 3).slice(1);
  assert.deepEqual(types(d), [CMD.DESIGNATE]);
  assert.deepEqual(d[0].cell, [5, 4, 9]); assert.equal(d[0].block, 1); assert.equal(d[0].facing, 2);
  assert.deepEqual(types(buildCommands(sample({ build, ghost: { ...ghost, valid: false }, actions: [ACTION.PRIMARY] }), 3).slice(1)), []);
  assert.deepEqual(types(buildCommands(sample({ build, target: ownBlock(4, { designated: true }), actions: [ACTION.SECONDARY] }), 3).slice(1)), [CMD.CANCEL]);
  assert.deepEqual(types(buildCommands(sample({ build, target: ownBlock(4), actions: [ACTION.SECONDARY] }), 3).slice(1)), [CMD.DEMOLISH]);
  assert.deepEqual(types(buildCommands(sample({ build, target: ownBlock(4, { own: false }), actions: [ACTION.SECONDARY] }), 3).slice(1)), []);
  const g = buildCommands(sample({ build: { ...build, mode: "weapon" }, ghost, actions: [ACTION.PRIMARY] }), 3).slice(1);
  assert.deepEqual(types(g), [CMD.DESIGNATE_WEAPON]); assert.equal(g[0].weapon, "cannon");
  // outside build mode LMB does nothing
  assert.deepEqual(types(buildCommands(sample({ ghost, actions: [ACTION.PRIMARY] }), 3).slice(1)), []);
  for (const s of [d, g]) allValid(buildCommands(sample({ build: { ...build, mode: s === g ? "weapon" : "block" }, ghost, actions: [ACTION.PRIMARY] }), 3));
});

test("fuzz: every emitted command validates, all fields are integers, seq is dense", () => {
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const modes = Object.values(CAMERA_MODE);
  const acts = Object.values(ACTION);
  for (let i = 0; i < 3000; i++) {
    const smp = sample({
      slot: Math.floor(rnd() * K.MAX_SLOTS),
      mode: modes[Math.floor(rnd() * modes.length)],
      move: { fwd: rnd() * 4 - 2, strafe: rnd() * 4 - 2, sprint: rnd() < 0.5, jump: rnd() < 0.5 },
      look: { yaw: rnd() * 40 - 20, pitch: rnd() * 6 - 3 },
      actions: acts.filter(() => rnd() < 0.3),
      ctrl: rnd() < 0.5,
      aim: { azTaps: Math.floor(rnd() * 9 - 4), rangeTaps: Math.floor(rnd() * 9 - 4), dragX: Math.floor(rnd() * 400 - 200), dragY: Math.floor(rnd() * 400 - 200) },
      weapon: rnd() < 0.7 ? { id: Math.floor(rnd() * 50), az: Math.floor(rnd() * 3600), range: Math.floor(rnd() * 10000), autoFire: rnd() < 0.5 } : null,
      target: rnd() < 0.5 ? ownBlock(rnd() * 30, { own: rnd() < 0.7, designated: rnd() < 0.3 }) : ownWeapon(rnd() * 30, { own: rnd() < 0.7 }),
      shelterOn: rnd() < 0.5,
      build: { mode: ["none", "block", "weapon"][Math.floor(rnd() * 3)], block: 1 + Math.floor(rnd() * 12), weapon: "cannon" },
      ghost: rnd() < 0.5 ? { cell: [Math.floor(rnd() * 48), 1 + Math.floor(rnd() * 23), Math.floor(rnd() * 48)], valid: rnd() < 0.7, facing: Math.floor(rnd() * 4) } : null,
    });
    const cmds = buildCommands(smp, i);
    allValid(cmds);
    for (const c of cmds) for (const [k, v] of Object.entries(c)) {
      if (k === "type" || k === "weapon") continue;
      if (Array.isArray(v)) assert.ok(v.every(Number.isInteger)); else assert.ok(Number.isInteger(v), `${c.type}.${k}=${v}`);
    }
  }
});

import { visibleFeatures, freshProfile } from '../../src/progression.js';

test('E orders crew automatically; locked orders and foreign build ids never produce commands', () => {
  const features = visibleFeatures(freshProfile());
  const man = buildCommands(sample({ features, target: ownWeapon(2), actions: [ACTION.INTERACT] }), 0);
  assert.deepEqual(types(man), [CMD.MOVE, CMD.ORDER_CREW, CMD.MAN_WEAPON]);
  assert.equal(man[1].on, 1); allValid(man);
  assert.deepEqual(types(buildCommands(sample({ features, target: ownWeapon(2), actions: [ACTION.SHELTER, ACTION.PRIORITY, ACTION.ORDER_CREW] }), 0)), [CMD.MOVE]);
  const weapon = { id: 3, az: 0, range: 380, autoFire: false };
  assert.deepEqual(buildCommands(sample({ features, mode: CAMERA_MODE.WEAPON, weapon, actions: [ACTION.AUTO_FIRE, ACTION.ORDER_CREW] }), 0), []);
  const ghost = { cell: [5,4,9], valid: true, facing: 0 };
  for (const build of [{ mode: BUILD.WEAPON, weapon: 'cannon' }, { mode: BUILD.BLOCK, block: 2 }]) {
    assert.deepEqual(types(buildCommands(sample({ features, build, ghost, actions: [ACTION.PRIMARY] }), 0)), [CMD.MOVE]);
  }
});

test('playable aim commands clamp charge to the labelled 1-255 range', () => {
  for (const [range, taps, expected] of [[10, -1, 10], [2550, 1, 2550], [0, 1, 10], [9999, -1, 2550]]) {
    const cmds = buildCommands(sample({ mode: CAMERA_MODE.WEAPON, weapon: { id: 1, az: 0, range }, aim: { azTaps: 0, rangeTaps: taps, dragX: 0, dragY: 0 } }), 0);
    assert.equal(cmds.find(c => c.type === CMD.AIM)?.range ?? range, expected);
  }
});

test('newcomer RMB cancels a plan but does not introduce demolition', () => {
  const features = visibleFeatures(freshProfile());
  const base = { features, build: { mode: BUILD.BLOCK, block: 1 }, target: ownBlock(3), actions: [ACTION.SECONDARY] };
  assert.deepEqual(types(buildCommands(sample(base), 0)), [CMD.MOVE]);
  assert.deepEqual(types(buildCommands(sample({ ...base, target: ownBlock(3, { designated: true }) }), 0)), [CMD.MOVE, CMD.CANCEL]);
});

test('a locked weapon in a custom map cannot bypass the input palette through E or firing', () => {
  const features = visibleFeatures(freshProfile());
  const cmds = buildCommands(sample({ features, target: ownWeapon(2, { defId: 'rocket' }), actions: [ACTION.INTERACT] }), 0);
  assert.deepEqual(types(cmds), [CMD.MOVE]);
  const manned = sample({ features, mode: CAMERA_MODE.WEAPON, weapon: { id: 2, defId: 'rocket', az: 0, range: 380 }, actions: [ACTION.FIRE, ACTION.INTERACT] });
  assert.deepEqual(types(buildCommands(manned, 0)), [CMD.LEAVE_WEAPON]);
});
