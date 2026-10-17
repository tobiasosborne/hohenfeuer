// src/ui/frame.js - owns the static HUD frame art (stone band, steel console plates, map frames, compass ring, info box).
// Painted once per console kind into an offscreen canvas by hud.js. Geometry and fill colours are
// measured off the original 1024 x 768 weapon-view and castle-view captures (positions and mean
// colours only); every shape is drawn here from paths, gradients and hash-noise textures.

import { TUNING } from "../tuning.js";
import { LAYOUT } from "./layout.js";
import { stoneTexture, steelTexture, meshTexture, roundRectPath, circlePath, rivet, tri, rgb } from "./paint.js";

const LW = TUNING.render.logicalW, LH = TUNING.render.logicalH;
const L = LAYOUT;

/** Palette (mean colours measured per element on the reference captures). */
export const PAL = Object.freeze({
  stone: [80, 78, 67], stoneLit: [112, 104, 84],
  steel: [150, 144, 138], steelLit: [190, 183, 176], steelMid: [120, 113, 107], steelDark: [62, 59, 56],
  plate: [156, 141, 130], plateLit: [182, 170, 162],
  recess: [104, 98, 92], btn: [74, 69, 66], btnEnd: [58, 56, 53],
  outline: "#24201d", housing: [122, 107, 99],
});

