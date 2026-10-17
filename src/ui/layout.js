// src/ui/layout.js - owns the HUD rects at the 1024 x 768 logical resolution and the letterbox mapping.
// Pure. Rects are {x0, y0, x1, y1} (x1/y1 exclusive), circles {cx, cy, r}. Values from DESIGN 7.5,
// re-measured (+-4 px, geometry only) on the original weapon-view frame of shot 04 and its lossless
// wine capture; nothing but coordinates is taken from the reference.

import { TUNING } from "../tuning.js";

const W = TUNING.render.logicalW;
const H = TUNING.render.logicalH;

const rect = (x0, y0, x1, y1) => Object.freeze({ x0, y0, x1, y1 });
const circle = (cx, cy, r) => Object.freeze({ cx, cy, r });

/** All HUD elements by id. */
export const LAYOUT = Object.freeze({
  // top counters: icon + "value (start)" text; the icon sits in the first 34 px
  topGold: rect(272, 8, 460, 36),
  topPop: rect(478, 8, 640, 36),
  topWeapons: rect(652, 8, 800, 36),
  // compass: rose radius 68, N/O/S/W letters on a radius-96 ring (shot 04, wine capture 049)
  compass: circle(908, 110, 68),
  compassBox: rect(804, 6, 1012, 214),
  infoBox: rect(0, 0, 262, 108),
  infoText: rect(20, 24, 160, 100),
  infoBadge: circle(208, 56, 44),
  rightColumn: rect(1000, 228, 1024, 528),
  leftColumn: rect(0, 480, 24, 544),
  enemyLabel: rect(880, 490, 996, 548),
  leftMap: rect(0, 562, 210, 768),
  leftMapInner: rect(22, 582, 186, 748),
  rightMap: rect(815, 562, 1024, 768),
  rightMapInner: rect(838, 582, 1002, 748),
  console: rect(213, 565, 812, 768),
  // console, weapon view
  readouts: rect(448, 598, 572, 622),
  readoutDir: rect(448, 598, 508, 622),
  readoutRange: rect(512, 598, 572, 622),
  pad: circle(511, 676, 48),
  fire: circle(511, 676, 14),
  reloadBar: rect(240, 624, 416, 646),
  weaponBar: rect(604, 624, 782, 646),
  btnL1: rect(232, 660, 424, 688),
  btnL2: rect(232, 694, 424, 722),
  btnR1: rect(598, 660, 790, 688),
  btnR2: rect(598, 694, 790, 722),
  infoBar: rect(230, 732, 800, 758),
  // console, walking (shot 03): morale box over the shield emblem, selection in the left bar
  moraleBox: rect(482, 598, 540, 622),
  emblem: circle(511, 676, 48),
  selectionBar: rect(240, 624, 416, 646),
  statusBar: rect(604, 624, 782, 646),
  // 3D view centre for the reticle
  reticle: circle(512, 384, 12),
});

/** Elements that share the screen and must not overlap. */
export const TOP_LEVEL = Object.freeze(["topGold", "topPop", "topWeapons", "compassBox", "infoBox", "rightColumn",
  "leftColumn", "enemyLabel", "leftMap", "rightMap", "console"]);
/** Console children in weapon view. */
export const CONSOLE_WEAPON = Object.freeze(["readouts", "pad", "reloadBar", "weaponBar", "btnL1", "btnL2", "btnR1", "btnR2", "infoBar"]);
/** Console children while walking. */
export const CONSOLE_WALK = Object.freeze(["moraleBox", "emblem", "selectionBar", "statusBar", "btnL1", "btnL2", "btnR1", "btnR2", "infoBar"]);

/** Bounding rect of a circle. */
export function circleBox(c) { return rect(c.cx - c.r, c.cy - c.r, c.cx + c.r, c.cy + c.r); }
/** Rect of any element id (circles as their bounding box). */
export function rectOf(id) { const e = LAYOUT[id]; return e.r !== undefined ? circleBox(e) : e; }

/**
 * Letterbox the 1024 x 768 HUD into a w x h canvas: uniform scale, centred.
 * @returns {{scale: number, x: number, y: number, w: number, h: number}}
 */
export function letterbox(w, h) {
  const scale = Math.min(w / W, h / H);
  return { scale, x: (w - W * scale) / 2, y: (h - H * scale) / 2, w: W * scale, h: H * scale };
}

/** Canvas pixel -> logical HUD coordinate. */
export function toLogical(lb, px, py) { return { x: (px - lb.x) / lb.scale, y: (py - lb.y) / lb.scale }; }

const inRect = (r, x, y) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
const inCircle = (c, x, y) => (x - c.cx) * (x - c.cx) + (y - c.cy) * (y - c.cy) <= c.r * c.r;

/**
 * Clickable control under a logical point, or null.
 * Weapon view: fire, pad-up/down/left/right, readoutDir, readoutRange, btnL1..btnR2.
 * @param {number} x @param {number} y @param {'weapon'|'walk'|string} mode
 */
export function hitTest(x, y, mode) {
  if (inRect(LAYOUT.rightColumn, x, y)) return "rightColumn";
  if (mode !== "weapon" && mode !== "impact") {
    for (const id of ["btnL1", "btnL2", "btnR1", "btnR2"]) if (inRect(LAYOUT[id], x, y)) return id;
    return null;
  }
  if (inCircle(LAYOUT.fire, x, y)) return "fire";
  if (inCircle(LAYOUT.pad, x, y)) {
    const dx = x - LAYOUT.pad.cx, dy = y - LAYOUT.pad.cy;
    if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "pad-left" : "pad-right";
    return dy < 0 ? "pad-up" : "pad-down";
  }
  for (const id of ["readoutDir", "readoutRange", "btnL1", "btnL2", "btnR1", "btnR2"]) if (inRect(LAYOUT[id], x, y)) return id;
  return null;
}
