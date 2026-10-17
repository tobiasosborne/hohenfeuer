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

/**
 * Paint an overview map into `rect` (the inner black area).
 * @param {CanvasRenderingContext2D} ctx @param {{x0: number, y0: number, x1: number, y1: number}} rect
 * @param {null|{w: number, d: number, codes: Uint8Array, craters?: Array<{x: number, z: number, r: number}>,
 *   missArrowDeg?: number|null}} map @param {{enemy?: boolean}} [o]
 */
export function drawMinimap(ctx, rect, map, o = {}) {
  const W = rect.x1 - rect.x0, H = rect.y1 - rect.y0;
  ctx.fillStyle = "#000000"; ctx.fillRect(rect.x0, rect.y0, W, H);
  const n = map ? Math.max(map.w, map.d) : 48;
  const cell = Math.max(1, Math.floor(Math.min(W, H) / n));
  const ox = rect.x0 + Math.floor((W - cell * n) / 2), oy = rect.y0 + Math.floor((H - cell * n) / 2);
  ctx.fillStyle = "#262626";
  for (let i = 0; i <= n; i += 2) {
    ctx.fillRect(ox + i * cell, oy, 1, cell * n);
    ctx.fillRect(ox, oy + i * cell, cell * n, 1);
  }
  if (!map) return;
  for (let z = 0; z < map.d; z++) for (let x = 0; x < map.w; x++) {
    const c = map.codes[x + map.w * z];
    if (!c) continue;
    ctx.fillStyle = o.enemy && c !== MAP_CODE.DESIGNATED ? COLORS[MAP_CODE.BLOCK] : COLORS[c];
    ctx.fillRect(ox + x * cell, oy + z * cell, cell, cell);
  }
  for (const cr of map.craters || []) {
    circlePath(ctx, ox + (cr.x + 0.5) * cell, oy + (cr.z + 0.5) * cell, Math.max(2, cr.r * cell));
    ctx.fillStyle = "rgba(170,170,170,0.75)"; ctx.fill();
  }
  if (map.missArrowDeg !== null && map.missArrowDeg !== undefined) {
    const a = map.missArrowDeg * Math.PI / 180, cx = ox + cell * n / 2, cy = oy + cell * n / 2, R = cell * n / 2 - 4;
    const tx = cx + Math.sin(a) * R, ty = cy - Math.cos(a) * R;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - Math.sin(a) * 9 + Math.cos(a) * 5, ty + Math.cos(a) * 9 + Math.sin(a) * 5);
    ctx.lineTo(tx - Math.sin(a) * 9 - Math.cos(a) * 5, ty + Math.cos(a) * 9 - Math.sin(a) * 5);
    ctx.closePath(); ctx.fillStyle = "#d0d0d0"; ctx.fill();
  }
}