/** Generate the procedural textures as canvases, or null when no canvas factory is available. */
export function makeTextures(makeCanvas) {
  const gen = {
    stone: () => stoneTexture(LW, LH, 11, PAL.stone),
    steel: () => steelTexture(LW, LH, 12, PAL.steel),
    plate: () => steelTexture(LW, LH, 13, PAL.plate),
    mesh: () => meshTexture(LW, LH, 14, [26, 28, 32]),
  };
  const out = {};
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

/** Overlay a vertical light gradient on the current path (keeps the texture underneath). */
function shade(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g; ctx.fill();
}

/* ------------------------------------------------------------------ stone band */

function stoneBand(ctx, use) {
  // left and right map blocks rise to y 548, the console stone to y 576
  ctx.beginPath();
  ctx.moveTo(0, 550); ctx.lineTo(206, 548); ctx.lineTo(214, 556); ctx.lineTo(214, 576);
  ctx.lineTo(810, 576); ctx.lineTo(810, 556); ctx.lineTo(818, 548); ctx.lineTo(1024, 550);
  ctx.lineTo(1024, 768); ctx.lineTo(0, 768); ctx.closePath();
  use("stone", rgb(PAL.stone)); ctx.fill();
  // lit, mossy top courses
  ctx.save(); ctx.clip();
  const lit = ctx.createLinearGradient(0, 548, 0, 600);
  lit.addColorStop(0, "rgba(190,175,130,0.38)"); lit.addColorStop(1, "rgba(190,175,130,0)");
  ctx.fillStyle = lit; ctx.fillRect(0, 548, 214, 52); ctx.fillRect(810, 548, 214, 52);
  const lit2 = ctx.createLinearGradient(0, 576, 0, 600);
  lit2.addColorStop(0, "rgba(190,175,130,0.42)"); lit2.addColorStop(1, "rgba(190,175,130,0.08)");
  ctx.fillStyle = lit2; ctx.fillRect(214, 576, 596, 24);
  const low = ctx.createLinearGradient(0, 700, 0, 768);
  low.addColorStop(0, "rgba(0,0,0,0)"); low.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = low; ctx.fillRect(0, 700, 1024, 68);
  ctx.restore();
  ctx.fillStyle = "rgba(230,220,190,0.35)"; ctx.fillRect(0, 549, 206, 1); ctx.fillRect(818, 549, 206, 1); ctx.fillRect(214, 576, 596, 1);
}

/* ------------------------------------------------------------------ map frames */

/**
 * Steel picture frame lit from the top-left (measured profile): bright top bar, mid left bar,
 * dark right and bottom bars with a thin inner highlight, bolts in the corners.
 * @param {number} ox0 outer left @param {number} ox1 outer right @param {{x0: number, x1: number}} inner
 */
function mapFrame(ctx, ox0, ox1, inner) {
  const ix0 = inner.x0 + 1, ix1 = inner.x1 - 3, iy0 = 585, iy1 = 746;
  ctx.fillStyle = rgb([74, 72, 68]); ctx.fillRect(ox0, 568, ox1 - ox0, 3);
  ctx.fillStyle = rgb([205, 199, 192]); ctx.fillRect(ox0, 571, ox1 - ox0, 12);
  ctx.fillStyle = rgb([34, 32, 30]); ctx.fillRect(ox0, 583, ox1 - ox0, 2);
  ctx.fillStyle = rgb([134, 130, 125]); ctx.fillRect(ox0, 585, ix0 - ox0, iy1 - 585);
  ctx.fillStyle = rgb([40, 37, 35]); ctx.fillRect(ix0 - 2, 585, 2, iy1 - 585);
  ctx.fillStyle = rgb([148, 144, 138]); ctx.fillRect(ix1, 585, 2, iy1 - 585);
  ctx.fillStyle = rgb([30, 28, 27]); ctx.fillRect(ix1 + 2, 585, ox1 - ix1 - 2, iy1 - 585);
  ctx.fillStyle = rgb([186, 181, 175]); ctx.fillRect(ox0, iy1, ox1 - ox0, 2);
  ctx.fillStyle = rgb([25, 23, 22]); ctx.fillRect(ox0, iy1 + 2, ox1 - ox0, 12);
  ctx.fillStyle = "#000000"; ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
  for (const [x, y] of [[ox0 + 7, 576], [ox1 - 7, 576], [ox0 + 7, 753], [ox1 - 7, 753]]) {
    circlePath(ctx, x, y, 10); ctx.fillStyle = "#24211e"; ctx.fill();
    rivet(ctx, x, y, 8, [150, 148, 144]);
  }
}

/* ------------------------------------------------------------------ console */

/**
 * Side plate (measured profile): dark top rim, bright rail, black recess around the bar, bright
 * rail below it, mid-grey field behind the buttons, light frame column with bevelled corner blocks.
 */
function sidePlate(ctx, use, x0, x1, mirror) {
  const y0 = 596, y1 = 734;
  ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); use("steel", rgb(PAL.steel)); ctx.fill();
  ctx.fillStyle = "rgba(40,36,32,0.42)"; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const cx0 = mirror ? x1 - 24 : x0, cx1 = mirror ? x1 : x0 + 24; // frame column
  const rx0 = mirror ? x0 + 6 : x0 + 24, rx1 = mirror ? x1 - 24 : x1 - 6; // rail span
  ctx.fillStyle = rgb([72, 70, 66]); ctx.fillRect(x0, y0, x1 - x0, 8);
  ctx.fillStyle = rgb([153, 148, 142]); ctx.fillRect(rx0, 604, rx1 - rx0, 1);
  ctx.fillStyle = rgb([70, 66, 62]); ctx.fillRect(rx0, 605, rx1 - rx0, 2);
  ctx.fillStyle = rgb([208, 202, 196]); ctx.fillRect(rx0, 607, rx1 - rx0, 7);
  ctx.fillStyle = rgb([132, 126, 120]); ctx.fillRect(rx0, 614, rx1 - rx0, 3);
  ctx.fillStyle = rgb([34, 31, 29]); ctx.fillRect(rx0, 617, rx1 - rx0, 31);
  ctx.fillStyle = rgb([204, 198, 192]); ctx.fillRect(rx0, 648, rx1 - rx0, 7);
  ctx.fillStyle = rgb([116, 110, 104]); ctx.fillRect(rx0, 655, rx1 - rx0, 4);
  ctx.fillStyle = rgb([110, 104, 98]); ctx.fillRect(rx0, 659, rx1 - rx0, 64);
  ctx.fillStyle = rgb([108, 102, 96]); ctx.fillRect(x0, 723, x1 - x0, 7);
  // frame column with bevelled corner blocks
  const g = ctx.createLinearGradient(cx0, 0, cx1, 0);
  g.addColorStop(0, mirror ? "#6a645e" : "#9c958d"); g.addColorStop(1, mirror ? "#2c2925" : "#6a645e");
  ctx.fillStyle = g; ctx.fillRect(cx0, 612, cx1 - cx0, 111);
  for (const by of [598, 645]) {
    ctx.beginPath();
    ctx.moveTo(cx0 + 4, by); ctx.lineTo(cx1 - 4, by); ctx.lineTo(cx1, by + 4); ctx.lineTo(cx1, by + 20);
    ctx.lineTo(cx1 - 4, by + 24); ctx.lineTo(cx0 + 4, by + 24); ctx.lineTo(cx0, by + 20); ctx.lineTo(cx0, by + 4); ctx.closePath();
    const bg = ctx.createLinearGradient(cx0, by, cx1, by + 24);
    if (mirror) { bg.addColorStop(0, "#b0a9a1"); bg.addColorStop(0.5, "#6e6862"); bg.addColorStop(1, "#2e2a26"); }
    else { bg.addColorStop(0, "#f0ebe4"); bg.addColorStop(0.55, "#b8b0a8"); bg.addColorStop(1, "#5a544e"); }
    ctx.fillStyle = bg; ctx.fill();
    rivet(ctx, (cx0 + cx1) / 2, by + 12, 4, [120, 116, 110]);
  }
  ctx.fillStyle = "rgba(20,18,16,0.85)"; ctx.fillRect(mirror ? x1 - 1 : x0, y0, 1, y1 - y0);
}

