// src/ui/minimap.js - owns the two console overview maps: own castle top-down and the targeted enemy castle.
// topDown is pure (plot grid -> per-column colour codes, DESIGN 7.5 / EN p.25); drawMinimap paints it.

import { BLOCK } from "../contracts.js";
import { TUNING } from "../tuning.js";
import { circlePath } from "./paint.js";

/** Per-column codes. */
export const MAP_CODE = Object.freeze({ EMPTY: 0, BLOCK: 1, DAMAGED1: 2, DAMAGED2: 3, DAMAGED3: 4, WEAPON: 5, DESIGNATED: 6 });
const DESIGNATED_BIT = 1 << 5;
const KEY_BY_ID = Object.fromEntries(Object.entries(BLOCK).map(([k, v]) => [v, k.toLowerCase()]));
const maxHpOf = (id) => { const b = TUNING.blocks[KEY_BY_ID[id]]; return b && b.hp ? b.hp : 0; };
const above = TUNING.damageStateAbove;

/**
 * Top-most block per (x, z) column above the foundation; damage state by hp fraction; weapons
 * (footprint centred on `cell`) blue; open designations marked.
 * @param {{width: number, height: number, depth: number, type: Uint8Array, hp: Uint8Array, meta: Uint8Array}} plot
 * @param {Array<{cell: number[], footprint?: number[]}>} [weapons]
 * @returns {{w: number, d: number, codes: Uint8Array}}
 */
export function topDown(plot, weapons = []) {
  const w = plot.width, d = plot.depth, layer = w * d;
  const codes = new Uint8Array(w * d);
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    let code = MAP_CODE.EMPTY;
    for (let y = plot.height - 1; y >= 1; y--) {
      const i = x + w * z + layer * y;
      const id = plot.type[i];
      if (id === BLOCK.AIR) { if (plot.meta[i] & DESIGNATED_BIT) { code = MAP_CODE.DESIGNATED; break; } continue; }
      const max = maxHpOf(id);
      const f = max > 0 && max < 255 ? plot.hp[i] / max : 1;
      code = f > above[0] ? MAP_CODE.BLOCK : f > above[1] ? MAP_CODE.DAMAGED1 : f > above[2] ? MAP_CODE.DAMAGED2 : MAP_CODE.DAMAGED3;
      break;
    }
    codes[x + w * z] = code;
  }
  for (const wp of weapons) {
    const fw = (wp.footprint && wp.footprint[0]) || 1, fd = (wp.footprint && wp.footprint[1]) || 1;
    const hx = Math.floor(fw / 2), hz = Math.floor(fd / 2);
    for (let dz = -hz; dz < fd - hz; dz++) for (let dx = -hx; dx < fw - hx; dx++) {
      const x = wp.cell[0] + dx, z = wp.cell[2] + dz;
      if (x >= 0 && x < w && z >= 0 && z < d) codes[x + w * z] = MAP_CODE.WEAPON;
    }
  }
  return { w, d, codes };
}

const COLORS = ["#000000", "#62d662", "#a6c24e", "#d08a3c", "#d6402e", "#5ab4e6", "#e6d25a"];
/** Severity order when 2 x 2 plot cells share one overview square (worst wins, weapons on top). */
const RANK = [0, 1, 2, 3, 4, 6, 5];
/** Overview grid pitch (px) and size in pitches, measured on the original overview maps. */
export const MAP_PITCH = 5;
const ZONE_W = 32, ZONE_H = 24;

/** Downsample per-column codes 2:1 (one 5 px square per 2 x 2 plot cells). */
export function binCodes(map) {
  const bw = Math.ceil(map.w / 2), bd = Math.ceil(map.d / 2);
  const out = new Uint8Array(bw * bd);
  for (let z = 0; z < map.d; z++) for (let x = 0; x < map.w; x++) {
    const c = map.codes[x + map.w * z], i = (x >> 1) + bw * (z >> 1);
    if (RANK[c] > RANK[out[i]]) out[i] = c;
  }
  return { w: bw, d: bd, codes: out };
}

/**
 * Paint an overview map into `rect` (the inner black area): a 32 x 24 grid of 5 px pitches and one
 * square per 2 x 2 plot cells, centred; no grid when there is nothing to show (as the original).
 * @param {CanvasRenderingContext2D} ctx @param {{x0: number, y0: number, x1: number, y1: number}} rect
 * @param {null|{w: number, d: number, codes: Uint8Array, craters?: Array<{x: number, z: number, r: number}>,
 *   missArrowDeg?: number|null}} map @param {{enemy?: boolean}} [o]
 */
export function drawMinimap(ctx, rect, map, o = {}) {
  const W = rect.x1 - rect.x0, H = rect.y1 - rect.y0;
  if (!map) return;
  const P = MAP_PITCH;
  const zx = rect.x0 + Math.floor((W - ZONE_W * P) / 2), zy = rect.y0 + Math.floor((H - ZONE_H * P) / 2);
  ctx.fillStyle = "#080808"; ctx.fillRect(zx, zy, ZONE_W * P, ZONE_H * P);
  ctx.fillStyle = "#3e3e3e";
  for (let i = 0; i <= ZONE_W; i++) ctx.fillRect(zx + i * P, zy, 1, ZONE_H * P);
  for (let j = 0; j <= ZONE_H; j++) ctx.fillRect(zx, zy + j * P, ZONE_W * P, 1);
  const b = binCodes(map);
  const ox = zx + Math.floor((ZONE_W - b.w) / 2) * P, oy = zy + Math.floor((ZONE_H - b.d) / 2) * P;
  for (let z = 0; z < b.d; z++) for (let x = 0; x < b.w; x++) {
    const c = b.codes[x + b.w * z];
    if (!c) continue;
    ctx.fillStyle = o.enemy && c !== MAP_CODE.DESIGNATED ? COLORS[MAP_CODE.BLOCK] : COLORS[c];
    ctx.fillRect(ox + x * P, oy + z * P, P, P);
  }
  const cell = P / 2;
  for (const cr of map.craters || []) {
    circlePath(ctx, ox + (cr.x + 0.5) * cell, oy + (cr.z + 0.5) * cell, Math.max(2, cr.r * P));
    ctx.fillStyle = "rgba(170,170,170,0.75)"; ctx.fill();
  }
  if (map.missArrowDeg !== null && map.missArrowDeg !== undefined) {
    const a = map.missArrowDeg * Math.PI / 180, cx = ox + b.w * P / 2, cy = oy + b.d * P / 2, R = b.w * P / 2 - 4;
    const tx = cx + Math.sin(a) * R, ty = cy - Math.cos(a) * R;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - Math.sin(a) * 9 + Math.cos(a) * 5, ty + Math.cos(a) * 9 + Math.sin(a) * 5);
    ctx.lineTo(tx - Math.sin(a) * 9 - Math.cos(a) * 5, ty + Math.cos(a) * 9 - Math.sin(a) * 5);
    ctx.closePath(); ctx.fillStyle = "#d0d0d0"; ctx.fill();
  }
}
