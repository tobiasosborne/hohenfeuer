// src/ui/hud.js - owns the 2D HUD overlay: `createHud(canvas2d).draw(view)` (DESIGN 3.3, 3.4, 7.5; lane E entry point).
// Re-drawn from scratch after the 2001 stone-and-steel HUD (shot 04 is the weapon-view likeness
// reference): procedural stone/steel textures, self-drawn bitmap font, integer-pixel text. The
// frame art is painted once per console kind into an offscreen canvas; per-frame work is text,
// bars, readouts, compass, overview maps and the reticle. No Math.random, no clock: same view in,
// same pixels out.

import { CAMERA_MODE } from "../contracts.js";
import { TUNING } from "../tuning.js";
import { LAYOUT, letterbox } from "./layout.js";
import { t } from "./i18n.js";
import { drawText, drawTextIn } from "./font.js";
import { compassGeometry, drawCompass } from "./compass.js";
import { drawMinimap } from "./minimap.js";
import { drawMessages } from "./console.js";
import { drawMenu } from "./menus.js";
import { stoneTexture, steelTexture, meshTexture, roundRectPath, circlePath, bevelRect, rivet, tri, rgb } from "./paint.js";

const LW = TUNING.render.logicalW, LH = TUNING.render.logicalH;
const L = LAYOUT;

/**
 * @typedef {object} HudView
 * @property {string} [lang] 'de' | 'en'
 * @property {string} mode CAMERA_MODE
 * @property {number} [gold] @property {{now: number, start: number}} [pop] @property {{now: number, cap: number}} [weapons]
 * @property {number} [heading] camera heading, degrees clockwise from north
 * @property {{speed: number, dirDeg: number|null, prevDirDeg: number|null}} [wind] dirDeg = where the air blows to
 * @property {Array<{bearingDeg: number, ally?: boolean, color?: string}>} [enemies]
 * @property {null|{name: string, hpPct: number, az: number, range: number, reload: number, loaded: boolean,
 *   fireCost: number, affordable: boolean, autoFire?: boolean, crewOrdered?: boolean, restoreLit?: boolean}} [weapon]
 * @property {null|{value: number}} [morale] @property {null|{name: string, cost: number, valid?: boolean}} [selection]
 * @property {boolean} [shelterOn] @property {Array<{text: string, tone?: string}>} [messages]
 * @property {null|{title: string, name: string, castle: string, color?: string}} [enemyLabel]
 * @property {null|object} [minimapOwn] @property {null|object} [minimapEnemy] src/ui/minimap.js maps
 * @property {null|{predicted?: number[]}} [reticle] @property {object} [menu] src/ui/menus.js menu to draw on top
 */

/** Readout strings: direction floor(az/10) and range floor(range/10), three digits each (DESIGN 3.3). */
export function formatReadouts(az, range) {
  const dir = Math.floor(az / 10) % 360;
  const rng = Math.min(999, Math.floor(range / 10));
  return [String(dir).padStart(3, "0"), String(rng).padStart(3, "0")];
}

function defaultMakeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  if (typeof document !== "undefined") { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  return null;
}

/* ------------------------------------------------------------------ static frame art */

const C = {
  stone: [96, 88, 76], steel: [150, 144, 138], steelDark: [107, 104, 99], housing: [55, 47, 44],
  btnTop: [100, 94, 90], btnBot: [64, 60, 57], edge: "#2a2522", black: "#000000",
};

function makeTextures(makeCanvas) {
  const out = {};
  const gen = { stone: () => stoneTexture(LW, LH, 11, C.stone), steel: () => steelTexture(LW, LH, 12, C.steel), dark: () => steelTexture(LW, LH, 13, [98, 94, 90]), mesh: () => meshTexture(LW, LH, 14) };
  for (const [k, f] of Object.entries(gen)) {
    const c = makeCanvas(LW, LH);
    if (!c) return null;
    const cx = c.getContext("2d");
    const img = cx.createImageData(LW, LH);
    img.data.set(f());
    cx.putImageData(img, 0, 0);
    out[k] = c;
  }
  return out;
}

function painter(ctx, tex) {
  const pats = {};
  if (tex) for (const k of Object.keys(tex)) pats[k] = ctx.createPattern(tex[k], "no-repeat");
  return (name, flat) => { ctx.fillStyle = pats[name] || flat; };
}