function barFrame(ctx, r) {
  ctx.fillStyle = "#000000"; ctx.fillRect(r.x0 - 3, r.y0, r.x1 - r.x0 + 6, r.y1 - r.y0 + 2);
}

/** Button plate: capsule with ornate round ends; enabled castle-view buttons are lighter (castle-view capture). */
function capsule(ctx, r, enabled = false) {
  const cy = (r.y0 + r.y1) / 2, h = r.y1 - r.y0;
  roundRectPath(ctx, r.x0, r.y0 - 1, r.x1, r.y1, h / 2); ctx.fillStyle = "#000000"; ctx.fill();
  ctx.fillStyle = rgb([110, 104, 99]); ctx.fillRect(r.x0 + 14, r.y0, r.x1 - r.x0 - 28, 3);
  ctx.fillStyle = "#1c1916"; ctx.fillRect(r.x0 + 14, r.y1 - 4, r.x1 - r.x0 - 28, 3);
  roundRectPath(ctx, r.x0 + 12, r.y0 + 3, r.x1 - 12, r.y1 - 4, 6);
  const g = ctx.createLinearGradient(0, r.y0, 0, r.y1);
  const tone = enabled ? 52 : 0;
  g.addColorStop(0, rgb(PAL.btn, 2 + tone)); g.addColorStop(1, rgb(PAL.btn, -4 + tone));
  ctx.fillStyle = g; ctx.fill();
  for (const x of [r.x0 + h / 2, r.x1 - h / 2]) {
    circlePath(ctx, x, cy, h / 2 - 1); ctx.fillStyle = rgb(PAL.btnEnd); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#8c8780"; circlePath(ctx, x, cy, h / 2 - 5); ctx.stroke();
    rivet(ctx, x, cy, 6, [120, 124, 122]);
  }
}

