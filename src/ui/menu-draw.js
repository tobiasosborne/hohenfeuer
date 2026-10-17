// src/ui/menu-draw.js - owns drawing of every menu screen (title, skirmish setup, options, credits, tutorial, pause, end screen).
// Redrawn procedurally after the original's menus (stone ring with a bronze disc, steel poles and
// plate buttons, wooden title plaque; steel-framed setup panel with spinner fields and a round green
// start button). Reads only the state of src/ui/menus.js; text through the bitmap font.

import { TUNING } from "../tuning.js";
import { t } from "./i18n.js";
import { drawText, drawTextIn } from "./font.js";
import { stoneTexture, steelTexture, meshTexture, roundRectPath, circlePath, rivet, rgb } from "./paint.js";
import { SCREEN } from "./menus.js";

const LW = TUNING.render.logicalW, LH = TUNING.render.logicalH;
const SLOT_CSS = ["#c02828", "#2860c0", "#28a040", "#c0a020"];

function defaultMakeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  if (typeof document !== "undefined") { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  return null;
}

/* ------------------------------------------------------------------ cached backdrops */

const cache = new Map();
function texCanvas(makeCanvas, key, gen) {
  if (cache.has(key)) return cache.get(key);
  const c = makeCanvas ? makeCanvas(LW, LH) : null;
  if (c) { const x = c.getContext("2d"); const img = x.createImageData(LW, LH); img.data.set(gen()); x.putImageData(img, 0, 0); }
  cache.set(key, c);
  return c;
}
function fillTex(ctx, makeCanvas, key, gen, flat) {
  const c = texCanvas(makeCanvas, key, gen);
  ctx.fillStyle = c ? ctx.createPattern(c, "no-repeat") : flat;
}

/* ------------------------------------------------------------------ parts */

function stoneBackdrop(ctx, mk) {
  fillTex(ctx, mk, "stoneDark", () => stoneTexture(LW, LH, 21, [66, 64, 58]), "#42403a");
  ctx.fillRect(0, 0, LW, LH);
  const v = ctx.createRadialGradient(512, 400, 200, 512, 400, 700);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, LW, LH);
}

/** Round stage: ring of dressed stones around a bronze disc (main/options/credits screens). */
function stage(ctx) {
  const cx = 512, cy = 400;
  circlePath(ctx, cx, cy, 376); ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fill();
  circlePath(ctx, cx, cy, 368); ctx.fillStyle = "#5a5650"; ctx.fill();
  ctx.strokeStyle = "#2c2a26"; ctx.lineWidth = 3;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + 0.05;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 304, cy + Math.sin(a) * 304); ctx.lineTo(cx + Math.cos(a) * 368, cy + Math.sin(a) * 368); ctx.stroke();
  }
  const hi = ctx.createLinearGradient(0, cy - 368, 0, cy + 368);
  hi.addColorStop(0, "rgba(255,250,235,0.18)"); hi.addColorStop(1, "rgba(0,0,0,0.25)");
  circlePath(ctx, cx, cy, 368); ctx.fillStyle = hi; ctx.fill();
  circlePath(ctx, cx, cy, 304); ctx.fillStyle = "#1c1a16"; ctx.fill();
  const g = ctx.createRadialGradient(cx, cy - 20, 40, cx, cy, 298);
  g.addColorStop(0, "#2e2412"); g.addColorStop(0.55, "#5e4a24"); g.addColorStop(0.85, "#a88446"); g.addColorStop(1, "#6a4e22");
  circlePath(ctx, cx, cy, 298); ctx.fillStyle = g; ctx.fill();
}

function poles(ctx) {
  for (const x of [352, 672]) {
    const g = ctx.createLinearGradient(x - 5, 0, x + 5, 0);
    g.addColorStop(0, "#5a5652"); g.addColorStop(0.4, "#e4ded6"); g.addColorStop(1, "#4a4642");
    ctx.fillStyle = g; ctx.fillRect(x - 5, 170, 10, 440);
    for (const y of [166, 614]) { circlePath(ctx, x, y, 10); ctx.fillStyle = "#24211e"; ctx.fill(); rivet(ctx, x, y, 8, [190, 186, 180]); }
  }
}

