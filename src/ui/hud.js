// src/ui/hud.js - owns the 2D HUD overlay: `createHud(canvas2d).draw(view)` (DESIGN 3.3, 3.4, 7.5; lane E entry point).
// Re-drawn from scratch after the 2001 stone-and-steel HUD (shot 04 is the weapon-view likeness
// reference): procedural stone/steel textures, self-drawn bitmap font, integer-pixel text. The
// frame art is painted once per console kind into an offscreen canvas; per-frame work is text,
// bars, readouts, compass, overview maps and the reticle. No Math.random, no clock: same view in,
// same pixels out.

import { CAMERA_MODE, EV, JOB } from "../contracts.js";
import { TUNING } from "../tuning.js";
import { LAYOUT, letterbox } from "./layout.js";
import { t } from "./i18n.js";
import { drawText, drawTextIn } from "./font.js";
import { compassGeometry, drawCompass } from "./compass.js";
import { drawMinimap } from "./minimap.js";
import { drawMessages } from "./console.js";
import { drawMenu } from "./menu-draw.js";
import { roundRectPath, circlePath, rgb } from "./paint.js";
import { makeTextures, paintStatic } from "./frame.js";
import { drawOverlays, moraleBand } from "./overlay.js";

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

/** Local construction lifecycle messages kept with the HUD's building labels. */
export function designationMessages(events, { slot, lang }) {
  const out = [];
  for (const e of events) {
    const p = e.payload;
    if (e.type === EV.DESIGNATION_ADDED && p.slot === slot) out.push({ text: t(p.kind === JOB.DEMOLISH ? "demolitionOrdered" : "designationAdded", lang), tone: "info" });
    if (e.type === EV.DESIGNATION_CANCELLED && p.slot === slot) out.push({ text: t("designationCancelled", lang), tone: "info" });
    if (e.type === EV.BLOCK_BUILT && p.plot === slot) out.push({ text: t("blockBuilt", lang), tone: "good" });
  }
  return out;
}

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

/* ------------------------------------------------------------------ dynamic parts */

function textBar(ctx, r, frac, fill, rest, label, note, textColor = "#141008") {
  r = { x0: r.x0 + 3, y0: r.y0 + 3, x1: r.x1 - 2, y1: r.y1 - 1 };
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
  g.addColorStop(0, "#36322d"); g.addColorStop(0.3, "#9e988c"); g.addColorStop(0.5, "#b0aa9e"); g.addColorStop(0.7, "#9e988c"); g.addColorStop(1, "#36322d");
  ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  drawTextIn(ctx, digit, { x0, y0, x1, y1 }, { scale: 2, bold: true, outline: true, color: "#0e0c0a", outlineColor: "#e8e4dc" });
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

/** Castle shield (castle colour quartered with black) with a gold rim, sized as the original's. */
function emblem(ctx, color) {
  const p = L.emblem, cx = p.cx, top = p.cy - 26;
  ctx.beginPath();
  ctx.moveTo(cx - 20, top); ctx.lineTo(cx + 20, top); ctx.lineTo(cx + 20, top + 30);
  ctx.quadraticCurveTo(cx + 18, top + 52, cx, top + 62);
  ctx.quadraticCurveTo(cx - 18, top + 52, cx - 20, top + 30);
  ctx.closePath();
  ctx.fillStyle = "#14120e"; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = color; ctx.fillRect(cx - 20, top, 20, 31); ctx.fillRect(cx, top + 31, 20, 32);
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = "#7a6420"; ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = "#e0c060"; ctx.stroke();
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

/** Swallow-tailed pennant in the morale band colour, hung right of the population counter. */
function pennant(ctx, band) {
  const x = 618, y = 6;
  ctx.fillStyle = "#3a3026"; ctx.fillRect(x - 1, y, 2, 30);
  ctx.beginPath(); ctx.moveTo(x + 1, y + 2); ctx.lineTo(x + 19, y + 2); ctx.lineTo(x + 19, y + 24); ctx.lineTo(x + 10, y + 18); ctx.lineTo(x + 1, y + 24); ctx.closePath();
  ctx.fillStyle = band.color; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = "#1a1410"; ctx.stroke();
}

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
  const frame = { texts: [], readouts: null, moraleBand: null };

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
    frame.moraleBand = null;
    if (v.overlays) drawOverlays(ctx, v.overlays, note);

    const weaponMode = v.mode === CAMERA_MODE.WEAPON || v.mode === CAMERA_MODE.IMPACT;
    const showConsole = v.mode !== CAMERA_MODE.DEATH;
    if (showConsole) {
      const kind = weaponMode ? "weapon" : "walk";
      const s = staticFor(kind);
      if (s) ctx.drawImage(s, 0, 0); else paintStatic(ctx, null, kind);

      if (v.gold !== undefined) counter(ctx, L.topGold, String(v.gold), false, note);
      if (v.pop) counter(ctx, L.topPop, `${v.pop.now} (${v.pop.start})`, v.pop.now >= v.pop.start, note);
      if (v.morale) { const band = moraleBand(v.morale.value, lang); pennant(ctx, band); frame.moraleBand = band.index; }
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
        if (m !== null) { const s = `${m}%`; drawTextIn(ctx, s, mb, { bold: true, outline: true, color: moraleBand(m, lang).color }); note(s); }
        emblem(ctx, v.castleColor || "#c82020");
        const sel = v.selection;
        if (sel) textBar(ctx, L.selectionBar, 1, sel.valid === false ? [200, 70, 50] : [70, 190, 80], "#5a5a5a", t("cost", lang, { name: sel.name, cost: sel.cost }), note);
        else textBar(ctx, L.selectionBar, 0, [0, 0, 0], "#6a6a6a", "", note);
        if (sel && v.reserved !== undefined) textBar(ctx, L.statusBar, 1, [168, 148, 88], "#6a6a6a", t("buildLedger", lang, { gold: Math.floor(v.gold ?? 0), reserved: Math.floor(v.reserved) }), note);
        else if (v.shelterOn) textBar(ctx, L.statusBar, 1, [214, 156, 34], "#6a6a6a", t("shelter", lang), note);
        else if (v.target) textBar(ctx, L.statusBar, v.target.hpPct / 100, [86, 168, 212], "#5a5a5a", t("weaponCondition", lang, { name: v.target.name, pct: Math.round(v.target.hpPct) }), note);
        else textBar(ctx, L.statusBar, 0, [0, 0, 0], "#6a6a6a", "", note);
        buttonLabel(ctx, L.btnL1, t("demolish", lang), false, note);
        buttonLabel(ctx, L.btnL2, t("repair", lang), false, note);
        buttonLabel(ctx, L.btnR1, t("build", lang), false, note);
      }
    }
    reticle(ctx, v);
    if (v.menu) drawMenu(ctx, v.menu, { note });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    frame.texts = texts;
  }

  return { draw, get frame() { return frame; }, ctx };
}
