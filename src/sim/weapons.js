// src/sim/weapons.js - owns weapon aiming, atomic paid salvos, scheduled bursts and reload progress.
import { EV, K, RNG_STREAM, getWeapon } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { sin, cos, DEG } from '../core/fmath.js';
import { buildRangeTable, rangeToCharge, launchSpeed, fixedElevation, scatterAngles, launchVelocity, traceFlight, createFlightProjectile, weaponAvailable } from './ballistics.js';
import { spend } from './economy.js';
import { markWindShot } from './wind.js';
import { sampleHeight } from '../world/terrain.js';
import { canFire, reloadMultiplier } from '../npc/index.js';
import { tickFire } from './damage.js';
const tables = new WeakMap();
/** Derived immutable data is kept outside serialized weapon state. */
export function weaponRangeTable(def) { if (!tables.has(def)) tables.set(def, buildRangeTable(def)); return tables.get(def); }
/** Create an initially loaded cannon; facing is N/E/S/W in quarter turns. */
export function createWeapon(def, { id, slot, pos, facing = 0 }) {
  const table = weaponRangeTable(def), dial = rangeToCharge(table, T.world.duelDistanceM);
  const aim = { az: Math.round(facing * 90 * T.aim.azUnitsPerDeg), range: Math.round(dial * T.aim.rangeUnitsPerDial) };
  return { id, slot, defId: def.id, pos: { ...pos }, hp: def.hp, aim, lastAim: { ...aim }, reload: def.reloadS, autoFire: false, fireRequested: false, crewOrdered: false, ammo: T.weaponRules.bufferLoads, lastImpact: null, predictedImpact: null };
}
/** Fire one whole salvo atomically. Aim/scatter and due ticks are captured at payment,
 * so later AIM commands cannot steer a burst and saving mid-burst loses no rounds. */
export function fireWeapon(ctx, weapon) {
  const def = (ctx.getWeapon ?? getWeapon)(weapon.defId), castle = ctx.castleOf(weapon.slot);
  if (!weaponAvailable(def) || !castle || castle.eliminated || weapon.hp <= 0 || weapon.burst
    || weapon.reload + 1e-9 < def.reloadS || !canFire(weapon, castle) || !spend(castle, def.fireCost)) return false;
  weapon.ammo -= def.ammoLoads;
  const rng = ctx.rng(RNG_STREAM.SCATTER), charge = weapon.aim.range / T.aim.rangeUnitsPerDial;
  const muzzleOffset = T.weaponRules.wallFootprint[0] / 2 + 2 * def.shot.radius;
  const calmAz = weapon.aim.az / T.aim.azUnitsPerDeg;
  const calmMuzzle = { x: weapon.pos.x + sin(calmAz * DEG) * muzzleOffset,
    y: weapon.pos.y + T.weaponRules.wallFootprint[2] / 2, z: weapon.pos.z - cos(calmAz * DEG) * muzzleOffset };
  const landingY = ctx.state.terrain ? sampleHeight(ctx.state.terrain, weapon.pos.x, weapon.pos.z) : weapon.pos.y;
  weapon.predictedImpact = traceFlight({ ...def, v0: launchSpeed(def, charge), charge: undefined,
    ...(T.weapons[def.id]?.propulsion ? { charge } : {}),
    elevation: fixedElevation(def), azimuth: calmAz, pos: calmMuzzle, landingY }).pos;
  weapon.reload = 0; weapon.lastAim = { ...weapon.aim };
  castle.stats ??= { shots: 0, ammoCosts: 0 };
  castle.stats.shots++; castle.stats.ammoCosts += def.fireCost;
  if (ctx.state.wind) markWindShot(ctx.state.wind, weapon.slot);
  if (def.onFire?.(ctx.api ?? ctx, weapon)) {
    ctx.emit(EV.SHOT_FIRED, { slot: weapon.slot, weaponId: weapon.id,
      pos: [calmMuzzle.x, calmMuzzle.y, calmMuzzle.z],
      vel: Object.values(launchVelocity(launchSpeed(def, charge), fixedElevation(def), calmAz)) });
    return true;
  }
  const rounds = [];
  for (let index = 0; index < def.shot.count; index++) {
    const scatter = scatterAngles(def, calmAz, rng);
    // spreadDeg is the total fan angle; scatter is drawn independently for each round.
    const az = scatter.azimuth + (def.shot.count > 1 ? (index / (def.shot.count - 1) - 0.5) * def.shot.spreadDeg : 0);
    const pos = { x: weapon.pos.x + sin(az * DEG) * muzzleOffset, y: calmMuzzle.y, z: weapon.pos.z - cos(az * DEG) * muzzleOffset };
    const projectile = createFlightProjectile(def, { charge, elevation: scatter.elevation, azimuth: az, pos, payload: def.shot });
    const round = { dueTick: (ctx.state.tick ?? 0) + Math.ceil(index * def.shot.intervalS / K.DT - 1e-9), projectile };
    if (round.dueTick <= (ctx.state.tick ?? 0)) spawnRound(ctx, weapon, round); else rounds.push(round);
  }
  if (rounds.length) weapon.burst = { rounds };
  return true;
}
function spawnRound(ctx, weapon, { projectile }) {
  ctx.spawnProjectile({ ...projectile, radius: getWeapon(weapon.defId)?.shot.radius ?? projectile.payload.radius,
    sourceSlot: weapon.slot, weaponId: weapon.id });
  const { pos, vel } = projectile;
  ctx.emit(EV.SHOT_FIRED, { slot: weapon.slot, weaponId: weapon.id, pos: [pos.x, pos.y, pos.z], vel: [vel.x, vel.y, vel.z] });
}
/** Advance reloads and hooks in weapon id order before consuming fire requests. */
export function tickWeapons(ctx, dt = K.DT) {
  tickFire(ctx, dt);
  for (const weapon of ctx.state.weapons) {
    if (weapon.hp <= 0 || ctx.castleOf(weapon.slot)?.eliminated) { delete weapon.burst; continue; }
    const def = (ctx.getWeapon ?? getWeapon)(weapon.defId), before = weapon.reload;
    if (weapon.burst) {
      const remaining = [];
      for (const round of weapon.burst.rounds) {
        if (round.dueTick <= (ctx.state.tick ?? 0)) spawnRound(ctx, weapon, round); else remaining.push(round);
      }
      if (remaining.length) weapon.burst.rounds = remaining; else delete weapon.burst;
    }
    weapon.reload = Math.min(def.reloadS, weapon.reload + dt / reloadMultiplier(weapon, ctx.castleOf(weapon.slot)));
    if (before < def.reloadS && weapon.reload + 1e-9 >= def.reloadS) { weapon.reload = def.reloadS; ctx.emit(EV.WEAPON_LOADED, { weaponId: weapon.id }); }
    if (weapon.fireRequested || weapon.autoFire) fireWeapon(ctx, weapon);
    weapon.fireRequested = false;
    def.onTick?.(ctx.api ?? ctx, weapon);
  }
}