function steelPlate(ctx, use, x0, y0, x1, y1, r) {
  roundRectPath(ctx, x0, y0, x1, y1, r); use("steel", rgb(C.steel)); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.45)";
  roundRectPath(ctx, x0 + 1.5, y0 + 1.5, x1 - 1.5, y1 - 1.5, r); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(30,26,22,0.85)";
  roundRectPath(ctx, x0 + 0.5, y0 + 0.5, x1 - 0.5, y1 - 0.5, r); ctx.stroke();
}

function mapBlock(ctx, use, sx0, sx1, fx0, fx1, inner) {
  roundRectPath(ctx, sx0, 548, sx1, 790, 16); use("stone", rgb(C.stone)); ctx.fill();
  ctx.fillStyle = "rgba(255,255,240,0.18)"; ctx.fillRect(sx0 + 8, 549, sx1 - sx0 - 16, 2);
  steelPlate(ctx, use, fx0, 566, fx1, 762, 12);
  ctx.fillStyle = C.black; ctx.fillRect(inner.x0, inner.y0, inner.x1 - inner.x0, inner.y1 - inner.y0);
  bevelRect(ctx, inner.x0 - 2, inner.y0 - 2, inner.x1 + 2, inner.y1 + 2, "#3b3734", "#e2ddd6", 2);
  for (const [x, y] of [[fx0 + 9, 575], [fx1 - 9, 575], [fx0 + 9, 753], [fx1 - 9, 753]]) {
    circlePath(ctx, x, y, 10); ctx.fillStyle = "#3a3633"; ctx.fill();
    rivet(ctx, x, y, 8);
  }
}

function capsule(ctx, r) {
  const cy = (r.y0 + r.y1) / 2, h = r.y1 - r.y0;
  roundRectPath(ctx, r.x0, r.y0, r.x1, r.y1, h / 2);
  ctx.fillStyle = C.edge; ctx.fill();
  roundRectPath(ctx, r.x0 + 2, r.y0 + 2, r.x1 - 2, r.y1 - 2, h / 2 - 2);
  const g = ctx.createLinearGradient(0, r.y0, 0, r.y1);
  g.addColorStop(0, rgb(C.btnTop)); g.addColorStop(1, rgb(C.btnBot));
  ctx.fillStyle = g; ctx.fill();
  for (const x of [r.x0 + h / 2, r.x1 - h / 2]) {
    circlePath(ctx, x, cy, h / 2 - 1); ctx.fillStyle = "#2f2b29"; ctx.fill();
    rivet(ctx, x, cy, h / 2 - 5, [160, 158, 150]);
  }
}

function barFrame(ctx, r) {
  ctx.fillStyle = "#24201e"; ctx.fillRect(r.x0 - 3, r.y0 - 3, r.x1 - r.x0 + 6, r.y1 - r.y0 + 6);
  bevelRect(ctx, r.x0 - 3, r.y0 - 3, r.x1 + 3, r.y1 + 3, "#4a4440", "#ece6de", 1);
}

function padStatic(ctx, use, walk) {
  const p = L.pad;
  const g = ctx.createRadialGradient(p.cx - 14, p.cy - 18, 6, p.cx, p.cy, p.r);
  g.addColorStop(0, "#d6cfc6"); g.addColorStop(0.75, "#9d958c"); g.addColorStop(1, "#5e5852");
  circlePath(ctx, p.cx, p.cy, p.r); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = "#3a3531"; ctx.stroke();
  circlePath(ctx, p.cx, p.cy, p.r - 9); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(60,54,50,0.6)"; ctx.stroke();
  if (walk) return;
  const a = 34, b = 13, w = 13;
  const light = "#dcd6ce", dark = "#6e6862";
  tri(ctx, p.cx, p.cy - a - 6, p.cx - w, p.cy - b - 6, p.cx + w, p.cy - b - 6, light);
  tri(ctx, p.cx, p.cy + a + 6, p.cx - w, p.cy + b + 6, p.cx + w, p.cy + b + 6, dark);
  tri(ctx, p.cx - a - 6, p.cy, p.cx - b - 6, p.cy - w, p.cx - b - 6, p.cy + w, light);
  tri(ctx, p.cx + a + 6, p.cy, p.cx + b + 6, p.cy - w, p.cx + b + 6, p.cy + w, dark);
  circlePath(ctx, L.fire.cx, L.fire.cy, L.fire.r + 4); ctx.fillStyle = "#4a4440"; ctx.fill();
}