function medallion(ctx, cx, cy) {
  circlePath(ctx, cx, cy, 58); ctx.fillStyle = "#1e1c1a"; ctx.fill();
  const g = ctx.createLinearGradient(cx - 56, cy - 56, cx + 56, cy + 56);
  g.addColorStop(0, "#f2e6c4"); g.addColorStop(0.5, "#b08a48"); g.addColorStop(1, "#4a3618");
  circlePath(ctx, cx, cy, 55); ctx.fillStyle = g; ctx.fill();
  circlePath(ctx, cx, cy, 44); ctx.fillStyle = "#0c1420"; ctx.fill();
  const e = ctx.createLinearGradient(0, cy - 26, 0, cy + 28);
  e.addColorStop(0, "#9ee0ff"); e.addColorStop(1, "#1e7ab8");
  ctx.fillStyle = e;
  ctx.fillRect(cx - 14, cy - 10, 28, 34);
  for (let i = 0; i < 3; i++) ctx.fillRect(cx - 18 + i * 13, cy - 23, 10, 14);
  ctx.fillStyle = "#0c1420"; ctx.fillRect(cx - 5, cy + 10, 10, 14);
}

/** Wooden title plaque with a steel rim (the original's "Main Menu" sign). */
function plaque(ctx, text, cx, y, w, note) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  roundRectPath(ctx, x0 - 6, y - 6, x1 + 6, y + 58, 26); ctx.fillStyle = "#1e1a16"; ctx.fill();
  const r = ctx.createLinearGradient(0, y - 4, 0, y + 56);
  r.addColorStop(0, "#e2dcd2"); r.addColorStop(1, "#6a645c");
  roundRectPath(ctx, x0 - 4, y - 4, x1 + 4, y + 56, 24); ctx.fillStyle = r; ctx.fill();
  const wood = ctx.createLinearGradient(0, y + 6, 0, y + 46);
  wood.addColorStop(0, "#7a5034"); wood.addColorStop(0.5, "#5a3824"); wood.addColorStop(1, "#3a2416");
  roundRectPath(ctx, x0 + 8, y + 6, x1 - 8, y + 46, 16); ctx.fillStyle = wood; ctx.fill();
  for (let i = 0; i < 9; i++) { ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(x0 + 16, y + 10 + i * 4, w - 32, 1); }
  for (const x of [x0 + 2, x1 - 2]) rivet(ctx, x, y + 26, 6, [190, 186, 180]);
  drawTextIn(ctx, text, { x0, y0: y + 6, x1, y1: y + 46 }, { scale: 2, color: "#f0e6d6", outline: true, outlineColor: "#1a120c" });
  note(text);
}

/** Steel plate button with ornate round ends; focused = lit pale gold (the original's highlighted entry). */
function plateButton(ctx, r, label, focused, note, o = {}) {
  const h = r.y1 - r.y0, cy = (r.y0 + r.y1) / 2;
  roundRectPath(ctx, r.x0, r.y0, r.x1, r.y1, h / 2); ctx.fillStyle = "#14110f"; ctx.fill();
  const g = ctx.createLinearGradient(0, r.y0, 0, r.y1);
  if (o.green) { g.addColorStop(0, "#9ef07a"); g.addColorStop(0.5, "#3cb030"); g.addColorStop(1, "#1a6a14"); }
  else if (focused) { g.addColorStop(0, "#fff6cc"); g.addColorStop(0.5, "#ecd88a"); g.addColorStop(1, "#b49a48"); }
  else { g.addColorStop(0, "#d0c8c0"); g.addColorStop(0.5, "#a49c94"); g.addColorStop(1, "#6e6862"); }
  roundRectPath(ctx, r.x0 + 3, r.y0 + 3, r.x1 - 3, r.y1 - 3, h / 2 - 3); ctx.fillStyle = g; ctx.fill();
  if (o.green && focused) { ctx.lineWidth = 3; ctx.strokeStyle = "#fff6cc"; roundRectPath(ctx, r.x0 + 1, r.y0 + 1, r.x1 - 1, r.y1 - 1, h / 2 - 1); ctx.stroke(); }
  if (!o.green) for (const x of [r.x0 + h / 2, r.x1 - h / 2]) {
    circlePath(ctx, x, cy, h / 2 - 3); ctx.fillStyle = "#3a3632"; ctx.fill();
    rivet(ctx, x, cy, h / 2 - 8, [176, 174, 168]);
  }
  drawTextIn(ctx, label, r, { scale: o.scale ?? 2, color: o.green ? "#ffffff" : "#16100a", outline: !!o.green, outlineColor: "#0a3a08" });
  note(label);
}

