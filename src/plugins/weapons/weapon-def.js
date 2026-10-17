// src/plugins/weapons/weapon-def.js - owns the shared contract projection of weapon tuning rows.
import { MOUNT } from '../../contracts.js';
import { TUNING as T } from '../../tuning.js';

/** Fixed pitch, native K and control metadata stay in the row: WeaponDef's legacy
 * elevation band cannot express a fixed 36.73828125-degree lobbed launch. */
export function weaponDef(id, name, row, hooks = {}) {
  return Object.freeze({
    id, name: Object.freeze(name), mount: row.mount,
    footprint: row.mount === MOUNT.WALL ? T.weaponRules.wallFootprint : T.weaponRules.groundFootprint,
    cost: row.cost, hp: row.hp, reloadS: row.reloadS, crewSlots: row.crewSlots,
    fireCost: row.fireCost, ammoLoads: 1, traj: row.traj,
    elevDeg: row.traj === 'lobbed' ? T.aim.lobbedElevDeg : T.aim.straightElevDeg,
    v0: row.v0, k: row.k,
    scatter: Object.freeze({ azDeg: row.sAzDeg, vFrac: row.sV }),
    shot: Object.freeze({ count: row.count, intervalS: row.intervalS, spreadDeg: row.spreadDeg,
      radius: row.projRadius, direct: row.direct, splash: row.splash,
      splashRadius: row.splashRadius, ignite: row.ignite, pierce: row.pierce }),
    ...hooks,
  });
}
