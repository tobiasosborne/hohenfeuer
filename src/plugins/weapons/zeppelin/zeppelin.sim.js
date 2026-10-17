// src/plugins/weapons/zeppelin/zeppelin.sim.js - owns the unavailable map-only zeppelin placeholder.
import { registerWeapon } from '../../../contracts.js';
import { unavailableWeapon } from '../../../sim/ballistics.js';
import { weaponDef } from '../weapon-def.js';
// WeaponDef has no air mount/mapOnly/availability fields. The sentinel hook reserves
// the id without charging ammo/gold or making a buildable/firing artillery weapon.
export const AVAILABILITY = Object.freeze({ mapOnly: true, available: false });
export const ZEPPELIN = weaponDef('zeppelin', { de: 'Zeppelin', en: 'Zeppelin' }, {
  mount: 'ground', cost: 700, hp: 12, reloadS: 1, crewSlots: 1, fireCost: 0,
  traj: 'lobbed', v0: 1, k: 0, sAzDeg: 0, sV: 0, count: 1,
  intervalS: 0, spreadDeg: 0, projRadius: 0.15, direct: 0, splash: 0, splashRadius: 0, ignite: 0, pierce: 0,
}, { onFire: unavailableWeapon });
export function registerZeppelin() { registerWeapon(ZEPPELIN); }
