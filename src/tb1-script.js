// src/tb1-script.js - owns the deterministic tracer-bullet-1 script (walk to the cannon, man, aim, fire) shared by goldens, tests and the demo.
// Pure: produces integer Commands for slot 0 from the sim's public state; no DOM, clock or randomness.
import { CMD, CONTROLLER, TACTIC, K, getMap } from "./contracts.js";
import { TUNING as T } from "./tuning.js";
import { atan2, sqrt, PI, TAU } from "./core/fmath.js";

/** Slice constants: map, seed, the enemy-facing cannon of slot 0 and the walking route (castle-local x/z). */
export const TB1 = Object.freeze({
  map: "forest-duel",
  seed: 1,
  playerSlot: 0,
  aiSlot: 1,
  /** default castle: weapons[1] faces east (FACING.E) toward slot 1. */
  cannonIndex: 1,
  /** Courtyard -> along z 27.5 -> south of the east stairs -> up the stairs (rising north) -> wall walkway -> cannon. */
  route: Object.freeze([[36, 27.5], [36, 35.4], [37.5, 35.4], [37.5, 28], [39.5, 28], [39.5, 24.8]]),
  arriveM: 0.25,
  waypointTimeoutTicks: 20 * K.TICK_HZ,
});

/** Slot table for TB1: slot 0 local human, slot 1 AI at the default level. */
export function tb1Slots(aiLevel = T.ai.defaultLevel) {
  return [
    { id: 0, castleId: "default", team: 0, color: 0xc02828, controller: CONTROLLER.LOCAL, aiLevel, aiTactic: TACTIC.GENERAL },
    { id: 1, castleId: "default", team: 1, color: 0x2860c0, controller: CONTROLLER.AI, aiLevel, aiTactic: TACTIC.GENERAL },
  ];
}

/** Yaw (radians, clockwise from north) -> uint16 command units. */
function yawUnits(rad) { const u = Math.round(rad / TAU * K.YAW_UNITS); return ((u % K.YAW_UNITS) + K.YAW_UNITS) % K.YAW_UNITS; }

/** Aim solution for a target point: az tenths of a degree, range dial tenths from flat distance (rules-tb1.test.js). */
export function solveAim(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  let azDeg = atan2(dx, -dz) * 180 / PI;
  if (azDeg < 0) azDeg += 360;
  const flat = sqrt(dx * dx + dz * dz);
  return { az: Math.round(azDeg * T.aim.azUnitsPerDeg) % 3600, range: Math.round(flat / T.aim.dialUnitM * T.aim.rangeUnitsPerDial), flat };
}

/** World centre of a castle's palace cells (feet of the centroid cell row). */
export function palaceCentre(castle) {
  const p = castle.plot, layer = p.width * p.depth;
  let x = 0, y = 0, z = 0;
  for (const i of castle.palaceCells) { const cy = Math.floor(i / layer), cz = Math.floor((i - cy * layer) / p.width); x += i % p.width; y += cy; z += cz; }
  const n = castle.palaceCells.length;
  return { x: p.origin.x + x / n + 0.5, y: p.origin.y + y / n + 0.5, z: p.origin.z + z / n + 0.5 };
}

/**
 * Create the TB1 script. Call `next(state)` once per tick with the sim's public state; it returns the
 * Commands for that tick (tick and seq filled). Phases: walk -> man -> aim -> fire -> watch.
 * @param {{slot?: number}} [o]
 */
export function createTb1Script({ slot = TB1.playerSlot } = {}) {
  let phase = "walk", wp = 0, wpTicks = 0, firedTick = null, aim = null, weaponId = null;
  const script = {
    get phase() { return phase; },
    get firedTick() { return firedTick; },
    get aim() { return aim; },
    get weaponId() { return weaponId; },
    /** @param {object} state sim.state snapshot @returns {object[]} */
    next(state) {
      const tick = state.tick;
      const castle = state.castles[slot], ruler = state.rulers.find((r) => r.slot === slot);
      const own = state.weapons.filter((w) => w.slot === slot);
      weaponId ??= own[TB1.cannonIndex].id;
      const cmd = (type, fields, seq = 0) => ({ type, slot, tick, seq, ...fields });
      if (phase === "walk") {
        const [lx, lz] = TB1.route[wp];
        const tx = castle.plot.origin.x + lx, tz = castle.plot.origin.z + lz;
        const dx = tx - ruler.pos.x, dz = tz - ruler.pos.z;
        if (dx * dx + dz * dz <= TB1.arriveM * TB1.arriveM) {
          wp++; wpTicks = 0;
          if (wp >= TB1.route.length) { phase = "man"; return [cmd(CMD.MOVE, { fwd: 0, strafe: 0, yaw: yawUnits(PI / 2), pitch: 0, jump: 0, sprint: 0 })]; }
          return script.next(state);
        }
        if (++wpTicks > TB1.waypointTimeoutTicks) throw new Error(`TB1 script stuck before waypoint ${wp} at tick ${tick} (ruler ${ruler.pos.x.toFixed(2)}, ${ruler.pos.y.toFixed(2)}, ${ruler.pos.z.toFixed(2)})`);
        return [cmd(CMD.MOVE, { fwd: K.MOVE_AXIS_MAX, strafe: 0, yaw: yawUnits(atan2(dx, -dz)), pitch: 0, jump: 0, sprint: 0 })];
      }
      if (phase === "man") {
        if (ruler.manning === weaponId) { phase = "aim"; return script.next(state); }
        return [cmd(CMD.MAN_WEAPON, { weaponId })];
      }
      if (phase === "aim") {
        const w = state.weapons.find((x) => x.id === weaponId);
        aim = solveAim(w.pos, palaceCentre(state.castles[1 - slot]));
        phase = "fire";
        return [cmd(CMD.AIM, { weaponId, az: aim.az, range: aim.range })];
      }
      if (phase === "fire") {
        const w = state.weapons.find((x) => x.id === weaponId);
        if (w.aim.az !== aim.az || w.aim.range !== aim.range) return [cmd(CMD.AIM, { weaponId, az: aim.az, range: aim.range })];
        if (w.reload + 1e-9 < getWeaponReload(state, w)) return [];
        phase = "watch"; firedTick = tick;
        return [cmd(CMD.FIRE, { weaponId })];
      }
      return [];
    },
  };
  return script;
}

function getWeaponReload(_state, w) { return T.weapons[w.defId].reloadS; }

/** True when slot 0's ball is in flight within `nearM` (x) of the enemy plot's near edge. */
export function ballNearEnemy(state, { slot = TB1.playerSlot, nearM = 25 } = {}) {
  const enemy = state.castles[1 - slot].plot;
  return state.projectiles.some((p) => p.sourceSlot === slot && p.pos.x >= enemy.origin.x - nearM);
}

/** Map def used by the slice (for callers that need sizes without a sim). */
export const tb1Map = () => getMap(TB1.map);
