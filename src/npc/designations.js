// src/npc/designations.js - owns read-only build-site support, occupancy and designation eligibility.
import { BLOCK, CMD, META, MOUNT, getWeapon, getMap } from '../contracts.js';
import { weaponAvailable } from '../sim/ballistics.js';
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
    const p = w.pos ? vector(w.pos) : null, at = w.at ?? w.cell ?? (p ? [Math.floor(p.x - o.x), Math.floor(p.y - o.y), Math.floor(p.z - o.z)] : null);
    const def = getWeapon(w.defId ?? w.weapon ?? w.id) ?? T.weapons[w.defId ?? w.weapon ?? w.id];
    const [width, depth, height] = def?.footprint ?? (def?.mount === MOUNT.GROUND ? T.weaponRules.groundFootprint : T.weaponRules.wallFootprint);
    return at && Math.abs(at[0] - cell[0]) <= Math.floor(width / 2)
      && Math.abs(at[2] - cell[2]) <= Math.floor(depth / 2) && cell[1] >= at[1] && cell[1] < at[1] + height;
  });
}
/** Masons must stand outside a pending weapon's whole footprint, including body edges. */
export function personOverlapsWeaponSite(plot, cell, weapon, person) {
  const def = getWeapon(weapon) ?? T.weapons[weapon];
  const [w,d,h] = def?.footprint ?? (def?.mount === MOUNT.GROUND ? T.weaponRules.groundFootprint : T.weaponRules.wallFootprint);
  for (let y=0;y<h;y++) for (let z=-Math.floor(d/2);z<=Math.floor(d/2);z++) for (let x=-Math.floor(w/2);x<=Math.floor(w/2);x++)
    if (personOverlapsCell(plot,[cell[0]+x,cell[1]+y,cell[2]+z],person)) return true;
  return false;
}
function weaponSiteReason(castle, cell, state, def) {
  const p = castle.plot;
  if (!weaponAvailable(def)) return 'invalid';
  const [width, depth, height] = def.footprint ?? (def.mount === MOUNT.GROUND ? T.weaponRules.groundFootprint : T.weaponRules.wallFootprint);
  if (def.mount === MOUNT.GROUND && cell[1] !== T.world.buildMinY) return 'mount';
  const pending = (castle.npcDesignations ?? []).filter(d => d.weapon && !d.cell.every((n,i) => n === cell[i]));
  for (let dz = -Math.floor(depth / 2); dz <= Math.floor(depth / 2); dz++) for (let dx = -Math.floor(width / 2); dx <= Math.floor(width / 2); dx++) {
    const below = typeAt(p, [cell[0] + dx, cell[1] - 1, cell[2] + dz]);
    if (def.mount === MOUNT.WALL ? below !== BLOCK.MOUNT : !blockDef(below)?.solid) return 'mount';
    for (let dy = 0; dy < height; dy++) {
      const c = [cell[0] + dx, cell[1] + dy, cell[2] + dz];
      if (indexOf(p,c) < 0 || c[1] > T.world.buildMaxY) return 'outside';
      if (typeAt(p,c) !== BLOCK.AIR || cellHasWeapon(p,c,state.weapons) || cellHasWeapon(p,c,pending)) return 'occupied';
      if (cellHasPerson(p,c,state)) return 'person';
    }
  }
  return 'ok';
}
/** Recheck the entire footprint during work; newly arriving people/support loss stop construction. */
export function buildSiteReady(castle, cell, state = {}, weapon = null) {
  const p = castle.plot;
  if (weapon) return weaponSiteReason(castle,cell,state,getWeapon(weapon) ?? T.weapons[weapon]) === 'ok';
  return typeAt(p, cell) === BLOCK.AIR && !cellHasPerson(p, cell, state) && !cellHasWeapon(p, cell, state.weapons) && supportedCell(p, cell);
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
    || weapon && !weaponAvailable(def)) return 'invalid';
  if (p.type[i] !== BLOCK.AIR || cellHasWeapon(p, cell, state.weapons)
    || cellHasWeapon(p,cell,(castle.npcDesignations ?? []).filter(d => d.weapon))) return 'occupied';
  if (weapon) { const reason = weaponSiteReason(castle,cell,state,def); if (reason !== 'ok') return reason; }
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