/** Spinner field: dark capsule with (-) and (+) knobs, value centred (the original's "(-) 1500 (+)"). */
function spinner(ctx, r, value, focused, note) {
  const h = r.y1 - r.y0, cy = (r.y0 + r.y1) / 2;
  roundRectPath(ctx, r.x0, r.y0, r.x1, r.y1, h / 2); ctx.fillStyle = focused ? "#e8d27a" : "#14110f"; ctx.fill();
  const g = ctx.createLinearGradient(0, r.y0, 0, r.y1);
  g.addColorStop(0, "#4e4844"); g.addColorStop(1, "#2a2624");
  roundRectPath(ctx, r.x0 + 3, r.y0 + 3, r.x1 - 3, r.y1 - 3, h / 2 - 3); ctx.fillStyle = g; ctx.fill();
  for (const [x, plus] of [[r.x0 + h / 2, false], [r.x1 - h / 2, true]]) {
    circlePath(ctx, x, cy, h / 2 - 4); ctx.fillStyle = "#8a8480"; ctx.fill();
    circlePath(ctx, x, cy, h / 2 - 6); ctx.fillStyle = "#c8c2ba"; ctx.fill();
    ctx.fillStyle = "#1a1612"; ctx.fillRect(x - 5, cy - 1, 10, 3);
    if (plus) ctx.fillRect(x - 1, cy - 5, 3, 10);
  }
  drawTextIn(ctx, value, r, { bold: true, outline: true, color: "#ffffff" });
  note(value);
}

function label(ctx, text, x, y, note, o = {}) { drawText(ctx, text, x, y, { bold: true, outline: true, color: o.color ?? "#ffffff", align: o.align }); note(text); }

/** Dark mesh panel in a rope-steel frame (help, credits, stats). */
function meshPanel(ctx, mk, x0, y0, x1, y1) {
  roundRectPath(ctx, x0, y0, x1, y1, 4); ctx.fillStyle = "#121212"; ctx.fill();
  fillTex(ctx, mk, "mesh", () => meshTexture(LW, LH, 31, [34, 36, 40]), "#24262a");
  roundRectPath(ctx, x0 + 6, y0 + 6, x1 - 6, y1 - 6, 3); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = "#8a8680"; roundRectPath(ctx, x0 + 3, y0 + 3, x1 - 3, y1 - 3, 4); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = "#d6d0c8"; roundRectPath(ctx, x0 + 1.5, y0 + 1.5, x1 - 1.5, y1 - 1.5, 4); ctx.stroke();
}

/** Steel setup panel with inset sections (scenario / hot-seat setup screens). */
function steelPanel(ctx, mk, x0, y0, x1, y1, inset = false) {
  if (inset) {
    ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = "#24201c"; ctx.fillRect(x0, y0, x1 - x0, 2); ctx.fillRect(x0, y0, 2, y1 - y0);
    ctx.fillStyle = "#bab2aa"; ctx.fillRect(x0, y1 - 2, x1 - x0, 2); ctx.fillRect(x1 - 2, y0, 2, y1 - y0);
    return;
  }
  fillTex(ctx, mk, "steel", () => steelTexture(LW, LH, 33, [112, 106, 100]), "#706a64");
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = "#e0dad2"; ctx.fillRect(x0, y0, x1 - x0, 2); ctx.fillRect(x0, y0, 2, y1 - y0);
  ctx.fillStyle = "#2a2622"; ctx.fillRect(x0, y1 - 2, x1 - x0, 2); ctx.fillRect(x1 - 2, y0, 2, y1 - y0);
}

const HELP = {
  map: "helpMap", seed: "helpSeed", windStrength: "helpWind", windChange: "helpWind", startGold: "helpGold", start: "helpStart", back: "helpBack",
  sensitivity: "helpSensitivity", lang: "helpLanguage", volume: "helpVolume",
};
const helpKey = (id) => HELP[id] ?? (id?.endsWith(".ctrl") ? "helpSlot" : id?.endsWith(".tactic") ? "helpTactic" : null);

/* ------------------------------------------------------------------ screens */

function drawRound(ctx, m, lang, note, mk, titleKey) {
  stoneBackdrop(ctx, mk);
  stage(ctx);
  plaque(ctx, t(titleKey, lang), 512, 64, 300, note);
}

function drawItems(ctx, m, lang, note, o = {}) {
  m.items.forEach((it, i) => {
    const focused = i === m.focus;
    if (it.kind === "field") spinner(ctx, it.rect, it.text((k, p) => t(k, lang, p), lang), focused, note);
    else plateButton(ctx, it.rect, t(it.label, lang), focused, note, { green: it.id === "start", scale: o.scale });
  });
}