function counterIcons(ctx) {
  // chest
  ctx.fillStyle = "#5a2e10"; ctx.fillRect(274, 14, 30, 20);
  ctx.fillStyle = "#9a5a22"; ctx.fillRect(276, 16, 26, 16);
  ctx.fillStyle = "#e8c040"; ctx.fillRect(276, 10, 26, 7);
  ctx.fillStyle = "#fff0a0"; ctx.fillRect(280, 10, 6, 3); ctx.fillRect(292, 11, 5, 2);
  ctx.fillStyle = "#3a1c08"; ctx.fillRect(274, 22, 30, 2); ctx.fillRect(288, 16, 3, 18);
  // person
  circlePath(ctx, 487, 13, 4); ctx.fillStyle = "#e8c8a0"; ctx.fill();
  ctx.fillStyle = "#4e6a3a"; ctx.fillRect(482, 18, 10, 10);
  ctx.fillStyle = "#c8c0b0"; ctx.fillRect(483, 18, 8, 3);
  ctx.fillStyle = "#3a3026"; ctx.fillRect(482, 28, 4, 7); ctx.fillRect(488, 28, 4, 7);
  // cannon
  ctx.save(); ctx.translate(670, 24); ctx.rotate(-0.25);
  ctx.fillStyle = "#2c2a28"; ctx.fillRect(-14, -5, 30, 10);
  ctx.fillStyle = "#4a4643"; ctx.fillRect(-14, -5, 30, 3);
  ctx.restore();
  for (const x of [662, 678]) { circlePath(ctx, x, 30, 6); ctx.fillStyle = "#6a3c1a"; ctx.fill(); circlePath(ctx, x, 30, 2); ctx.fillStyle = "#2a1808"; ctx.fill(); }
}

function compassRing(ctx, use) {
  const c = L.compass;
  circlePath(ctx, c.cx, c.cy, c.r); ctx.fillStyle = "#2e2f2b"; ctx.fill();
  circlePath(ctx, c.cx, c.cy, c.r - 2); ctx.fillStyle = "#4a4b46"; ctx.fill();
  ctx.strokeStyle = "#77786f"; ctx.lineWidth = 1.5;
  for (let i = 0; i < 64; i++) {
    const a = i * Math.PI / 32;
    ctx.beginPath();
    ctx.moveTo(c.cx + Math.sin(a) * (c.r - 12), c.cy - Math.cos(a) * (c.r - 12));
    ctx.lineTo(c.cx + Math.sin(a) * (c.r - 4), c.cy - Math.cos(a) * (c.r - 4));
    ctx.stroke();
  }
  circlePath(ctx, c.cx, c.cy, c.r - 14); ctx.fillStyle = "#1e1f1c"; ctx.fill();
  const g = ctx.createRadialGradient(c.cx, c.cy, 8, c.cx, c.cy, c.r - 16);
  g.addColorStop(0, "#aaa494"); g.addColorStop(1, "#77736a");
  circlePath(ctx, c.cx, c.cy, c.r - 16); ctx.fillStyle = g; ctx.fill();
  ctx.save(); circlePath(ctx, c.cx, c.cy, c.r - 16); ctx.clip();
  ctx.globalAlpha = 0.35; use("mesh", "#5a5e66"); ctx.fillRect(c.cx - c.r, c.cy - c.r, 2 * c.r, 2 * c.r); ctx.restore();
  ctx.globalAlpha = 1;
}

function infoBox(ctx, use) {
  roundRectPath(ctx, 6, 6, 256, 104, 6); use("mesh", "#3c4046"); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = "#48678e"; roundRectPath(ctx, 6, 6, 256, 104, 6); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = "#9ab4d6";
  for (let x = 10; x < 252; x += 6) { ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x + 3, 8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, 102); ctx.lineTo(x + 3, 106); ctx.stroke(); }
  for (const [x, y] of [[8, 8], [8, 102], [254, 8], [254, 102]]) rivet(ctx, x, y, 4);
  const b = L.infoBadge;
  const g = ctx.createRadialGradient(b.cx - 14, b.cy - 14, 4, b.cx, b.cy, b.r);
  g.addColorStop(0, "#f0ece6"); g.addColorStop(0.7, "#a8a29a"); g.addColorStop(1, "#4e4944");
  circlePath(ctx, b.cx, b.cy, b.r); ctx.fillStyle = g; ctx.fill();
  circlePath(ctx, b.cx, b.cy, b.r - 6); ctx.fillStyle = "#7a4a30"; ctx.fill();
  circlePath(ctx, b.cx, b.cy, b.r - 9); ctx.fillStyle = "#0e1420"; ctx.fill();
  // emblem: a small tower in the badge's blue
  ctx.fillStyle = "#3aa6e6";
  ctx.fillRect(b.cx - 10, b.cy - 8, 20, 24);
  for (let i = 0; i < 3; i++) ctx.fillRect(b.cx - 12 + i * 9, b.cy - 16, 6, 9);
  ctx.fillStyle = "#0e1420"; ctx.fillRect(b.cx - 4, b.cy + 6, 8, 10);
}