/** Centre arch plate with the shoulder notch. */
function arch(ctx, use) {
  ctx.beginPath();
  ctx.moveTo(428, 736); ctx.lineTo(428, 600);
  ctx.quadraticCurveTo(428, 566, 462, 566);
  ctx.lineTo(500, 566); ctx.quadraticCurveTo(504, 572, 511, 572); ctx.quadraticCurveTo(518, 572, 522, 566);
  ctx.lineTo(562, 566); ctx.quadraticCurveTo(596, 566, 596, 600); ctx.lineTo(596, 736); ctx.closePath();
  ctx.fillStyle = PAL.outline; ctx.fill();
  ctx.save(); ctx.translate(0, 0);
  ctx.beginPath();
  ctx.moveTo(430, 736); ctx.lineTo(430, 601);
  ctx.quadraticCurveTo(430, 568, 463, 568);
  ctx.lineTo(500, 568); ctx.quadraticCurveTo(504, 574, 511, 574); ctx.quadraticCurveTo(518, 574, 522, 568);
  ctx.lineTo(561, 568); ctx.quadraticCurveTo(594, 568, 594, 601); ctx.lineTo(594, 736); ctx.closePath();
  use("plate", rgb(PAL.plate)); ctx.fill();
  shade(ctx, 566, 736, [[0, "rgba(255,250,244,0.35)"], [0.2, "rgba(255,250,244,0.08)"], [1, "rgba(30,24,20,0.12)"]]);
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath(); ctx.moveTo(433, 640); ctx.lineTo(433, 602); ctx.quadraticCurveTo(433, 571, 464, 571); ctx.lineTo(498, 571); ctx.stroke();
  for (const [x, y] of [[437, 610], [587, 610]]) rivet(ctx, x, y, 3, [170, 160, 150]);
}

function readoutHousing(ctx) {
  ctx.fillStyle = "#2a2522"; ctx.fillRect(446, 595, 128, 30);
  // drag hints: left-right and up-down double triangles
  tri(ctx, 472, 588, 478, 583, 478, 593, "#3a3430"); tri(ctx, 486, 588, 480, 583, 480, 593, "#3a3430");
  tri(ctx, 543, 581, 538, 587, 548, 587, "#3a3430"); tri(ctx, 543, 595, 538, 589, 548, 589, "#3a3430");
}

/** Aim pad: light ring, dark-outlined diamond with four light arrow triangles, dark collar round the fire button. */
function pad(ctx) {
  const p = L.pad;
  circlePath(ctx, p.cx, p.cy, 50); ctx.fillStyle = "#26211e"; ctx.fill();
  const g = ctx.createRadialGradient(p.cx - 18, p.cy - 22, 6, p.cx, p.cy, 48);
  g.addColorStop(0, "#ece6de"); g.addColorStop(0.8, "#b4aca3"); g.addColorStop(1, "#7c746c");
  circlePath(ctx, p.cx, p.cy, 48); ctx.fillStyle = g; ctx.fill();
  circlePath(ctx, p.cx, p.cy, 40); ctx.fillStyle = "#3a332e"; ctx.fill();
  circlePath(ctx, p.cx, p.cy, 37); ctx.fillStyle = "#958b82"; ctx.fill();
  const d = 40;
  ctx.beginPath(); ctx.moveTo(p.cx, p.cy - d); ctx.lineTo(p.cx + d, p.cy); ctx.lineTo(p.cx, p.cy + d); ctx.lineTo(p.cx - d, p.cy); ctx.closePath();
  ctx.lineWidth = 4; ctx.strokeStyle = "#2a2420"; ctx.stroke();
  const lit = "#e4ded6", mid = "#c6beb5", dim = "#8e857c";
  tri(ctx, p.cx, p.cy - 36, p.cx - 15, p.cy - 21, p.cx + 15, p.cy - 21, lit);
  tri(ctx, p.cx, p.cy + 36, p.cx - 15, p.cy + 21, p.cx + 15, p.cy + 21, dim);
  tri(ctx, p.cx - 36, p.cy, p.cx - 21, p.cy - 15, p.cx - 21, p.cy + 15, mid);
  tri(ctx, p.cx + 36, p.cy, p.cx + 21, p.cy - 15, p.cx + 21, p.cy + 15, mid);
  ctx.fillStyle = "#2a2420";
  ctx.fillRect(p.cx - 15, p.cy - 22, 30, 3); ctx.fillRect(p.cx - 15, p.cy + 19, 30, 3);
  ctx.fillRect(p.cx - 22, p.cy - 15, 3, 30); ctx.fillRect(p.cx + 19, p.cy - 15, 3, 30);
  circlePath(ctx, L.fire.cx, L.fire.cy, L.fire.r + 6); ctx.fillStyle = "#1e1a17"; ctx.fill();
  circlePath(ctx, L.fire.cx, L.fire.cy, L.fire.r + 3); ctx.fillStyle = "#9c948c"; ctx.fill();
}

