// src/ui/compass.js - owns the compass: heading-relative letters, wind hub number, red/blue wind arrows, enemy icons.
// compassGeometry is pure (DESIGN 3.4 / 7.5, EN p.24); drawCompass paints it with canvas 2D.
// Screen angles are degrees clockwise from screen-up; screen-up is the camera heading, so an
// enemy icon straight above the rose means "looking at it" (EN p.28).

import { TUNING } from "../tuning.js";
import { LAYOUT } from "./layout.js";
import { t } from "./i18n.js";
import { drawText } from "./font.js";
import { circlePath, rgb, tri } from "./paint.js";

/** Radius of the N/O/S/W letter ring (measured: letters sit ~96 px from the hub). */
export const LETTER_RADIUS = 96;
/** Radius of the enemy crown icons. */
export const ICON_RADIUS = 84;
const D2R = Math.PI / 180;

const wrap180 = (a) => { let v = ((a % 360) + 360) % 360; if (v > 180) v -= 360; return v; };
const polar = (c, r, a) => ({ x: c.cx + r * Math.sin(a * D2R), y: c.cy - r * Math.cos(a * D2R) });

/**
 * @param {{heading: number, wind?: {speed: number, dirDeg: number|null, prevDirDeg: number|null},
 *   enemies?: Array<{bearingDeg: number, ally?: boolean, color?: string}>, lang?: string}} v
 * @returns {{letters: Array<{key: string, text: string, angle: number, x: number, y: number}>,
 *   hub: string, red: number|null, blue: number|null, rose: number,
 *   icons: Array<{angle: number, x: number, y: number, ally: boolean, color: string}>}}
 */
export function compassGeometry(v) {
  const c = LAYOUT.compass;
  const heading = v.heading || 0;
  const letters = [["dirN", 0], ["dirE", 90], ["dirS", 180], ["dirW", 270]].map(([key, b]) => {
    const angle = wrap180(b - heading);
    return { key, text: t(key, v.lang), angle, ...polar(c, LETTER_RADIUS, angle) };
  });
  const w = v.wind || { speed: 0, dirDeg: null, prevDirDeg: null };
  const red = w.dirDeg === null || w.dirDeg === undefined || w.speed < TUNING.wind.redArrowMinSpeed ? null : wrap180(w.dirDeg - heading);
  const blue = w.prevDirDeg === null || w.prevDirDeg === undefined ? null : wrap180(w.prevDirDeg - heading);
  const icons = (v.enemies || []).map((e) => {
    const angle = wrap180(e.bearingDeg - heading);
    return { angle, ...polar(c, ICON_RADIUS, angle), ally: !!e.ally, color: e.color || "#30c030" };
  });
  return { letters, hub: String(Math.round(w.speed || 0)), red, blue, rose: wrap180(-heading), icons };
}

/** Wind arrow on the rim pointing outward along screen angle a. */
function windArrow(ctx, c, a, fill, edge) {
  const r0 = c.r - 6, r1 = c.r + 16, half = 7;
  const tip = polar(c, r1, a), base = polar(c, r0, a);
  const nx = Math.cos(a * D2R) * half, ny = Math.sin(a * D2R) * half;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(base.x + nx, base.y + ny);
  ctx.lineTo(base.x - nx, base.y - ny);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = edge; ctx.stroke();
}

/** Small crown icon (enemy castle marker). */
function crown(ctx, x, y, color, ally) {
  const pts = [[-8, 6], [-8, -4], [-4, 0], [0, -8], [4, 0], [8, -4], [8, 6]];
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px, y + py) : ctx.moveTo(x + px, y + py)));
  ctx.closePath();
  if (!ally) { ctx.fillStyle = color; ctx.fill(); }
  ctx.lineWidth = 1.5; ctx.strokeStyle = ally ? color : "#0b2a0b"; ctx.stroke();
}

/** Grey for a rose facet facing screen angle `face`, lit from the top (slightly left). */
function facet(face, lo, hi) {
  const v = Math.cos((face - 330) * D2R);
  const g = Math.round(lo + (hi - lo) * (v + 1) / 2);
  return `rgb(${g},${g},${Math.round(g * 0.97)})`;
}

/** One rose point: a kite split in two facets shaded by the direction they face. */
function rosePoint(ctx, c, a, len, width, lo, hi) {
  const tip = polar(c, len, a);
  const l = polar(c, width, a - 45), r = polar(c, width, a + 45);
  tri(ctx, c.cx, c.cy, tip.x, tip.y, l.x, l.y, facet(a - 30, lo, hi));
  tri(ctx, c.cx, c.cy, tip.x, tip.y, r.x, r.y, facet(a + 30, lo, hi));
}

/**
 * Paint the dynamic compass (rose, letters, arrows, hub, icons). The ring is painted by hud.js's
 * static layer. @param {CanvasRenderingContext2D} ctx @param {ReturnType<typeof compassGeometry>} g
 * @param {(s: string) => void} [note] records drawn text
 */
export function drawCompass(ctx, g, note = () => {}) {
  const c = LAYOUT.compass;
  for (const a of [45, 135, 225, 315]) rosePoint(ctx, c, g.rose + a, 47, 10, 24, 190);
  for (const a of [0, 90, 180, 270]) rosePoint(ctx, c, g.rose + a, a === 0 ? 74 : 68, 13, 18, 236);
  // hub with a bead ring
  circlePath(ctx, c.cx, c.cy, 19); ctx.fillStyle = "#262626"; ctx.fill();
  for (let i = 0; i < 18; i++) {
    const p = polar(c, 16, i * 20);
    circlePath(ctx, p.x, p.y, 2.2); ctx.fillStyle = rgb([104, 102, 98]); ctx.fill();
  }
  circlePath(ctx, c.cx, c.cy, 12); ctx.fillStyle = "#3a3a3a"; ctx.fill();
  circlePath(ctx, c.cx, c.cy, 10); ctx.fillStyle = "#0e0e0e"; ctx.fill();
  drawText(ctx, g.hub, c.cx, c.cy - 8, { bold: true, outline: true, align: "center" });
  note(g.hub);
  if (g.blue !== null) windArrow(ctx, c, g.blue, "#3c78e6", "#0d1f4a");
  if (g.red !== null) windArrow(ctx, c, g.red, "#e03424", "#4a0d08");
  for (const ic of g.icons) crown(ctx, ic.x, ic.y, ic.color, ic.ally);
  for (const l of g.letters) {
    drawText(ctx, l.text, l.x, l.y - 8, { bold: true, outline: true, align: "center" });
    note(l.text);
  }
}