function drawMain(ctx, m, lang, note, mk) {
  drawRound(ctx, m, lang, note, mk, "mainMenu");
  poles(ctx);
  medallion(ctx, 196, 400); medallion(ctx, 828, 400);
  // pole-to-plate connectors
  for (const it of m.items) {
    if (it.id === "exit") continue;
    const cy = (it.rect.y0 + it.rect.y1) / 2;
    ctx.fillStyle = "#4a4642"; ctx.fillRect(352, cy - 4, it.rect.x0 - 352, 8); ctx.fillRect(it.rect.x1, cy - 4, 672 - it.rect.x1, 8);
    ctx.fillStyle = "#cfc8c0"; ctx.fillRect(352, cy - 4, it.rect.x0 - 352, 2); ctx.fillRect(it.rect.x1, cy - 4, 672 - it.rect.x1, 2);
  }
  drawItems(ctx, m, lang, note);
  label(ctx, t("version", lang), 1012, 748, note, { align: "right", color: "#c8c0b4" });
}

function drawSplash(ctx, m, lang, note, mk) {
  stoneBackdrop(ctx, mk);
  stage(ctx);
  medallion(ctx, 512, 260);
  const title = t("gameTitle", lang);
  drawText(ctx, title, 512, 360, { scale: 6, bold: true, outline: true, color: "#f0d690", outlineColor: "#2a1a08", align: "center" });
  note(title);
  const it = m.items[0];
  drawTextIn(ctx, t(it.label, lang), it.rect, { scale: 2, outline: true, color: "#f4ecdc", outlineColor: "#1a120c" });
  note(t(it.label, lang));
  label(ctx, t("version", lang), 1012, 748, note, { align: "right", color: "#c8c0b4" });
}

function drawOptions(ctx, m, lang, note, mk) {
  drawRound(ctx, m, lang, note, mk, "options");
  for (const it of m.items) if (it.kind === "field") label(ctx, t(it.label, lang), it.rect.x0 + 8, it.rect.y0 - 18, note);
  meshPanel(ctx, mk, 580, 230, 880, 450);
  const hk = helpKey(m.focusId);
  if (hk) label(ctx, t(hk, lang), 600, 252, note);
  drawItems(ctx, m, lang, note);
}

function drawTextPage(ctx, m, lang, note, mk, titleKey, lines) {
  drawRound(ctx, m, lang, note, mk, titleKey);
  meshPanel(ctx, mk, 212, 200, 812, 560);
  lines.forEach((k, i) => label(ctx, t(k, lang), 512, 240 + i * 40, note, { align: "center" }));
  drawItems(ctx, m, lang, note);
}

function drawSkirmish(ctx, m, lang, note, mk) {
  ctx.fillStyle = "#0e0c0a"; ctx.fillRect(0, 0, LW, LH);
  steelPanel(ctx, mk, 12, 30, 1012, 756);
  plaque(ctx, t("skirmish", lang), 512, 6, 240, note);
  steelPanel(ctx, mk, 28, 70, 996, 270, true);
  steelPanel(ctx, mk, 28, 290, 508, 586, true);
  steelPanel(ctx, mk, 516, 290, 996, 586, true);
  label(ctx, t("slotTeam", lang), 64, 86, note, { align: "center" });
  label(ctx, t("slotName", lang), 150, 86, note);
  label(ctx, t("slotController", lang), 450, 86, note, { align: "center" });
  label(ctx, t("tactic", lang), 710, 86, note, { align: "center" });
  m.settings.slots.forEach((s, i) => {
    const y = 112 + i * 40;
    circlePath(ctx, 52, y + 16, 11); ctx.fillStyle = "#1a1612"; ctx.fill();
    circlePath(ctx, 52, y + 16, 9); ctx.fillStyle = SLOT_CSS[i]; ctx.fill();
    label(ctx, String(i + 1), 80, y + 9, note);
    label(ctx, s.name, 150, y + 9, note);
  });
  const mapDef = m.maps.find((x) => x.id === m.settings.map) ?? m.maps[0];
  // map preview badge
  meshPanel(ctx, mk, 852, 96, 980, 256);
  drawTextIn(ctx, mapDef.name[lang] ?? mapDef.id, { x0: 852, y0: 160, x1: 980, y1: 190 }, { bold: true, outline: true, color: "#9cd88a" });
  for (const it of m.items) {
    if (it.kind !== "field" || it.id.startsWith("slot")) continue;
    label(ctx, t(it.label, lang), it.id === "map" || it.id === "seed" ? 44 : 532, it.rect.y0 + 9, note);
  }
  meshPanel(ctx, mk, 28, 596, 800, 744);
  const hk = helpKey(m.focusId);
  if (hk) label(ctx, t(hk, lang), 48, 618, note);
  drawItems(ctx, m, lang, note);
}

