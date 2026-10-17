// src/player/interact.js - owns reticle picking (blocks, designations, weapons) and designation-ghost validity.
// Pure. Block picking uses the sim's DDA (src/world/grid.js raycast, DESIGN 3.3 Amanatides-Woo) so
// the reticle and the sim agree on cells; weapons are AABBs. Rules: DESIGN 2.1, 2.2, 4.8, 5.

import { BLOCK, K, MOUNT } from "../contracts.js";
import { TUNING } from "../tuning.js";
import { sin, cos, PI } from "../core/fmath.js";
import { raycast } from "../world/grid.js";

/** meta bit 5 marks an open designation (DESIGN 2.1). */
export const DESIGNATED_BIT = 1 << 5;

/** Why a ghost is invalid (OK when valid). */
export const GHOST_REASON = Object.freeze({
  OK: "ok", NOT_OWN: "not-own", HEIGHT: "height", OUTSIDE: "outside", OCCUPIED: "occupied",
  MOUNT: "mount", PERSON: "person", CAP: "cap", GOLD: "gold",
});

/**
 * Unit look vector; yaw clockwise from north (-Z), pitch up positive.
 * @returns {{x: number, y: number, z: number}}
 */
export function lookDir(yaw, pitch) {
  const cp = cos(pitch);
  return { x: sin(yaw) * cp, y: sin(pitch), z: -cos(yaw) * cp };
}

/** Facing N/E/S/W (FACING 0..3) nearest to a yaw in radians. */
export function facingFromYaw(yaw) {
  const q = Math.round(yaw / (PI / 2));
  return ((q % 4) + 4) % 4;
}

/** Segment (origin o, unit dir d, length L) vs AABB; returns entry distance or -1. */
function rayBox(o, d, L, min, max) {
  let t0 = 0, t1 = L;
  const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
  for (let a = 0; a < 3; a++) {
    if (dd[a] === 0) { if (oo[a] < min[a] || oo[a] > max[a]) return -1; continue; }
    let ta = (min[a] - oo[a]) / dd[a], tb = (max[a] - oo[a]) / dd[a];
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return -1;
  }
  return t0;
}

/**
 * @typedef {object} PickTarget
 * @property {'block'|'designation'|'weapon'|'none'} kind
 * @property {number} dist metres from the eye (Infinity for none)
 * @property {boolean} own target belongs to the picking slot
 * @property {number[]} [cell] plot-local [x,y,z]
 * @property {number[]} [normal] face normal [x,y,z]
 * @property {number} [plot] plot id
 * @property {number} [block] block id
 * @property {boolean} [designated]
 * @property {number} [weaponId] @property {boolean} [crewOrdered]
 */

/**
 * First thing under the reticle within maxDist (default the 24 m order range of DESIGN 4.8).
 * @param {{eye: number[], yaw: number, pitch: number, slot: number,
 *   plots: Array<{plot: object, slot: number}>,
 *   weapons: Array<{id: number, slot: number, min: number[], max: number[], crewOrdered?: boolean}>,
 *   maxDist?: number}} q
 * @returns {PickTarget}
 */
export function pick(q) {
  const L = q.maxDist ?? TUNING.ruler.interactOrderM;
  const o = { x: q.eye[0], y: q.eye[1], z: q.eye[2] };
  const d = lookDir(q.yaw, q.pitch);
  const to = { x: o.x + d.x * L, y: o.y + d.y * L, z: o.z + d.z * L };
  let best = { kind: "none", dist: Infinity, own: false };
  const solidOrDesignated = (type, index, plot) => type !== BLOCK.AIR || (plot.meta[index] & DESIGNATED_BIT) !== 0;
  for (const { plot, slot } of q.plots || []) {
    const hit = raycast(plot, o, to, solidOrDesignated);
    if (!hit) continue;
    const dist = hit.t * L;
    if (dist >= best.dist) continue;
    const designated = (hit.meta & DESIGNATED_BIT) !== 0;
    best = {
      kind: hit.type === BLOCK.AIR ? "designation" : "block", dist, own: slot === q.slot,
      cell: [hit.cell.x, hit.cell.y, hit.cell.z], normal: [hit.normal.x, hit.normal.y, hit.normal.z],
      plot: plot.id, block: hit.type, designated,
    };
  }
  for (const w of q.weapons || []) {
    const t = rayBox(o, d, L, w.min, w.max);
    if (t < 0 || t >= best.dist) continue;
    best = { kind: "weapon", dist: t, own: w.slot === q.slot, weaponId: w.id, crewOrdered: !!w.crewOrdered };
  }
  return best;
}

