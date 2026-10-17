// src/sim/damage.js - owns swept entity intersections and index-ordered blast damage.
import { BLOCK, EV } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { sqrt } from '../core/fmath.js';
import { xyz, indexToCell, cellToWorld, setCell } from '../world/grid.js';
const distance = (a, b) => sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z));
/** Earliest segment/AABB fraction, including starts inside. */
export function segmentAabb(from, to, box) {
  const a = xyz(from), b = xyz(to), min = xyz(box.min), max = xyz(box.max);
  let enter = 0, exit = 1;
  for (const axis of ['x', 'y', 'z']) {
    const d = b[axis] - a[axis];
    if (d === 0) { if (a[axis] < min[axis] || a[axis] > max[axis]) return null; continue; }
    let lo = (min[axis] - a[axis]) / d, hi = (max[axis] - a[axis]) / d;
    if (lo > hi) [lo, hi] = [hi, lo];
    enter = Math.max(enter, lo); exit = Math.min(exit, hi);
    if (enter > exit) return null;
  }
  return enter;
}
function sphere(a, d, c, radius) {
  const x = a.x - c.x, y = a.y - c.y, z = a.z - c.z;
  const aa = d.x * d.x + d.y * d.y + d.z * d.z, bb = x * d.x + y * d.y + z * d.z, cc = x * x + y * y + z * z - radius * radius;
  if (cc <= 0) return 0;
  const disc = bb * bb - aa * cc;
  if (aa === 0 || disc < 0) return null;
  const t = (-bb - sqrt(disc)) / aa;
  return t >= 0 && t <= 1 ? t : null;
}
/** Upright capsule with feet at person.pos and full height (not a capsule AABB). */
export function segmentCapsule(from, to, person) {
  const a = xyz(from), b = xyz(to), p = xyz(person.pos), r = person.radius ?? T.people.npcRadius, height = person.height ?? T.people.height;
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, low = p.y + r, high = p.y + height - r;
  let best = null;
  const accept = t => { if (t !== null && (best === null || t < best)) best = t; };
  accept(sphere(a, d, { x: p.x, y: low, z: p.z }, r));
  accept(sphere(a, d, { x: p.x, y: high, z: p.z }, r));
  const x = a.x - p.x, z = a.z - p.z, aa = d.x * d.x + d.z * d.z, bb = x * d.x + z * d.z, cc = x * x + z * z - r * r;
  if (cc <= 0 && a.y >= low && a.y <= high) return 0;
  const disc = bb * bb - aa * cc;
  if (aa > 0 && disc >= 0) {
    const t = (-bb - sqrt(disc)) / aa, y = a.y + t * d.y;
    if (t >= 0 && t <= 1 && y >= low && y <= high) accept(t);
  }
  return best;
}
/** Apply person damage once, emitting ruler/NPC deaths only at the living->dead transition. */
export function damagePerson(ctx, person, dp, sourceSlot, cause = 'blast') {
  if (person.hp <= 0 || !(dp > 0)) return 0;
  const actual = Math.min(person.hp, dp);
  person.hp -= actual; person.lastDamageTick = ctx.state.tick; person.lastDamageBy = sourceSlot;
  ctx.emit?.(EV.PERSON_DAMAGED, { entityId: person.id, hp: person.hp });
  if (person.hp <= 0) {
    person.dead = true;
    if (person.isRuler) ctx.emit?.(EV.RULER_DIED, { slot: person.slot, cause });
    else ctx.emit?.(EV.NPC_DIED, { entityId: person.id, role: person.role, castle: person.castle ?? person.slot, cause });
  }
  return actual;
}
/** Splash people in id order, with the DESIGN extra one metre of radius. */
export function damagePeople(ctx, { pos, radius, peak = T.people.splashPeak, sourceSlot }) {
  pos = xyz(pos);
  const people = [...(ctx.state.rulers ?? []), ...(ctx.state.npcs ?? [])].sort((a, b) => a.id - b.id);
  for (const person of people) {
    const centre = { ...person.pos, y: person.pos.y + (person.height ?? T.people.height) / 2 }, d = distance(pos, centre);
    if (d < radius) damagePerson(ctx, person, Math.floor(peak * (1 - d / radius)), sourceSlot);
  }
}
/** Damage one cell, preserving foundation and collecting destruction for support processing. */
export function damageBlock(ctx, plot, index, dp, sourceSlot) {
  if (index < 0 || index >= plot.type.length || plot.type[index] === BLOCK.AIR || plot.hp[index] === T.hpIndestructible) return null;
  dp = Math.max(0, Math.floor(dp));
  if (!dp) return null;
  const id = plot.type[index], hp = plot.hp[index], amount = Math.min(hp, dp), cell = indexToCell(plot, index), def = ctx.getBlock?.(id);
  if (amount >= hp) {
    setCell(plot, cell.x, cell.y, cell.z, BLOCK.AIR, 0);
    ctx.emit?.(EV.BLOCK_DESTROYED, { plot: plot.id, cell: [cell.x, cell.y, cell.z], id, sourceSlot });
    ctx.onDestroyed?.(plot, index, id, sourceSlot);
    def?.onDestroyed?.(ctx.api ?? ctx, { plot: plot.id, cell: [cell.x, cell.y, cell.z] });
  } else {
    plot.hp[index] = hp - amount;
    const fraction = plot.hp[index] / (def?.hp ?? hp), state = T.damageStateAbove.findIndex(t => fraction > t);
    ctx.emit?.(EV.BLOCK_DAMAGED, { plot: plot.id, cell: [cell.x, cell.y, cell.z], id, hp: plot.hp[index], state: state < 0 ? T.damageStateAbove.length : state });
  }
  return { plot: plot.id, index, damage: amount, destroyed: amount >= hp };
}
/** Apply direct and splash together once per cell in index order. */
export function applyBlast(ctx, blast) {
  const pos = xyz(blast.pos), direct = blast.direct ?? 0, splash = blast.splash ?? 0, radius = blast.radius ?? 0, hit = blast.hit;
  const cells = [], destroyed = [];
  for (const castle of [...ctx.state.castles].sort((a, b) => a.id - b.id)) {
    const plot = castle.plot;
    const minX = Math.max(0, Math.floor(pos.x - radius - plot.origin.x)), maxX = Math.min(plot.width - 1, Math.floor(pos.x + radius - plot.origin.x));
    const minY = Math.max(0, Math.floor(pos.y - radius - plot.origin.y)), maxY = Math.min(plot.height - 1, Math.floor(pos.y + radius - plot.origin.y));
    const minZ = Math.max(0, Math.floor(pos.z - radius - plot.origin.z)), maxZ = Math.min(plot.depth - 1, Math.floor(pos.z + radius - plot.origin.z));
    const damages = new Map();
    for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
      const index = x + plot.width * z + plot.width * plot.depth * y;
      if (!plot.type[index] || plot.hp[index] === T.hpIndestructible || radius <= 0) continue;
      const d = distance(pos, cellToWorld(plot, x, y, z));
      if (d <= radius) damages.set(index, splash * (1 - d / radius));
    }
    if (hit && (hit.plot === plot || hit.plot === plot.id) && Number.isInteger(hit.index)) damages.set(hit.index, (damages.get(hit.index) ?? 0) + direct);
    for (const [index, dp] of [...damages].sort(([a], [b]) => a - b)) {
      const result = damageBlock(ctx, plot, index, dp, blast.sourceSlot);
      if (result) { cells.push(result); if (result.destroyed) destroyed.push({ plot, index }); }
    }
  }
  for (const weapon of [...ctx.state.weapons ?? []].sort((a, b) => a.id - b.id)) {
    if (weapon.hp <= 0) continue;
    const d = distance(pos, weapon.pos), amount = Math.floor((hit?.weaponId === weapon.id ? direct : 0) + (radius > 0 && d <= radius ? splash * (1 - d / radius) : 0));
    if (amount > 0) {
      weapon.hp = Math.max(0, weapon.hp - amount);
      ctx.emit?.(EV.WEAPON_DAMAGED, { weaponId: weapon.id, hp: weapon.hp });
      if (weapon.hp === 0) ctx.emit?.(EV.WEAPON_DESTROYED, { weaponId: weapon.id, slot: weapon.slot });
    }
  }
  damagePeople(ctx, { pos, radius: radius + T.people.splashExtraM, peak: T.people.splashPeak, sourceSlot: blast.sourceSlot });
  return { cells, destroyed };
}