function drawPause(ctx, m, lang, note, mk) {
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, LW, LH);
  steelPanel(ctx, mk, 336, 196, 688, 540);
  plaque(ctx, t("pause", lang), 512, 172, 220, note);
  drawItems(ctx, m, lang, note);
}

function mmss(s) { const m = Math.floor(s / 60), ss = Math.floor(s % 60); return { m, ss: String(ss).padStart(2, "0") }; }

function drawOver(ctx, m, lang, note, mk) {
  const r = m.result ?? { won: false, draw: true, durationS: 0, rows: [] };
  stoneBackdrop(ctx, mk);
  const banner = t(r.draw ? "draw" : r.won ? "victory" : "defeat", lang);
  const glow = ctx.createRadialGradient(512, 120, 20, 512, 120, 360);
  glow.addColorStop(0, r.won && !r.draw ? "rgba(255,210,110,0.45)" : "rgba(200,40,30,0.35)"); glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, LW, 300);
  drawText(ctx, banner, 512, 60, { scale: 7, bold: true, outline: true, color: r.won && !r.draw ? "#f4d27a" : "#e8584a", outlineColor: "#1a0c06", align: "center" });
  note(banner);
  const sub = [];
  if (!r.draw && r.winnerName) sub.push(t("winner", lang, { name: r.winnerName }));
  sub.push(t("duration", lang, mmss(r.durationS)));
  sub.forEach((s, i) => label(ctx, s, 512, 178 + i * 22, note, { align: "center" }));
  meshPanel(ctx, mk, 162, 240, 862, 560);
  const cols = [["slotName", 200, null], ["shots", 470, "center"], ["hits", 570, "center"], ["damage", 680, "center"], ["losses", 790, "center"]];
  for (const [k, x, al] of cols) label(ctx, t(k, lang), x, 268, note, { align: al ?? undefined, color: "#e8d27a" });
  ctx.fillStyle = "#8a8680"; ctx.fillRect(186, 290, 652, 2);
  r.rows.forEach((row, i) => {
    const y = 312 + i * 40;
    circlePath(ctx, 190, y + 6, 8); ctx.fillStyle = row.color ?? SLOT_CSS[row.slot] ?? "#888"; ctx.fill();
    label(ctx, row.name, 206, y, note);
    for (const [k, x] of [["shots", 470], ["hits", 570], ["damage", 680], ["losses", 790]]) label(ctx, String(Math.round(row[k])), x, y, note, { align: "center" });
  });
  drawItems(ctx, m, lang, note);
}

/**
 * Draw the menu's current screen in 1024 x 768 logical coordinates (the caller sets the transform).
 * @param {CanvasRenderingContext2D} ctx @param {ReturnType<import('./menus.js').createMenu>} m
 * @param {{note?: (s: string) => void, createCanvas?: (w: number, h: number) => any}} [o]
 */
export function drawMenu(ctx, m, o = {}) {
  const note = o.note ?? (() => {});
  const mk = o.createCanvas === undefined ? defaultMakeCanvas : o.createCanvas;
  const lang = m.lang;
  switch (m.screen) {
    case SCREEN.SPLASH: return drawSplash(ctx, m, lang, note, mk);
    case SCREEN.MAIN: return drawMain(ctx, m, lang, note, mk);
    case SCREEN.SKIRMISH: return drawSkirmish(ctx, m, lang, note, mk);
    case SCREEN.OPTIONS: return drawOptions(ctx, m, lang, note, mk);
    case SCREEN.CREDITS: return drawTextPage(ctx, m, lang, note, mk, "credits", ["creditsLine1", "creditsLine2", "creditsLine3", "creditsLine4"]);
    case SCREEN.TUTORIAL: return drawTextPage(ctx, m, lang, note, mk, "tutorial", ["tutorialStub", "tutorialHint", "tutorialHint2"]);
    case SCREEN.PAUSE: return drawPause(ctx, m, lang, note, mk);
    case SCREEN.OVER: return drawOver(ctx, m, lang, note, mk);
    default: return undefined;
  }
}