function sideButtons(ctx) {
  const rc = L.rightColumn;
  for (let i = 0; i < 10; i++) {
    const y = rc.y0 + 15 + i * 30;
    circlePath(ctx, 1016, y, 13); ctx.fillStyle = "#2e2c2a"; ctx.fill();
    rivet(ctx, 1016, y, 11, [120, 122, 122]);
    circlePath(ctx, 1016, y, 5); ctx.fillStyle = "#3a3c3c"; ctx.fill();
  }
  for (let i = 0; i < 2; i++) {
    const y = L.leftColumn.y0 + 16 + i * 32;
    circlePath(ctx, 8, y, 13); ctx.fillStyle = "#2e2c2a"; ctx.fill();
    rivet(ctx, 8, y, 11, [120, 122, 122]);
    circlePath(ctx, 8, y, 5); ctx.fillStyle = "#3cd25a"; ctx.fill();
  }
}

function paintStatic(ctx, tex, kind) {
  const use = painter(ctx, tex);
  const walk = kind === "walk";
  // console base
  ctx.save();
  ctx.beginPath(); ctx.rect(213, 572, 599, 203); use("stone", rgb(C.stone)); ctx.fill();
  ctx.fillStyle = "rgba(255,255,240,0.16)"; ctx.fillRect(213, 572, 599, 2);
  ctx.restore();
  mapBlock(ctx, use, -12, 232, 8, 204, L.leftMapInner);
  mapBlock(ctx, use, 795, 1036, 820, 1016, L.rightMapInner);
  steelPlate(ctx, use, 222, 590, 432, 728, 10);
  steelPlate(ctx, use, 590, 590, 802, 728, 10);
  for (const [x, y] of [[232, 600], [422, 600], [600, 600], [792, 600], [232, 652], [792, 652]]) rivet(ctx, x, y, 4);
  // centre arch
  steelPlate(ctx, use, 426, 566, 598, 734, 30);
  ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(452, 571, 120, 2);
  if (walk) {
    roundRectPath(ctx, L.moraleBox.x0 - 4, L.moraleBox.y0 - 4, L.moraleBox.x1 + 4, L.moraleBox.y1 + 4, 3); ctx.fillStyle = rgb(C.housing); ctx.fill();
    tri(ctx, L.moraleBox.x0 - 18, 610, L.moraleBox.x0 - 8, 603, L.moraleBox.x0 - 8, 617, "#3a3531");
    tri(ctx, L.moraleBox.x1 + 18, 610, L.moraleBox.x1 + 8, 603, L.moraleBox.x1 + 8, 617, "#3a3531");
  } else {
    roundRectPath(ctx, 444, 594, 576, 626, 3); ctx.fillStyle = rgb(C.housing); ctx.fill();
    // drag hints above the readouts: left-right and up-down double arrows
    tri(ctx, 472, 586, 477, 582, 477, 590, "#4a4440"); tri(ctx, 484, 586, 479, 582, 479, 590, "#4a4440");
    tri(ctx, 542, 580, 538, 585, 546, 585, "#4a4440"); tri(ctx, 542, 592, 538, 587, 546, 587, "#4a4440");
  }
  padStatic(ctx, use, walk);
  for (const [x, a0, a1] of [[446, Math.PI * 0.5, Math.PI * 1.5], [576, -Math.PI * 0.5, Math.PI * 0.5]]) {
    ctx.beginPath(); ctx.arc(x, 714, 18, a0, a1); ctx.closePath(); ctx.fillStyle = "#8a837c"; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = "#3a3531"; ctx.stroke();
  }
  for (const id of ["reloadBar", "weaponBar"]) barFrame(ctx, L[id]);
  for (const id of ["btnL1", "btnL2", "btnR1", "btnR2"]) capsule(ctx, L[id]);
  // info bar
  roundRectPath(ctx, 221, 725, 809, 760, 16); ctx.fillStyle = "#1c1a18"; ctx.fill();
  roundRectPath(ctx, 225, 728, 805, 757, 14); ctx.fillStyle = C.black; ctx.fill();
  for (const x of [229, 801]) rivet(ctx, x, 742, 7);
  counterIcons(ctx);
  compassRing(ctx, use);
  infoBox(ctx, use);
  sideButtons(ctx);
}