/** Walking console centre: morale track and scrollwork around the shield. */
function walkCentre(ctx) {
  const m = L.moraleBox;
  roundRectPath(ctx, 452, 592, 570, 626, 14); ctx.fillStyle = "#3a3330"; ctx.fill();
  roundRectPath(ctx, 454, 594, 568, 624, 12); ctx.fillStyle = "#8e847b"; ctx.fill();
  tri(ctx, m.x0 - 22, 610, m.x0 - 8, 600, m.x0 - 8, 620, "#2c2622");
  tri(ctx, m.x1 + 22, 610, m.x1 + 8, 600, m.x1 + 8, 620, "#2c2622");
  ctx.fillStyle = "#000000"; ctx.fillRect(m.x0, m.y0 - 1, m.x1 - m.x0, m.y1 - m.y0 + 2);
  // scrollwork: light curled bands either side of the shield
  ctx.lineCap = "round";
  for (const s of [-1, 1]) {
    for (const [w, col] of [[7, "#4a423c"], [4, "#ddd5cb"]]) {
      ctx.lineWidth = w; ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(511 + s * 20, 640);
      ctx.bezierCurveTo(511 + s * 60, 628, 511 + s * 78, 660, 511 + s * 58, 690);
      ctx.bezierCurveTo(511 + s * 44, 712, 511 + s * 30, 700, 511 + s * 34, 684);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(511 + s * 30, 652);
      ctx.bezierCurveTo(511 + s * 52, 650, 511 + s * 58, 676, 511 + s * 44, 690);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(511 + s * 66, 664, 7, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.lineCap = "butt";
  tri(ctx, 511, 628, 503, 646, 519, 646, "#d8d0c6");
}

function cornerPlates(ctx) {
  for (const [x, a0, a1] of [[430, -Math.PI / 2, 0], [594, Math.PI, Math.PI * 1.5]]) {
    ctx.beginPath(); ctx.moveTo(x, 736); ctx.arc(x, 736, 38, a0, a1); ctx.closePath();
    ctx.fillStyle = "#2a2420"; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, 736); ctx.arc(x, 736, 35, a0, a1); ctx.closePath();
    ctx.fillStyle = "#8a8077"; ctx.fill();
    const ix = x + (x < 511 ? 16 : -16);
    ctx.fillStyle = "#3a332e"; ctx.fillRect(ix - 6, 717, 12, 7);
  }
}

function infoBar(ctx) {
  ctx.fillStyle = rgb([206, 200, 194]); ctx.fillRect(222, 730, 582, 4);
  roundRectPath(ctx, 218, 733, 808, 762, 14); ctx.fillStyle = "#000000"; ctx.fill();
  for (const x of [222, 804]) { circlePath(ctx, x, 746, 9); ctx.fillStyle = "#2a2622"; ctx.fill(); rivet(ctx, x, 746, 7, [160, 158, 152]); }
}

/* ------------------------------------------------------------------ top */

function counterIcons(ctx) {
  ctx.fillStyle = "#5a2e10"; ctx.fillRect(274, 14, 30, 20);
  ctx.fillStyle = "#9a5a22"; ctx.fillRect(276, 16, 26, 16);
  ctx.fillStyle = "#e8c040"; ctx.fillRect(276, 10, 26, 7);
  ctx.fillStyle = "#fff0a0"; ctx.fillRect(280, 10, 6, 3); ctx.fillRect(292, 11, 5, 2);
  ctx.fillStyle = "#3a1c08"; ctx.fillRect(274, 22, 30, 2); ctx.fillRect(288, 16, 3, 18);
  circlePath(ctx, 487, 13, 4); ctx.fillStyle = "#e8c8a0"; ctx.fill();
  ctx.fillStyle = "#4e6a3a"; ctx.fillRect(482, 18, 10, 10);
  ctx.fillStyle = "#c8c0b0"; ctx.fillRect(483, 18, 8, 3);
  ctx.fillStyle = "#3a3026"; ctx.fillRect(482, 28, 4, 7); ctx.fillRect(488, 28, 4, 7);
  ctx.save(); ctx.translate(670, 24); ctx.rotate(-0.25);
  ctx.fillStyle = "#2c2a28"; ctx.fillRect(-14, -5, 30, 10);
  ctx.fillStyle = "#4a4643"; ctx.fillRect(-14, -5, 30, 3);
  ctx.restore();
  for (const x of [662, 678]) { circlePath(ctx, x, 30, 6); ctx.fillStyle = "#6a3c1a"; ctx.fill(); circlePath(ctx, x, 30, 2); ctx.fillStyle = "#2a1808"; ctx.fill(); }
}

/** Compass bezel (measured radial profile): dark toothed ring, bright rim, parchment disc. */
function compassRing(ctx) {
  const c = L.compass;
  circlePath(ctx, c.cx, c.cy, c.r); ctx.fillStyle = "#464642"; ctx.fill();
  circlePath(ctx, c.cx, c.cy, c.r - 3); ctx.fillStyle = "#7c7c76"; ctx.fill();
  circlePath(ctx, c.cx, c.cy, c.r - 5); ctx.fillStyle = "#33332f"; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = "#5c5c56";
  for (let i = 0; i < 72; i++) {
    const a = i * Math.PI / 36;
    ctx.beginPath();
    ctx.moveTo(c.cx + Math.sin(a) * (c.r - 17), c.cy - Math.cos(a) * (c.r - 17));
    ctx.lineTo(c.cx + Math.sin(a) * (c.r - 7), c.cy - Math.cos(a) * (c.r - 7));
    ctx.stroke();
  }
  circlePath(ctx, c.cx, c.cy, c.r - 18); ctx.fillStyle = "#6e6c66"; ctx.fill();
  circlePath(ctx, c.cx, c.cy, c.r - 21); ctx.fillStyle = "#3c3a36"; ctx.fill();
  const g = ctx.createRadialGradient(c.cx, c.cy, 6, c.cx, c.cy, c.r - 23);
  g.addColorStop(0, "#8c8578"); g.addColorStop(1, "#b2aa9a");
  circlePath(ctx, c.cx, c.cy, c.r - 23); ctx.fillStyle = g; ctx.fill();
  ctx.save(); circlePath(ctx, c.cx, c.cy, c.r - 23); ctx.clip();
  ctx.fillStyle = "rgba(80,100,120,0.35)";
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39, rr = 12 + (i * 7) % 30;
    circlePath(ctx, c.cx + Math.sin(a) * rr, c.cy + Math.cos(a) * rr, 4 + (i % 3) * 2); ctx.fill();
  }
  ctx.restore();
}

/** Message panel: dark diamond-plate mesh in a twisted-rope steel frame with the round badge. */
function infoBox(ctx, use) {
  roundRectPath(ctx, 8, 8, 250, 106, 3); use("mesh", "#1e2024"); ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = "#6c7884"; roundRectPath(ctx, 11, 11, 247, 103, 3); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = "#c4ccd4";
  for (let x = 14; x < 244; x += 5) {
    ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x + 3, 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, 101); ctx.lineTo(x + 3, 106); ctx.stroke();
  }
  for (let y = 14; y < 100; y += 5) { ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(13, y + 3); ctx.stroke(); }
  for (const [x, y] of [[11, 11], [11, 102]]) rivet(ctx, x, y, 6, [170, 172, 176]);
  const b = L.infoBadge, R = 48;
  circlePath(ctx, b.cx, b.cy + 1, R + 1); ctx.fillStyle = "#121212"; ctx.fill();
  const g = ctx.createLinearGradient(b.cx - R, b.cy - R, b.cx + R, b.cy + R);
  g.addColorStop(0, "#f2efea"); g.addColorStop(0.45, "#b9b2aa"); g.addColorStop(1, "#3c3732");
  circlePath(ctx, b.cx, b.cy + 1, R); ctx.fillStyle = g; ctx.fill();
  circlePath(ctx, b.cx, b.cy + 1, R - 10); ctx.fillStyle = "#7a5038"; ctx.fill();
  circlePath(ctx, b.cx, b.cy + 1, R - 13); ctx.fillStyle = "#020406"; ctx.fill();
  const e = ctx.createLinearGradient(0, b.cy - 26, 0, b.cy + 28);
  e.addColorStop(0, "#9ee0ff"); e.addColorStop(1, "#1e7ab8");
  ctx.fillStyle = e;
  ctx.fillRect(b.cx - 13, b.cy - 10, 26, 34);
  for (let i = 0; i < 3; i++) ctx.fillRect(b.cx - 17 + i * 12, b.cy - 22, 10, 13);
  ctx.fillStyle = "#020406"; ctx.fillRect(b.cx - 5, b.cy + 10, 10, 14);
}

