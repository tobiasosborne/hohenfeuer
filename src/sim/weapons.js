// src/sim/weapons.js - owns Phase 1 cannon aiming, reload progress and paid firing.
import { EV, K, RNG_STREAM } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { sin, cos, DEG } from '../core/fmath.js';
import { buildRangeTable, dialToElevation, elevationToDial, launchVelocity, traceFlight } from './ballistics.js';
import { spend } from './economy.js';
import { markWindShot } from './wind.js';
import { sampleHeight } from '../world/terrain.js';
const tables = new WeakMap();
/** Derived immutable data is kept outside serialized weapon state. */
export function weaponRangeTable(def) { if (!tables.has(def)) tables.set(def, buildRangeTable(def)); return tables.get(def); }
/** Create an initially loaded cannon; facing is N/E/S/W in quarter turns. */
export function createWeapon(def, { id, slot, pos, facing = 0 }) {
  const table = weaponRangeTable(def), dial = T.world.duelDistanceM / T.aim.dialUnitM;
  const aim = { az: Math.round(facing * 90 * T.aim.azUnitsPerDeg), range: Math.round(elevationToDial(table, dialToElevation(table, dial)) * T.aim.rangeUnitsPerDial) };
  return { id, slot, defId: def.id, pos: { ...pos }, hp: def.hp, aim, lastAim: { ...aim }, reload: def.reloadS, autoFire: false, fireRequested: false, crewOrdered: false, ammo: T.weaponRules.bufferLoads, lastImpact: null, predictedImpact: null };
}
function normal(rng, sigma) { return (rng() + rng() + rng() - 1.5) * 2 * sigma; }
/** Fire one cannon shot if loaded and affordable; Phase 1 intentionally has no crew gate. */
export function fireWeapon(ctx, weapon) {
  const def = ctx.getWeapon(weapon.defId), castle = ctx.castleOf(weapon.slot);
  if (!def || !castle || castle.eliminated || weapon.hp <= 0 || weapon.reload + 1e-9 < def.reloadS || !spend(castle, def.fireCost)) return false;
  const rng = ctx.rng(RNG_STREAM.SCATTER), az = weapon.aim.az / T.aim.azUnitsPerDeg + normal(rng, def.scatter.azDeg);
  const v0 = def.v0 * (1 + normal(rng, def.scatter.vFrac)), elevation = dialToElevation(weaponRangeTable(def), weapon.aim.range / T.aim.rangeUnitsPerDial);
  const vel = launchVelocity(v0, elevation, az);
  // Half-cell hull plus one projectile diameter, with muzzle at the hull centre height.
  const muzzleOffset = T.weaponRules.wallFootprint[0] / 2 + 2 * def.shot.radius;
  const pos = { x: weapon.pos.x + sin(az * DEG) * muzzleOffset, y: weapon.pos.y + T.weaponRules.wallFootprint[2] / 2, z: weapon.pos.z - cos(az * DEG) * muzzleOffset };
  const calmAz = weapon.aim.az / T.aim.azUnitsPerDeg;
  const calmMuzzle = { x: weapon.pos.x + sin(calmAz * DEG) * muzzleOffset, y: pos.y, z: weapon.pos.z - cos(calmAz * DEG) * muzzleOffset };
  const landingY = ctx.state.terrain ? sampleHeight(ctx.state.terrain, weapon.pos.x, weapon.pos.z) : weapon.pos.y;
  weapon.predictedImpact = traceFlight({ v0: def.v0, k: def.k, elevation, azimuth: calmAz, pos: calmMuzzle, landingY }).pos;
  weapon.reload = 0; weapon.lastAim = { ...weapon.aim };
  castle.stats ??= { shots: 0, ammoCosts: 0 };
  castle.stats.shots++; castle.stats.ammoCosts += def.fireCost;
  if (ctx.state.wind) markWindShot(ctx.state.wind, weapon.slot);
  const handled = def.onFire?.(ctx.api ?? ctx, weapon);
  if (!handled) ctx.spawnProjectile({ pos, vel, radius: def.shot.radius, k: def.k, payload: { ...def.shot }, sourceSlot: weapon.slot, weaponId: weapon.id });
  ctx.emit(EV.SHOT_FIRED, { slot: weapon.slot, weaponId: weapon.id, pos: [pos.x, pos.y, pos.z], vel: [vel.x, vel.y, vel.z] });
  return true;
}
/** Advance reloads and hooks in weapon id order before consuming fire requests. */
export function tickWeapons(ctx, dt = K.DT) {
  for (const weapon of ctx.state.weapons) {
    if (weapon.hp <= 0) continue;
    const def = ctx.getWeapon(weapon.defId), before = weapon.reload;
    weapon.reload = Math.min(def.reloadS, weapon.reload + dt);
    if (before < def.reloadS && weapon.reload + 1e-9 >= def.reloadS) { weapon.reload = def.reloadS; ctx.emit(EV.WEAPON_LOADED, { weaponId: weapon.id }); }
    if (weapon.fireRequested || weapon.autoFire) fireWeapon(ctx, weapon);
    weapon.fireRequested = false;
    def.onTick?.(ctx.api ?? ctx, weapon);
  }
}
