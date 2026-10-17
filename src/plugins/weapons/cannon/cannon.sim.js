// src/plugins/weapons/cannon/cannon.sim.js - owns the Phase 1 cannon definition.
import { MOUNT, TRAJ, registerWeapon } from '../../../contracts.js';
import { TUNING } from '../../../tuning.js';

const row = TUNING.weapons.cannon;

/** WeaponDef has no minCrew field; the Phase 2 crew gate derives this same value.
 * @type {number}
 */
export const CANNON_MIN_CREW = Math.ceil(row.crewSlots * TUNING.weaponRules.minCrewFrac);

/** The shared sim supplies default fire/impact behaviour and builds the range table.
 * @type {import('../../../contracts.js').WeaponDef}
 */
export const CANNON = Object.freeze({
  id: 'cannon', name: Object.freeze({ de: 'Kanone', en: 'Cannon' }),
  mount: MOUNT.WALL, footprint: TUNING.weaponRules.wallFootprint,
  cost: row.cost, hp: row.hp, reloadS: row.reloadS, crewSlots: row.crewSlots,
  fireCost: row.fireCost, ammoLoads: 1,
  traj: TRAJ.STRAIGHT, elevDeg: TUNING.aim.straightElevDeg, v0: row.v0, k: row.k,
  scatter: Object.freeze({ azDeg: row.sAzDeg, vFrac: row.sV }),
  shot: Object.freeze({
    count: row.count, intervalS: row.intervalS, spreadDeg: row.spreadDeg,
    radius: row.projRadius, direct: row.direct, splash: row.splash,
    splashRadius: row.splashRadius, ignite: row.ignite, pierce: row.pierce,
  }),
});

/** Register the cannon without freezing the shared registry. */
export function registerCannon() { registerWeapon(CANNON); }
