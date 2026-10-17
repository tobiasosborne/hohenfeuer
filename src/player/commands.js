// src/player/commands.js - owns the pure mapping from one per-tick input sample to integer Commands.
// Pure (DESIGN 9/10): no three, DOM, clock or randomness. Lane entry point `buildCommands(input, tick)`.

import { CMD, CAMERA_MODE, K } from "../contracts.js";
import { TUNING } from "../tuning.js";
import { PI, TAU } from "../core/fmath.js";

const A = TUNING.aim;
const R = TUNING.ruler;

/**
 * Edge-triggered player actions produced by src/player/input.js (DESIGN 4.8 and 5).
 * These are UI-side names only; the sim sees CMD values.
 */
export const ACTION = Object.freeze({
  INTERACT: "interact", // E: man / leave weapon
  ORDER_CREW: "order-crew", // Q
  PRIORITY: "priority", // R: repair (block) or ammo (weapon)
  BUILD_MODE: "build-mode", // B (local toggle, no command)
  PLACE_MODE: "place-mode", // G (local toggle, no command)
  SHELTER: "shelter", // X
  PRIMARY: "primary", // LMB
  SECONDARY: "secondary", // RMB click
  FIRE: "fire", // Space / fire button
  RESTORE: "restore", // Home
  AUTO_FIRE: "auto-fire", // F
  LEAVE: "leave", // Esc in weapon view
  PREV_WEAPON: "prev-weapon", // PgUp (local view switch)
  NEXT_WEAPON: "next-weapon", // PgDn (local view switch)
});

/** Build-mode kinds (local UI state carried in the sample). */
export const BUILD = Object.freeze({ NONE: "none", BLOCK: "block", WEAPON: "weapon" });

const AZ_TAP = A.azTapDeg * A.azUnitsPerDeg; // 5 units
const AZ_CTRL = A.azCtrlDeg * A.azUnitsPerDeg; // 50 units
const AZ_PER_PX = A.azDragDegPerPx * A.azUnitsPerDeg; // 1 unit/px
const RANGE_TAP = A.rangeTapDial * A.rangeUnitsPerDial; // 2 units
const RANGE_CTRL = A.rangeCtrlDial * A.rangeUnitsPerDial; // 20 units
const RANGE_PER_PX = A.rangeDragDialPerPx * A.rangeUnitsPerDial; // 0.5 unit/px
export const AIM_RATE = Object.freeze({ AZ_TAP, AZ_CTRL, AZ_PER_PX, RANGE_TAP, RANGE_CTRL, RANGE_PER_PX });
const AZ_UNITS = K.AZ_UNITS;
const RANGE_MAX = 9999; // CMD_FIELDS[CMD.AIM].range.max
const PITCH_MAX = Math.round(R.pitchClampDeg / 90 * K.PITCH_LIMIT);
const EPS = 1e-9;

/**
 * @typedef {object} InputSample  one tick of player intent (built by src/player/input.js)
 * @property {number} slot
 * @property {string} mode  CAMERA_MODE
 * @property {{fwd: number, strafe: number, sprint: boolean, jump: boolean}} move  axes in -1..1
 * @property {{yaw: number, pitch: number}} look  radians; yaw clockwise from north, pitch up positive
 * @property {string[]} actions  ACTION values pressed this tick
 * @property {boolean} ctrl
 * @property {{azTaps: number, rangeTaps: number, dragX: number, dragY: number}} aim  taps (signed), drag in px
 * @property {{id: number, az: number, range: number, autoFire: boolean, crewOrdered?: boolean}|null} weapon  weapon in view
 * @property {null|{kind: 'block'|'weapon'|'designation'|'none', own: boolean, dist: number,
 *   cell?: number[], weaponId?: number, crewOrdered?: boolean, designated?: boolean}} target  src/player/interact.js pick
 * @property {boolean} shelterOn
 * @property {{mode: string, block: number, weapon: string}} build  BUILD mode, block id, weapon def id
 * @property {null|{cell: number[], valid: boolean, facing: number}} ghost  src/player/interact.js ghost
 */

