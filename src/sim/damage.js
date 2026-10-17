// src/sim/damage.js - owns swept entity intersections and index-ordered blast damage.
import { BLOCK, EV, META, RNG_STREAM, getWeapon } from '../contracts.js';
import { refund } from './economy.js';
import { markJobScanDirty } from '../npc/model.js';
import { TUNING as T } from '../tuning.js';
import { sqrt } from '../core/fmath.js';
import { xyz, indexToCell, cellToWorld, setCell, raycast } from '../world/grid.js';
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
    const covered = d < radius && ctx.state.castles.some(c => raycast(c.plot, pos, centre,
      id => (ctx.getBlock?.(id)?.projectileSolid ?? (id !== BLOCK.AIR && id !== BLOCK.LADDER))));
    if (d < radius && !covered) damagePerson(ctx, person, Math.floor(peak * (1 - d / radius)), sourceSlot);
  }
}
/** Damage one cell, preserving foundation and collecting destruction for support processing. */
export function damageBlock(ctx, plot, index, dp, sourceSlot) {
  if (index < 0 || index >= plot.type.length || plot.type[index] === BLOCK.AIR || plot.hp[index] === T.hpIndestructible) return null;
  dp = Math.max(0, Math.floor(dp));
  if (!dp) return null;
  markJobScanDirty(plot);
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
/** research/11 5.2: direct excludes collateral; splash uses S-floor(S*d/R), d<R.
 * Voxel centres stand in for original building reference points; obstruction is not modelled. */
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
      if (d < radius) damages.set(index, splash - Math.floor(splash * d / radius));
    }
    if (hit && (hit.plot === plot || hit.plot === plot.id) && Number.isInteger(hit.index)) damages.set(hit.index, direct);
    for (const [index, dp] of [...damages].sort(([a], [b]) => a - b)) {
      const result = damageBlock(ctx, plot, index, dp, blast.sourceSlot);
      if (result) { cells.push(result); if (result.destroyed) destroyed.push({ plot, index }); }
    }
  }
  for (const weapon of [...ctx.state.weapons ?? []].sort((a, b) => a.id - b.id)) {
    if (weapon.hp <= 0) continue;
    const d = distance(pos, weapon.pos), amount = hit?.weaponId === weapon.id ? direct
      : radius > 0 && d < radius ? splash - Math.floor(splash * d / radius) : 0;
    if (amount > 0) {
      weapon.hp = Math.max(0, weapon.hp - amount);
      ctx.emit?.(EV.WEAPON_DAMAGED, { weaponId: weapon.id, hp: weapon.hp });
      if (weapon.hp === 0) {
        const castle=ctx.castleOf?.(weapon.slot) ?? ctx.state.castles.find(c=>c.slot===weapon.slot);
        const def=ctx.getWeapon?.(weapon.defId) ?? getWeapon(weapon.defId);
        const salvageGold=(def?.cost ?? 0)*T.economy.weaponSalvageFrac;
        if(castle&&Number.isFinite(castle.gold))refund(castle,salvageGold);
        ctx.emit?.(EV.WEAPON_DESTROYED,{weaponId:weapon.id,slot:weapon.slot,salvageGold});
      }
    }
  }
  // A bolt with no explosive payload never produces a one-metre people blast.
  if (splash > 0 && radius > 0) damagePeople(ctx, { pos, radius: radius + T.people.splashExtraM, peak: T.people.splashPeak, sourceSlot: blast.sourceSlot });
  igniteBlocks(ctx, { ...blast, ignite: blast.ignite ?? blast.projectile?.payload.ignite });
  return { cells, destroyed };
}

/** Count capsule hits along one swept flight, never restarting its age or force state.
 * The sim excludes these ids on the remaining segment; blocks/terrain still stop it. */