const inPlot = (p, x, y, z) => x >= 0 && x < p.width && y >= 0 && y < p.height && z >= 0 && z < p.depth;
const idx = (p, x, y, z) => x + p.width * z + p.width * p.depth * y;

/** Person AABB overlaps the world box of a plot cell. */
function personInCell(plot, people, x, y, z) {
  const o = plot.origin;
  const bx0 = o.x + x, by0 = o.y + y, bz0 = o.z + z;
  for (const p of people || []) {
    const r = p.radius ?? TUNING.ruler.radius, h = p.height ?? TUNING.ruler.height;
    const [px, py, pz] = p.pos;
    if (px + r > bx0 && px - r < bx0 + 1 && pz + r > bz0 && pz - r < bz0 + 1 && py + h > by0 && py < by0 + 1) return true;
  }
  return false;
}

/**
 * Designation ghost for build (B) or weapon placement (G) mode: the cell on the targeted face,
 * plus whether designating it is allowed (inside the own plot, y in build limits, free, mount rule,
 * no person inside, under the open-designation cap, affordable).
 * @param {{target: PickTarget, plot: object, slot: number, yaw: number, gold: number, openDesignations: number,
 *   people?: Array<{pos: number[], radius?: number, height?: number}>,
 *   build: {mode: 'block'|'weapon', block?: number, weapon?: string, cost: number, footprint?: number[], mount?: string}}} q
 * @returns {null|{cell: number[], valid: boolean, reason: string, facing: number, cells: number[][]}}
 */
export function ghost(q) {
  const t = q.target;
  if (!t || (t.kind !== "block" && t.kind !== "designation") || !t.cell) return null;
  const n = t.normal || [0, 1, 0];
  const cell = [t.cell[0] + n[0], t.cell[1] + n[1], t.cell[2] + n[2]];
  const facing = facingFromYaw(q.yaw || 0);
  const out = (reason) => ({ cell, valid: reason === GHOST_REASON.OK, reason, facing, cells });
  const b = q.build;
  const isWeapon = b.mode === "weapon";
  const fp = isWeapon ? (b.footprint || [1, 1, 1]) : [1, 1, 1];
  const half = [Math.floor(fp[0] / 2), Math.floor(fp[1] / 2)];
  const cells = [];
  for (let dy = 0; dy < fp[2]; dy++) for (let dz = -half[1]; dz < fp[1] - half[1]; dz++) for (let dx = -half[0]; dx < fp[0] - half[0]; dx++) {
    cells.push([cell[0] + dx, cell[1] + dy, cell[2] + dz]);
  }
  if (!t.own) return out(GHOST_REASON.NOT_OWN);
  const W = TUNING.world;
  for (const [, y] of cells) if (y < W.buildMinY || y > W.buildMaxY) return out(GHOST_REASON.HEIGHT);
  const p = q.plot;
  for (const [x, y, z] of cells) if (!inPlot(p, x, y, z)) return out(GHOST_REASON.OUTSIDE);
  for (const [x, y, z] of cells) {
    const i = idx(p, x, y, z);
    if (p.type[i] !== BLOCK.AIR || (p.meta[i] & DESIGNATED_BIT)) return out(GHOST_REASON.OCCUPIED);
  }
  if (isWeapon) {
    for (const [x, y, z] of cells) {
      if (y !== cell[1]) continue;
      const below = y - 1 >= 0 ? p.type[idx(p, x, y - 1, z)] : BLOCK.AIR;
      if (b.mount === MOUNT.WALL ? below !== BLOCK.MOUNT : below === BLOCK.AIR) return out(GHOST_REASON.MOUNT);
    }
  }
  for (const [x, y, z] of cells) if (personInCell(p, q.people, x, y, z)) return out(GHOST_REASON.PERSON);
  if ((q.openDesignations | 0) >= W.maxOpenDesignations) return out(GHOST_REASON.CAP);
  if ((q.gold ?? 0) < (b.cost ?? 0)) return out(GHOST_REASON.GOLD);
  return out(GHOST_REASON.OK);
}

/** Plot cells per layer, re-exported for callers building indices. */
export const PLOT_LAYER = K.CELLS_PER_LAYER;