/** @param {number} slot @returns {InputSample} */
export function emptySample(slot = 0) {
  return {
    slot, mode: CAMERA_MODE.WALK,
    move: { fwd: 0, strafe: 0, sprint: false, jump: false },
    look: { yaw: 0, pitch: 0 },
    actions: [], ctrl: false,
    aim: { azTaps: 0, rangeTaps: 0, dragX: 0, dragY: 0 },
    weapon: null, target: null, shelterOn: false,
    build: { mode: BUILD.NONE, block: 1, weapon: "cannon" },
    ghost: null,
  };
}

const wrapInt = (v, n) => ((v % n) + n) % n;
/** Round half away from zero so +x and -x quantise symmetrically. */
const roundSym = (v) => (v < 0 ? -Math.round(-v) : Math.round(v));
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Radians (clockwise from north) -> uint16 yaw units. */
export function quantizeYaw(rad) { return wrapInt(Math.round(rad / TAU * K.YAW_UNITS), K.YAW_UNITS); }
/** uint16 yaw units -> radians in [0, 2pi). */
export function dequantizeYaw(u) { return u * TAU / K.YAW_UNITS; }
/** Radians (up positive) -> int pitch units, clamped to +-pitchClampDeg. */
export function quantizePitch(rad) { return clamp(roundSym(rad / (PI / 2) * K.PITCH_LIMIT), -PITCH_MAX, PITCH_MAX); }
/** Int pitch units -> radians. */
export function dequantizePitch(u) { return u * (PI / 2) / K.PITCH_LIMIT; }
/** Move axis -1..1 -> int8 -127..127. */
export function quantizeAxis(v) { return clamp(roundSym(v * K.MOVE_AXIS_MAX), -K.MOVE_AXIS_MAX, K.MOVE_AXIS_MAX); }

/**
 * Whole aim units in a pixel drag, truncated toward zero, plus the unconsumed pixels
 * (input.js carries `restPx` into the next tick so slow drags are not lost).
 * @param {number} px @param {number} unitsPerPx
 */
export function dragUnits(px, unitsPerPx) {
  const raw = px * unitsPerPx;
  const units = Math.trunc(raw + (raw >= 0 ? EPS : -EPS)) || 0;
  const restPx = px - units / unitsPerPx;
  return { units, restPx: Math.abs(restPx) < EPS ? 0 : restPx };
}

/**
 * Absolute aim after this tick's taps and drag (DESIGN 3.3): az wraps 0..3599, range clamps 0..9999.
 * @param {{az: number, range: number}} weapon @param {InputSample['aim']} aim @param {boolean} ctrl
 */
export function aimAfter(weapon, aim, ctrl) {
  const dAz = (aim.azTaps | 0) * (ctrl ? AZ_CTRL : AZ_TAP) + dragUnits(aim.dragX || 0, AZ_PER_PX).units;
  const dRange = (aim.rangeTaps | 0) * (ctrl ? RANGE_CTRL : RANGE_TAP) + dragUnits(-(aim.dragY || 0), RANGE_PER_PX).units;
  return { az: wrapInt(weapon.az + dAz, AZ_UNITS), range: clamp(weapon.range + dRange, 0, RANGE_MAX) };
}

const bit = (b) => (b ? 1 : 0);
const cell3 = (c) => [c[0] | 0, c[1] | 0, c[2] | 0];
const inPlot = (c) => Array.isArray(c) && c.length === 3 && c.every(Number.isInteger)
  && c[0] >= 0 && c[0] < K.PLOT_W && c[1] >= 0 && c[1] < K.PLOT_H && c[2] >= 0 && c[2] < K.PLOT_D;

