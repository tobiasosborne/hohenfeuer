// src/world/grid.js - owns plot cell storage, coordinate conversion and swept voxel collision.
import { TUNING as T } from '../tuning.js';
import { BLOCK } from '../contracts.js';
/** Create a plot; origin is its minimum corner, size order is x/y/z. */
export function createPlot({ width = T.world.plotW, height = T.world.plotH, depth = T.world.plotD, origin = [0, 0, 0], foundation = true, id = 0 } = {}) {
  if (![width, height, depth].every(n => Number.isInteger(n) && n > 0)) throw new TypeError('Invalid plot dimensions');
  const n = width * height * depth;
  const plot = { id, width, height, depth, origin: xyz(origin), type: new Uint8Array(n), hp: new Uint8Array(n), meta: new Uint8Array(n), navVersion: 0 };
  if (foundation) { plot.type.fill(BLOCK.FOUNDATION, 0, width * depth); plot.hp.fill(T.hpIndestructible, 0, width * depth); }
  return plot;
}
export const createGrid = createPlot;
/** Normalize a tuple or vector to a plain vector. */
export function xyz(p) { return Array.isArray(p) ? { x: p[0], y: p[1], z: p[2] } : { x: p.x, y: p.y, z: p.z }; }
/** Return DESIGN's x + width*z + width*depth*y index, or -1 out of bounds. */
export function cellIndex(plot, x, y, z) {
  return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) && x >= 0 && x < plot.width && y >= 0 && y < plot.height && z >= 0 && z < plot.depth ? x + plot.width * z + plot.width * plot.depth * y : -1;
}
/** Decode an index to local integer coordinates. */
export function indexToCell(plot, i) { const layer = plot.width * plot.depth, y = Math.floor(i / layer), z = Math.floor((i - y * layer) / plot.width); return { x: i % plot.width, y, z }; }
/** Read a cell without exposing a mutable record. */
export function getCell(plot, x, y, z) { const index = cellIndex(plot, x, y, z); return index < 0 ? null : { index, type: plot.type[index], id: plot.type[index], hp: plot.hp[index], meta: plot.meta[index] }; }
/** Set one destructible cell; returns false at foundation or outside the plot. */
export function setCell(plot, x, y, z, type, hp = 0, meta = 0) {
  const i = cellIndex(plot, x, y, z);
  if (i < 0 || y === 0 && plot.hp[i] === T.hpIndestructible) return false;
  if (![type, hp, meta].every(n => Number.isInteger(n) && n >= 0 && n <= 255)) throw new TypeError('Cell fields must be bytes');
  plot.type[i] = type; plot.hp[i] = type ? hp : 0; plot.meta[i] = type ? meta : 0; plot.navVersion++;
  return true;
}
/** World coordinates to cell coordinates (possibly outside the plot). */
export function worldToCell(plot, point) { const p = xyz(point); return { x: Math.floor(p.x - plot.origin.x), y: Math.floor(p.y - plot.origin.y), z: Math.floor(p.z - plot.origin.z) }; }
/** Cell centre in world space; y is centre unless offset.y is supplied. */
export function cellToWorld(plot, x, y, z, offset = { x: 0.5, y: 0.5, z: 0.5 }) { return { x: plot.origin.x + x + offset.x, y: plot.origin.y + y + offset.y, z: plot.origin.z + z + offset.z }; }
/** 3D segment DDA, clipped to plot bounds. Ties conservatively visit every touched voxel.
 * predicate receives (type, index, plot); ladders pass shots by default.
 * Result t is a fraction of the original segment, so hits across plots can be compared.
 */
export function raycast(plot, from, to, predicate = type => type !== BLOCK.AIR && type !== BLOCK.LADDER) {
  const a = xyz(from), b = xyz(to);
  const s = [a.x - plot.origin.x, a.y - plot.origin.y, a.z - plot.origin.z];
  const d = [b.x - a.x, b.y - a.y, b.z - a.z], size = [plot.width, plot.height, plot.depth];
  let enter = 0, exit = 1, enterAxis = -1;
  for (let axis = 0; axis < 3; axis++) {
    if (d[axis] === 0) { if (s[axis] < 0 || s[axis] >= size[axis]) return null; continue; }
    let lo = -s[axis] / d[axis], hi = (size[axis] - s[axis]) / d[axis];
    if (lo > hi) [lo, hi] = [hi, lo];
    if (lo > enter) { enter = lo; enterAxis = axis; }
    exit = Math.min(exit, hi);
    if (enter > exit) return null;
  }
  const cell = s.map((v, axis) => Math.min(size[axis] - 1, Math.max(0, Math.floor(v + enter * d[axis]))));
  const step = d.map(v => v > 0 ? 1 : v < 0 ? -1 : 0);
  const delta = d.map(v => v === 0 ? Infinity : Math.abs(1 / v));
  const next = cell.map((v, axis) => step[axis] === 0 ? Infinity : ((step[axis] > 0 ? v + 1 : v) - s[axis]) / d[axis]);
  function hitAt(c, t, axis) {
    const index = cellIndex(plot, c[0], c[1], c[2]);
    if (index < 0 || !predicate(plot.type[index], index, plot)) return null;
    const normal = { x: 0, y: 0, z: 0 };
    if (axis >= 0) normal[['x', 'y', 'z'][axis]] = -step[axis];
    return { t, index, cell: { x: c[0], y: c[1], z: c[2] }, pos: { x: a.x + d[0] * t, y: a.y + d[1] * t, z: a.z + d[2] * t }, normal, type: plot.type[index], hp: plot.hp[index], meta: plot.meta[index], plot };
  }
  const initial = hitAt(cell, enter, enterAxis);
  if (initial) return initial;
  for (;;) {
    const t = Math.min(...next);
    if (!Number.isFinite(t) || t > exit) return null;
    const axes = [];
    for (let axis = 0; axis < 3; axis++) if (Math.abs(next[axis] - t) <= 1e-12) axes.push(axis);
    // A ray through a corner may touch up to seven additional cubes at the same t.
    for (let mask = 1; mask < 1 << axes.length; mask++) {
      const candidate = [...cell];
      for (let j = 0; j < axes.length; j++) if (mask & 1 << j) candidate[axes[j]] += step[axes[j]];
      const hit = hitAt(candidate, Math.max(0, t), axes[0]);
      if (hit) return hit;
    }
    for (const axis of axes) { cell[axis] += step[axis]; next[axis] += delta[axis]; }
    if (cell.some((v, axis) => v < 0 || v >= size[axis])) return null;
  }
}
export const raycastGrid = raycast;