function sideButtons(ctx) {
  const rc = L.rightColumn;
  for (let i = 0; i < 10; i++) {
    const y = rc.y0 + 15 + i * 30;
    circlePath(ctx, 1017, y, 14); ctx.fillStyle = "#1c1b1a"; ctx.fill();
    circlePath(ctx, 1017, y, 12); ctx.fillStyle = "#5e605e"; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#9a9c98"; circlePath(ctx, 1017, y, 9); ctx.stroke();
    circlePath(ctx, 1017, y, 5); ctx.fillStyle = "#2e302f"; ctx.fill();
  }
  for (let i = 0; i < 2; i++) {
    const y = L.leftColumn.y0 + 16 + i * 32;
    circlePath(ctx, 8, y, 14); ctx.fillStyle = "#1c1b1a"; ctx.fill();
    circlePath(ctx, 8, y, 12); ctx.fillStyle = "#5e605e"; ctx.fill();
    circlePath(ctx, 8, y, 6); ctx.fillStyle = "#3cd25a"; ctx.fill();
  }
}

/**
 * Paint the static frame for one console kind ('weapon' | 'walk') in logical coordinates.
 * @param {CanvasRenderingContext2D} ctx @param {object|null} tex from makeTextures @param {string} kind
 */
export function paintStatic(ctx, tex, kind) {
  const use = painter(ctx, tex);
  const walk = kind === "walk";
  stoneBand(ctx, use);
  mapFrame(ctx, 9, 198, L.leftMapInner);
  mapFrame(ctx, 824, 1013, L.rightMapInner);
  sidePlate(ctx, use, 214, 432, false);
  sidePlate(ctx, use, 592, 810, true);
  arch(ctx, use);
  if (walk) walkCentre(ctx);
  else { readoutHousing(ctx); pad(ctx); cornerPlates(ctx); }
  for (const id of ["reloadBar", "weaponBar"]) barFrame(ctx, L[id]);
  if (walk) { capsule(ctx, L.btnL1, true); capsule(ctx, L.btnL2); capsule(ctx, L.btnR1, true); }
  else for (const id of ["btnL1", "btnL2", "btnR1", "btnR2"]) capsule(ctx, L[id]);
  infoBar(ctx);
  counterIcons(ctx);
  compassRing(ctx);
  infoBox(ctx, use);
  sideButtons(ctx);
}