function weaponModeCommands(s, push) {
  const w = s.weapon;
  const has = (a) => s.actions.includes(a);
  if (!w) { if (has(ACTION.LEAVE) || has(ACTION.INTERACT)) push(CMD.LEAVE_WEAPON, {}); return; }
  const next = aimAfter(w, s.aim, s.ctrl);
  if (next.az !== w.az || next.range !== w.range) push(CMD.AIM, { weaponId: w.id, az: next.az, range: next.range });
  if (has(ACTION.FIRE)) push(CMD.FIRE, { weaponId: w.id });
  if (has(ACTION.RESTORE)) push(CMD.RESTORE_AIM, { weaponId: w.id });
  if (has(ACTION.AUTO_FIRE)) push(CMD.AUTO_FIRE, { weaponId: w.id, on: bit(!w.autoFire) });
  if (has(ACTION.ORDER_CREW)) push(CMD.ORDER_CREW, { weaponId: w.id, on: bit(!w.crewOrdered) });
  if (has(ACTION.LEAVE) || has(ACTION.INTERACT)) push(CMD.LEAVE_WEAPON, {});
}

function walkModeCommands(s, push) {
  const has = (a) => s.actions.includes(a);
  push(CMD.MOVE, {
    fwd: quantizeAxis(s.move.fwd), strafe: quantizeAxis(s.move.strafe),
    yaw: quantizeYaw(s.look.yaw), pitch: quantizePitch(s.look.pitch),
    jump: bit(s.move.jump), sprint: bit(s.move.sprint),
  });
  const t = s.target;
  const own = t && t.own;
  const ownWeapon = own && t.kind === "weapon" && Number.isInteger(t.weaponId);
  const ownCell = own && (t.kind === "block" || t.kind === "designation") && inPlot(t.cell);
  if (has(ACTION.INTERACT) && ownWeapon && t.dist <= R.interactWeaponM) push(CMD.MAN_WEAPON, { weaponId: t.weaponId });
  if (has(ACTION.ORDER_CREW) && ownWeapon && t.dist <= R.interactOrderM) push(CMD.ORDER_CREW, { weaponId: t.weaponId, on: bit(!t.crewOrdered) });
  if (has(ACTION.PRIORITY) && own && t.dist <= R.interactOrderM) {
    if (ownWeapon) push(CMD.AMMO_PRIORITY, { weaponId: t.weaponId });
    else if (ownCell && t.kind === "block") push(CMD.REPAIR_PRIORITY, { cell: cell3(t.cell) });
  }
  if (has(ACTION.SHELTER)) push(CMD.SHELTER, { on: bit(!s.shelterOn) });
  const mode = s.build ? s.build.mode : BUILD.NONE;
  if (mode === BUILD.NONE) return;
  const g = s.ghost;
  if (has(ACTION.PRIMARY) && g && g.valid && inPlot(g.cell)) {
    const facing = (g.facing | 0) & 3;
    if (mode === BUILD.BLOCK) push(CMD.DESIGNATE, { cell: cell3(g.cell), block: s.build.block & 255, facing });
    else push(CMD.DESIGNATE_WEAPON, { weapon: s.build.weapon, cell: cell3(g.cell), facing });
  }
  if (has(ACTION.SECONDARY) && ownCell && t.dist <= R.interactOrderM) {
    if (t.designated || t.kind === "designation") push(CMD.CANCEL, { cell: cell3(t.cell) });
    else push(CMD.DEMOLISH, { cell: cell3(t.cell) });
  }
}

/**
 * Lane entry point (DESIGN 9): one input sample -> this tick's Commands, `seq` dense from 0.
 * WALK emits MOVE every tick plus orders (4.8); WEAPON and IMPACT emit aim/fire/crew (5);
 * DEATH and GHOST emit nothing.
 * @param {InputSample} input @param {number} tick @returns {object[]} Command[]
 */
export function buildCommands(input, tick) {
  const out = [];
  const slot = input.slot | 0;
  const push = (type, fields) => { out.push({ type, slot, tick, seq: out.length, ...fields }); };
  if (input.mode === CAMERA_MODE.WALK) walkModeCommands(input, push);
  else if (input.mode === CAMERA_MODE.WEAPON || input.mode === CAMERA_MODE.IMPACT) weaponModeCommands(input, push);
  return out;
}
