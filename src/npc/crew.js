// src/npc/crew.js - owns physical crew counts, firing eligibility and reload multipliers.
import { JOB, NPC_STATE } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { ownNpcs, ownWeapons, rulerOf, distanceSq, weaponDef, workSpeed } from './model.js';

/** NPC field excludes the ruler; the public result includes him and is capped at N. */
export function crewPresent(weapon, castle) {
  if (weapon.hp <= 0 || castle.eliminated) return 0;
  return Math.min(weaponDef(weapon).crewSlots, Math.max(0, weapon.crewPresent ?? 0) + (weapon.rulerManning ? 1 : 0));
}

/** Multiply base reload seconds by this value; normalized reload progress advances by dt/value. */
export function reloadMultiplier(weapon, castle) {
  const slots = weaponDef(weapon).crewSlots, present = crewPresent(weapon, castle);
  return slots / Math.max(1, present) * (T.weaponRules.reloadMoraleA - T.weaponRules.reloadMoraleB * (weapon.crewWorkSpeed ?? workSpeed(castle)));
}

/** Weapons must check this before paying gold or consuming ammunition. */
export function canFire(weapon, castle) {
  const def = weaponDef(weapon), minimum = Math.ceil(T.weaponRules.minCrewFrac * def.crewSlots);
  return !castle.eliminated && weapon.hp > 0 && weapon.ammo >= def.ammoLoads
    && (weapon.rulerManning || crewPresent(weapon, castle) >= minimum);
}

/** Called after kinematics (before weapons) and again after brain/work transitions. */
export function updateCrews(api, castle) {
  const ruler = rulerOf(api, castle), npcs = ownNpcs(api, castle);
  castle.npcRuler = ruler ? { id: ruler.id, hp: ruler.hp, pos: { ...ruler.pos }, manning: ruler.manning } : null;
  for (const weapon of ownWeapons(api, castle)) {
    const crew = npcs.filter(n => weapon.crewOrdered && n.hp > 0 && !n.deserting && !n.fleeing && n.state === NPC_STATE.WORK
      && n.target?.weaponId === weapon.id && castle.jobs?.some(j => j.id === n.jobId && j.kind === JOB.CREW)
      && distanceSq(n.pos, weapon.pos) <= T.npc.workReachM * T.npc.workReachM).slice(0, weaponDef(weapon).crewSlots);
    weapon.crewPresent = crew.length;
    weapon.rulerManning = Boolean(ruler?.hp > 0 && ruler.manning === weapon.id);
    const count = crew.length + (weapon.rulerManning ? 1 : 0);
    weapon.crewWorkSpeed = count ? (crew.reduce((speed, n) => speed + workSpeed(castle, n, ruler), 0)
      + (weapon.rulerManning ? workSpeed(castle) : 0)) / count : workSpeed(castle);
  }
}