/* ------------------------------------------------------------------ dynamic parts */

function textBar(ctx, r, frac, fill, rest, label, note, textColor = "#141008") {
  const w = r.x1 - r.x0, h = r.y1 - r.y0;
  const fw = Math.round(w * Math.max(0, Math.min(1, frac)));
  ctx.fillStyle = rest; ctx.fillRect(r.x0, r.y0, w, h);
  if (fw > 0) {
    const g = ctx.createLinearGradient(0, r.y0, 0, r.y1);
    g.addColorStop(0, rgb(fill, 40)); g.addColorStop(0.5, rgb(fill)); g.addColorStop(1, rgb(fill, -40));
    ctx.fillStyle = g; ctx.fillRect(r.x0, r.y0, fw, h);
    ctx.fillStyle = "#24201e"; if (fw < w) ctx.fillRect(r.x0 + fw, r.y0, 2, h);
  }
  if (label) { drawTextIn(ctx, label, r, { bold: true, color: textColor }); note(label); }
}

function buttonLabel(ctx, r, label, lit, note) {
  if (lit) {
    const h = r.y1 - r.y0;
    roundRectPath(ctx, r.x0 + h / 2 + 8, r.y0 + 3, r.x1 - h / 2 - 8, r.y1 - 3, 8);
    const g = ctx.createLinearGradient(0, r.y0, 0, r.y1);
    g.addColorStop(0, "#fff6c0"); g.addColorStop(1, "#e2cc6a");
    ctx.fillStyle = g; ctx.fill();
  }
  if (!label) return;
  drawTextIn(ctx, label, r, { bold: true, color: "#120c08" });
  note(label);
}

function wheel(ctx, x0, y0, x1, y1, digit, note) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, "#4a463f"); g.addColorStop(0.3, "#cfcabd"); g.addColorStop(0.7, "#cfcabd"); g.addColorStop(1, "#4a463f");
  ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  drawTextIn(ctx, digit, { x0, y0, x1, y1 }, { scale: 2, outline: true, color: "#141210", outlineColor: "#f4f2ee" });
  note(digit);
}

function readouts(ctx, w, note) {
  const [dir, rng] = formatReadouts(w.az, w.range);
  const r = L.readouts;
  ctx.fillStyle = "#1a1715"; ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  for (let i = 0; i < 3; i++) wheel(ctx, L.readoutDir.x0 + i * 20 + 1, r.y0, L.readoutDir.x0 + i * 20 + 19, r.y1, dir[i], note);
  for (let i = 0; i < 3; i++) wheel(ctx, L.readoutRange.x0 + i * 20 + 1, r.y0, L.readoutRange.x0 + i * 20 + 19, r.y1, rng[i], note);
  ctx.fillStyle = "#d8d2c8"; ctx.fillRect(L.readoutDir.x1, r.y0 - 2, L.readoutRange.x0 - L.readoutDir.x1, r.y1 - r.y0 + 4);
  if (w.restoreLit) { ctx.strokeStyle = "#f0d860"; ctx.lineWidth = 2; ctx.strokeRect(r.x0 - 3, r.y0 - 3, r.x1 - r.x0 + 6, r.y1 - r.y0 + 6); }
  return [dir, rng];
}