export function piercePerson(projectile, hit) {
  if (hit.kind !== 'person' || !(projectile.payload.pierce > 0)) return false;
  projectile.piercedPeople ??= [];
  projectile.piercedPeople.push(hit.person.id);
  return projectile.piercedPeople.length < projectile.payload.pierce;
}
function igniteCell(ctx, castle, index, sourceSlot) {
  const plot = castle.plot;
  if (!ctx.getBlock?.(plot.type[index])?.burnable || plot.hp[index] <= 0 || plot.meta[index] & META.BURNING_BIT) return;
  castle.fires ??= [];
  castle.fires.push({ index, remainingS: T.fire.burnS, secondS: 0, sourceSlot });
  castle.fires.sort((a, b) => a.index - b.index);
  plot.meta[index] |= META.BURNING_BIT;
}
/** Ignition radius is independent of explosive splash, and stone never starts a fire. */
export function igniteBlocks(ctx, { pos, ignite = 0, sourceSlot }) {
  if (!(ignite > 0)) return;
  pos = xyz(pos);
  for (const castle of [...ctx.state.castles].sort((a, b) => a.id - b.id)) {
    const p = castle.plot;
    const lo = { x: Math.max(0, Math.floor(pos.x - ignite - p.origin.x)), y: Math.max(0, Math.floor(pos.y - ignite - p.origin.y)), z: Math.max(0, Math.floor(pos.z - ignite - p.origin.z)) };
    const hi = { x: Math.min(p.width - 1, Math.floor(pos.x + ignite - p.origin.x)), y: Math.min(p.height - 1, Math.floor(pos.y + ignite - p.origin.y)), z: Math.min(p.depth - 1, Math.floor(pos.z + ignite - p.origin.z)) };
    for (let y = lo.y; y <= hi.y; y++) for (let z = lo.z; z <= hi.z; z++) for (let x = lo.x; x <= hi.x; x++)
      if (distance(pos, cellToWorld(p, x, y, z)) <= ignite) igniteCell(ctx, castle, x + p.width * z + p.width * p.depth * y, sourceSlot);
  }
}
/** Damage/spread once per fire-second in castle/cell order. New fires wait until the
 * next tick, preventing same-tick flood fill. Only the fire RNG stream is consumed. */
export function tickFire(ctx, dt) {
  const neighbours = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for (const castle of ctx.state.castles) {
    if (!castle.fires?.length) continue;
    const p = castle.plot, active = [], pending = [];
    for (const fire of castle.fires) {
      if (!ctx.getBlock?.(p.type[fire.index])?.burnable || p.hp[fire.index] <= 0) { p.meta[fire.index] &= ~META.BURNING_BIT; continue; }
      const step = Math.min(dt, fire.remainingS);
      fire.remainingS -= step; fire.secondS += step;
      while (fire.secondS + 1e-9 >= 1) {
        fire.secondS = Math.max(0, fire.secondS - 1);
        damageBlock(ctx, p, fire.index, T.fire.dps, fire.sourceSlot);
        const c = indexToCell(p, fire.index);
        for (const [dx,dy,dz] of neighbours) {
          const x = c.x + dx, y = c.y + dy, z = c.z + dz;
          if (x < 0 || x >= p.width || y < 0 || y >= p.height || z < 0 || z >= p.depth) continue;
          const index = x + p.width * z + p.width * p.depth * y;
          if (ctx.getBlock?.(p.type[index])?.burnable && p.hp[index] > 0 && !(p.meta[index] & META.BURNING_BIT)
            && ctx.rng(RNG_STREAM.FIRE)() < T.fire.spreadP) pending.push({ index, sourceSlot: fire.sourceSlot });
        }
      }
      if (fire.remainingS > 1e-9 && p.hp[fire.index] > 0) active.push(fire);
      else p.meta[fire.index] &= ~META.BURNING_BIT;
    }
    castle.fires = active;
    for (const fire of pending) igniteCell(ctx, castle, fire.index, fire.sourceSlot);
  }
}
