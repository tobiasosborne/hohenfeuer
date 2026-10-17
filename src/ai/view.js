// src/ai/view.js - owns the local read-only SimView adapter and public voxel visibility queries.
import { BLOCK, getBlock, getWeapon, TRAJ } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { sin, cos, DEG } from '../core/fmath.js';
import { vector } from './aim.js';
import { plotSize, decodeCell } from './build.js';

/**
 * SimView is currently an empty contract typedef. This adapter consumes only public fields:
 * tick, slots, castles[{slot,plot,gold,eliminated}], weapons, rulers, npcs, wind,
 * events[{type,tick?,payload}], and optional commandKinds. No enemy jobs/morale/aim.
 * Plots are {origin,width,height,depth,type,hp?,meta?}; vectors accept tuples or records.
 */
export function publicView(view, slot) {
  const castles = [...(view.castles ?? [])].sort((a, b) => a.slot - b.slot);
  const wind = view.wind ?? { x: 0, z: 0 };
  const direction = wind.direction ?? wind.dirDeg ?? 0;
  return { tick: view.tick, castles, own: castles.find(c => c.slot === slot.id),
    weapons: [...(view.weapons ?? [])].sort((a, b) => a.id - b.id),
    wind: Number.isFinite(wind.x) && Number.isFinite(wind.z) ? { x: wind.x, z: wind.z }
      : { x: (wind.speed ?? 0) * sin(direction * DEG), z: -(wind.speed ?? 0) * cos(direction * DEG) },
    windVersion: wind.changeId ?? `${wind.x ?? wind.speed ?? 0}:${wind.z ?? direction}` };
}

/** Registered definitions take priority; tuning is a local adapter for isolated fixtures. */
const fallbackDefs = new Map();
export function weaponDefinition(weapon) {
  if (weapon.def) return weapon.def;
  const id = weapon.defId;
  const registered = getWeapon(id);
  if (registered) return registered;
  const row = T.weapons[id];
  if (!row) return null;
  if (!fallbackDefs.has(id)) fallbackDefs.set(id, Object.freeze({ ...row, id, elevDeg: row.traj === TRAJ.LOBBED ? T.aim.lobbedElevDeg : T.aim.straightElevDeg }));
  return fallbackDefs.get(id);
}

/**
 * Prefer a published muzzle. Phase 1 exposes only weapon feet, so this local adapter
 * mirrors its public hull/radius geometry; request an explicit muzzle in SimView.
 */
export function shooterPosition(weapon, target) {
  if (weapon.muzzle) return vector(weapon.muzzle);
  const p = vector(weapon.pos), q = vector(target), def = weaponDefinition(weapon);
  const dx = q.x - p.x, dz = q.z - p.z, distance = Math.sqrt(dx * dx + dz * dz);
  const offset = T.weaponRules.wallFootprint[0] / 2 + 2 * (def?.shot?.radius ?? def?.projRadius ?? 0);
  return { x: p.x + (distance ? dx / distance * offset : 0),
    y: p.y + T.weaponRules.wallFootprint[2] * 0.75, z: p.z + (distance ? dz / distance * offset : 0) };
}

/** Plot-local cell centre in world metres. */
export function cellPosition(plot, cell) {
  const origin = vector(plot.origin ?? [0, 0, 0]);
  return { x: origin.x + cell[0] + 0.5, y: origin.y + cell[1] + 0.5, z: origin.z + cell[2] + 0.5 };
}

/** A local DDA adapter avoids importing another lane's private grid helpers. */
export function firstBlockOnLine(view, from, to) {
  const a = vector(from), b = vector(to), delta = [b.x - a.x, b.y - a.y, b.z - a.z];
  let nearest = null;
  for (const castle of [...(view.castles ?? [])].sort((a, b) => a.slot - b.slot)) {
    const plot = castle.plot;
    if (!plot) continue;
    const origin = vector(plot.origin ?? [0, 0, 0]), { w, h, d } = plotSize(plot);
    const size = [w, h, d], start = [a.x - origin.x, a.y - origin.y, a.z - origin.z];
    let enter = 0, exit = 1;
    for (let axis = 0; axis < 3; axis++) {
      if (delta[axis] === 0) { if (start[axis] < 0 || start[axis] >= size[axis]) exit = -1; }
      else {
        const p = -start[axis] / delta[axis], q = (size[axis] - start[axis]) / delta[axis];
        enter = Math.max(enter, Math.min(p, q)); exit = Math.min(exit, Math.max(p, q));
      }
    }
    if (enter > exit) continue;
    const cell = start.map((s, i) => Math.max(0, Math.min(size[i] - 1, Math.floor(s + enter * delta[i]))));
    const step = delta.map(v => v > 0 ? 1 : v < 0 ? -1 : 0);
    const next = cell.map((c, i) => step[i] ? ((step[i] > 0 ? c + 1 : c) - start[i]) / delta[i] : Infinity);
    const stride = delta.map(v => v ? Math.abs(1 / v) : Infinity);
    const check = (c, t) => {
      if (c.some((n, i) => n < 0 || n >= size[i])) return false;
      // The firing hull's cell is allowed; all subsequent touched cells obstruct fire.
      if (t === 0 && c.every((n, i) => n === Math.floor(start[i]))) return false;
      const index = c[0] + w * c[2] + w * d * c[1], block = plot.type[index];
      const solid = getBlock(block)?.projectileSolid ?? (block !== BLOCK.AIR && block !== BLOCK.LADDER);
      if (!solid) return false;
      if (nearest === null || t < nearest.t) nearest = { slot: castle.slot, index, cell: [...c], block, t, pos: cellPosition(plot, c) };
      return true;
    };
    if (check(cell, enter)) continue;
    for (;;) {
      const t = Math.min(...next);
      if (t > exit || !Number.isFinite(t)) break;
      const axes = [0, 1, 2].filter(i => next[i] === t);
      let hit = false;
      for (let mask = 1; mask < 1 << axes.length; mask++) {
        const touched = [...cell];
        axes.forEach((axis, i) => { if (mask & 1 << i) touched[axis] += step[axis]; });
        if (check(touched, t)) { hit = true; break; }
      }
      if (hit) break;
      for (const axis of axes) { cell[axis] += step[axis]; next[axis] += stride[axis]; }
      if (cell.some((n, i) => n < 0 || n >= size[i])) break;
    }
  }
  return nearest;
}

/** Target itself may be the first opaque cell. */
export function visibleTarget(view, from, target) {
  const hit = firstBlockOnLine(view, from, target.pos);
  return hit === null || hit.slot === target.slot && hit.index === target.index;
}

/** Cell identity does not depend on scan/insertion order. */
export function blockTarget(castle, index, kind) {
  return { id: index, key: `block:${castle.slot}:${index}`, slot: castle.slot, index, kind,
    cell: decodeCell(castle.plot, index), pos: cellPosition(castle.plot, decodeCell(castle.plot, index)) };
}