function fireButton(ctx, loaded) {
  const f = L.fire;
  const g = ctx.createRadialGradient(f.cx - 4, f.cy - 4, 1, f.cx, f.cy, f.r);
  if (loaded) { g.addColorStop(0, "#ff8a7a"); g.addColorStop(0.5, "#e02a2a"); g.addColorStop(1, "#7a1010"); }
  else { g.addColorStop(0, "#c86a64"); g.addColorStop(0.5, "#a42a2a"); g.addColorStop(1, "#5a1010"); }
  circlePath(ctx, f.cx, f.cy, f.r); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = "#2a0c0c"; ctx.stroke();
  if (!loaded) {
    ctx.strokeStyle = "#e8c8c0"; ctx.lineWidth = 2;
    circlePath(ctx, f.cx, f.cy, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(f.cx - 5, f.cy + 5); ctx.lineTo(f.cx + 5, f.cy - 5); ctx.stroke();
  }
}

function emblem(ctx, color) {
  const p = L.emblem;
  ctx.beginPath();
  ctx.moveTo(p.cx - 22, p.cy - 26); ctx.lineTo(p.cx + 22, p.cy - 26); ctx.lineTo(p.cx + 22, p.cy + 2);
  ctx.quadraticCurveTo(p.cx + 20, p.cy + 22, p.cx, p.cy + 32);
  ctx.quadraticCurveTo(p.cx - 20, p.cy + 22, p.cx - 22, p.cy + 2);
  ctx.closePath();
  ctx.fillStyle = "#1a1614"; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = color; ctx.fillRect(p.cx - 22, p.cy - 26, 22, 29); ctx.fillRect(p.cx, p.cy + 3, 22, 30);
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = "#c8c0b4"; ctx.stroke();
}

function counter(ctx, r, text, red, note) {
  drawText(ctx, text, r.x0 + 40, (r.y0 + r.y1) / 2 - 8, { bold: true, outline: true, color: red ? "#ff3a2a" : "#ffffff" });
  note(text);
}

function reticle(ctx, view) {
  const c = L.reticle;
  if (view.mode === CAMERA_MODE.WEAPON || view.mode === CAMERA_MODE.IMPACT) {
    const py = view.reticle && view.reticle.predicted ? Math.round(view.reticle.predicted[1]) : c.cy;
    const px = view.reticle && view.reticle.predicted ? Math.round(view.reticle.predicted[0]) : c.cx;
    ctx.fillStyle = "#e6e6e6";
    ctx.fillRect(c.cx, 288, 1, 192);
    ctx.fillRect(px - 64, py, 128, 1);
  } else if (view.mode === CAMERA_MODE.WALK) {
    ctx.fillStyle = "#101010";
    ctx.fillRect(c.cx - 7, c.cy - 1, 15, 3); ctx.fillRect(c.cx - 1, c.cy - 7, 3, 15);
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(c.cx - 6, c.cy, 13, 1); ctx.fillRect(c.cx, c.cy - 6, 1, 13);
  }
}

function moraleColor(v) { return v >= 60 ? "#7ef06a" : v >= 30 ? "#f0d850" : "#ff5a3a"; }

/**
 * Lane E entry point (DESIGN 9). Accepts a canvas or its 2D context.
 * @param {HTMLCanvasElement|OffscreenCanvas|CanvasRenderingContext2D} canvas2d
 * @param {{createCanvas?: (w: number, h: number) => any}} [o] offscreen factory (null disables caching)
 */
export function createHud(canvas2d, o = {}) {
  const ctx = canvas2d.canvas && typeof canvas2d.fillRect === "function" ? canvas2d : canvas2d.getContext("2d");
  const makeCanvas = o.createCanvas === undefined ? defaultMakeCanvas : o.createCanvas;
  let tex;
  const statics = {};
  const frame = { texts: [], readouts: null };

  function staticFor(kind) {
    if (statics[kind] !== undefined) return statics[kind];
    if (tex === undefined) tex = makeCanvas ? makeTextures(makeCanvas) : null;
    const c = tex && makeCanvas ? makeCanvas(LW, LH) : null;
    if (c) paintStatic(c.getContext("2d"), tex, kind);
    statics[kind] = c;
    return c;
  }

  /** @param {HudView} view */
  function draw(view) {
    const v = view || { mode: CAMERA_MODE.WALK };
    const lang = v.lang || "de";
    const texts = [];
    const note = (s) => texts.push(s);
    const cw = ctx.canvas ? ctx.canvas.width : LW, ch = ctx.canvas ? ctx.canvas.height : LH;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const lb = letterbox(cw, ch);
    ctx.setTransform(lb.scale, 0, 0, lb.scale, lb.x, lb.y);
    ctx.imageSmoothingEnabled = false;
    frame.readouts = null;

    const weaponMode = v.mode === CAMERA_MODE.WEAPON || v.mode === CAMERA_MODE.IMPACT;
    const showConsole = v.mode !== CAMERA_MODE.DEATH;
    if (showConsole) {
      const kind = weaponMode ? "weapon" : "walk";
      const s = staticFor(kind);
      if (s) ctx.drawImage(s, 0, 0); else paintStatic(ctx, null, kind);

      if (v.gold !== undefined) counter(ctx, L.topGold, String(v.gold), false, note);
      if (v.pop) counter(ctx, L.topPop, `${v.pop.now} (${v.pop.start})`, v.pop.now >= v.pop.start, note);
      if (v.weapons) counter(ctx, L.topWeapons, `${v.weapons.now} (${v.weapons.cap})`, v.weapons.now >= v.weapons.cap, note);

      drawCompass(ctx, compassGeometry({ heading: v.heading || 0, wind: v.wind, enemies: v.enemies, lang }), note);
      drawMessages(ctx, L.infoText, v.messages || [], note);
      if (v.enemyLabel) {
        const e = v.enemyLabel, r = L.enemyLabel;
        drawText(ctx, e.title, r.x1, r.y0, { bold: true, outline: true, color: "#f0c8c8", align: "right" });
        drawText(ctx, e.name, r.x1, r.y0 + 18, { bold: true, outline: true, color: e.color || "#3cc83c", align: "right" });
        drawText(ctx, e.castle, r.x1, r.y0 + 36, { bold: true, outline: true, align: "right" });
        note(e.title); note(e.name); note(e.castle);
      }
      drawMinimap(ctx, L.leftMapInner, v.minimapOwn || null);
      drawMinimap(ctx, L.rightMapInner, v.minimapEnemy || null, { enemy: true });

      if (weaponMode) {
        const w = v.weapon || { name: "", hpPct: 0, az: 0, range: 0, reload: 0, loaded: false, fireCost: 0, affordable: true };
        frame.readouts = readouts(ctx, w, note);
        if (w.loaded) {
          textBar(ctx, L.reloadBar, 1, [214, 156, 34], "#8c8c8c", t("fireCost", lang, { cost: w.fireCost }), note, w.affordable ? "#141008" : "#c01010");
        } else {
          textBar(ctx, L.reloadBar, w.reload, [222, 156, 100], "#a4a4a4", t("reloading", lang), note);
        }
        textBar(ctx, L.weaponBar, w.hpPct / 100, [86, 168, 212], "#5a5a5a", t("weaponCondition", lang, { name: w.name, pct: Math.round(w.hpPct) }), note);
        buttonLabel(ctx, L.btnL1, t("fireAtWill", lang), !!w.autoFire, note);
        buttonLabel(ctx, L.btnL2, t("crew", lang), !!w.crewOrdered, note);
        buttonLabel(ctx, L.btnR1, t("restore", lang), !!w.restoreLit, note);
        buttonLabel(ctx, L.btnR2, t("impactView", lang), v.mode === CAMERA_MODE.IMPACT, note);
        fireButton(ctx, !!w.loaded);
      } else {
        const m = v.morale ? Math.round(v.morale.value) : null;
        const mb = L.moraleBox;
        ctx.fillStyle = "#1a1715"; ctx.fillRect(mb.x0, mb.y0, mb.x1 - mb.x0, mb.y1 - mb.y0);
        if (m !== null) { const s = `${m}%`; drawTextIn(ctx, s, mb, { bold: true, outline: true, color: moraleColor(m) }); note(s); }
        emblem(ctx, v.castleColor || "#c82020");
        const sel = v.selection;
        if (sel) textBar(ctx, L.selectionBar, 1, sel.valid === false ? [200, 70, 50] : [70, 190, 80], "#5a5a5a", t("cost", lang, { name: sel.name, cost: sel.cost }), note);
        else textBar(ctx, L.selectionBar, 0, [0, 0, 0], "#6a6a6a", "", note);
        textBar(ctx, L.statusBar, v.shelterOn ? 1 : 0, [86, 168, 212], "#6a6a6a", v.shelterOn ? t("shelter", lang) : "", note);
        buttonLabel(ctx, L.btnL1, t("demolish", lang), false, note);
        buttonLabel(ctx, L.btnL2, t("repair", lang), false, note);
        buttonLabel(ctx, L.btnR1, t("build", lang), false, note);
        buttonLabel(ctx, L.btnR2, t("shelter", lang), !!v.shelterOn, note);
      }
    }
    reticle(ctx, v);
    if (v.menu) drawMenu(ctx, v.menu);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    frame.texts = texts;
  }

  return { draw, get frame() { return frame; }, ctx };
}
