// src/npc/designations.js - owns read-only build-site support, occupancy and designation eligibility.
import { BLOCK, CMD, META, getWeapon, getMap } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { indexOf, typeAt, blockDef, vector } from './model.js';

const axes = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
export function supportedCell(plot, cell) {
  return cell[1] === T.world.buildMinY || axes.some(d => blockDef(typeAt(plot, cell.map((v, k) => v + d[k])))?.solid);
}

/** Full body overlap, including a head or capsule edge entering an adjacent cell. */
export function personOverlapsCell(plot, cell, person) {
  if (person.hp <= 0 || person.deserted) return false;
  const o = vector(plot.origin ?? [0, 0, 0]), p = vector(person.pos);
  const r = person.radius ?? T.people.npcRadius, h = person.height ?? T.people.height;
  const x = o.x + cell[0], y = o.y + cell[1], z = o.z + cell[2];
  return p.x + r > x && p.x - r < x + 1 && p.z + r > z && p.z - r < z + 1 && p.y + h > y && p.y < y + 1;
}
export function cellHasPerson(plot, cell, state = {}) {
  return (state.npcs ?? []).some(n => personOverlapsCell(plot, cell, n))
    || (state.rulers ?? []).some(n => personOverlapsCell(plot, cell, { radius: T.people.rulerRadius, ...n }));
}
export function cellHasWeapon(plot, cell, weapons = []) {
  const o = vector(plot.origin ?? [0, 0, 0]);
  return weapons.some(w => {
    if (w.hp <= 0) return false;
    const p = w.pos ? vector(w.pos) : null, at = w.at ?? w.cell;
    return at ? at.every((n, i) => n === cell[i]) : p && Math.floor(p.x - o.x) === cell[0]
      && Math.floor(p.y - o.y) === cell[1] && Math.floor(p.z - o.z) === cell[2];
  });
}
/** Used again during work: destruction and arriving people can invalidate a previously legal site. */
export function buildSiteReady(castle, cell, state = {}, weapon = null) {
  const p = castle.plot;
  return typeAt(p, cell) === BLOCK.AIR && !cellHasPerson(p, cell, state) && !cellHasWeapon(p, cell, state.weapons)
    && (weapon ? typeAt(p, [cell[0], cell[1] - 1, cell[2]]) === BLOCK.MOUNT : supportedCell(p, cell));
}

/** Reasons are shared with the first-person ghost and AI planner; no state is allocated on rejection. */
export function designationReason(castle, command, state = {}) {
  if (!castle || castle.eliminated || !command.cell) return 'not-own';
  const p = castle.plot, cell = command.cell, i = indexOf(p, cell);
  if (cell[1] < T.world.buildMinY || cell[1] > T.world.buildMaxY) return 'height';
  if (i < 0) return 'outside';
  if ((castle.npcDesignations?.length ?? castle.designations?.length ?? 0) >= T.world.maxOpenDesignations) return 'cap';
  if (p.meta[i] & META.DESIGNATED_BIT) return 'occupied';
  if (command.type === CMD.DEMOLISH) {
    const def = blockDef(p.type[i]);
    return p.type[i] !== BLOCK.AIR && def && p.hp[i] !== T.hpIndestructible ? 'ok' : 'occupied';
  }
  const weapon = command.type === CMD.DESIGNATE_WEAPON;
  const def = weapon ? getWeapon(command.weapon) ?? T.weapons[command.weapon] : blockDef(command.block);
  if (command.type !== CMD.DESIGNATE && !weapon || !def || def.cost === null || !weapon && command.block === BLOCK.AIR
    || weapon && command.weapon !== 'cannon') return 'invalid';
  if (p.type[i] !== BLOCK.AIR || cellHasWeapon(p, cell, state.weapons)) return 'occupied';
  if (weapon && typeAt(p, [cell[0], cell[1] - 1, cell[2]]) !== BLOCK.MOUNT) return 'mount';
  if (!weapon && !supportedCell(p, cell)) return 'support';
  if (cellHasPerson(p, cell, state)) return 'person';
  if (weapon) {
    const count = (state.weapons ?? []).filter(w => w.slot === castle.slot && w.hp > 0).length
      + (castle.npcDesignations ?? []).filter(d => d.weapon).length;
    if (count >= (state.weaponCap ?? getMap(state.mapId)?.weaponCap ?? T.world.weaponCapDefault)) return 'weapon-cap';
  }
  return castle.gold >= def.cost ? 'ok' : 'gold';
}
export const canDesignate = (castle, command, state) => designationReason(castle, command, state) === 'ok';
