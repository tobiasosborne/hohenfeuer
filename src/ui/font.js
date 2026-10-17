// src/ui/font.js - owns the self-drawn HUD bitmap font (glyph data, rasteriser, canvas text drawing).
// Drawn from scratch in the spirit of the 2001 HUD lettering (bold, white with a dark 1 px outline);
// no pixels from the original. Glyph cell: 12 rows (0-1 accents, 2-9 caps, 10-11 descenders).
// Rasterising is pure; drawText only calls ctx.fillStyle / ctx.fillRect on integer pixels.

/** Font metrics. */
export const FONT = Object.freeze({ rows: 12, capTop: 2, baseline: 9, spacing: 1, spaceW: 3 });

// Each bank: first line lists the characters (space separated); following lines are glyph rows,
// one token per character. 8-line banks are cap-height only (rows 2-9), 10-line banks rows 2-11.
const BANKS = [`
A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
.###. ####. .###. ####. ##### ##### .###. #...# ### ..### #...# #.... #.....# #...# .###. ####. .###. ####. .###. ##### #...# #...# #.....# #...# #...# #####
#...# #...# #...# #...# #.... #.... #...# #...# .#. ...#. #..#. #.... ##...## ##..# #...# #...# #...# #...# #...# ..#.. #...# #...# #.....# #...# #...# ....#
#...# #...# #.... #...# #.... #.... #.... #...# .#. ...#. #.#.. #.... #.#.#.# #.#.# #...# #...# #...# #...# #.... ..#.. #...# #...# #.....# .#.#. .#.#. ...#.
#...# ####. #.... #...# ####. ####. #.### ##### .#. ...#. ##... #.... #..#..# #.#.# #...# ####. #...# ####. .###. ..#.. #...# #...# #..#..# ..#.. ..#.. ..#..
##### #...# #.... #...# #.... #.... #...# #...# .#. ...#. #.#.. #.... #.....# #..## #...# #.... #.#.# #.#.. ....# ..#.. #...# .#.#. #..#..# .#.#. ..#.. .#...
#...# #...# #.... #...# #.... #.... #...# #...# .#. #..#. #..#. #.... #.....# #...# #...# #.... #..#. #..#. ....# ..#.. #...# .#.#. #.#.#.# #...# ..#.. #....
#...# #...# #...# #...# #.... #.... #...# #...# .#. #..#. #...# #.... #.....# #...# #...# #.... #..#. #...# #...# ..#.. #...# .#.#. ##...## #...# ..#.. #....
#...# ####. .###. ####. ##### #.... .###. #...# ### .##.. #...# ##### #.....# #...# .###. #.... .##.# #...# .###. ..#.. .###. ..#.. #.....# #...# ..#.. #####
`, `
a b c d e f g h i j k l m n o p q r s t u v w x y z ß
..... #.... ..... ....# ..... ..## ..... #.... # .# #... # ....... ..... ..... ..... ..... .... ..... .#.. ..... ..... ....... ..... ..... ..... .##..
..... #.... ..... ....# ..... .#.. ..... #.... . .. #... # ....... ..... ..... ..... ..... .... ..... .#.. ..... ..... ....... ..... ..... ..... #..#.
.###. ####. .###. .#### .###. #### .#### ####. # .# #..# # ######. ####. .###. ####. .#### #.## .#### #### #...# #...# #.....# #...# #...# ##### #..#.
....# #...# #.... #...# #...# .#.. #...# #...# # .# #.#. # #..#..# #...# #...# #...# #...# ##.. #.... .#.. #...# #...# #..#..# .#.#. #...# ...#. #.#..
.#### #...# #.... #...# ##### .#.. #...# #...# # .# ##.. # #..#..# #...# #...# #...# #...# #... .###. .#.. #...# .#.#. #..#..# ..#.. #...# ..#.. #..#.
#...# #...# #.... #...# #.... .#.. #...# #...# # .# #.#. # #..#..# #...# #...# #...# #...# #... ....# .#.. #...# .#.#. #..#..# .#.#. #...# .#... #...#
#...# #...# #.... #...# #.... .#.. .#### #...# # .# #..# # #..#..# #...# #...# ####. .#### #... ....# .#.. #..## ..#.. .#.#.#. #...# .#### #.... #...#
.#### ####. .###. .#### .###. .#.. ....# #...# # .# #... # #..#..# #...# .###. #.... ....# #... ####. ..## .##.# ..#.. ..#.#.. #...# ....# ##### #.##.
..... ..... ..... ..... ..... .... ....# ..... . .# .... . ....... ..... ..... #.... ....# .... ..... .... ..... ..... ....... ..... ....# ..... .....
..... ..... ..... ..... ..... .... .###. ..... . #. .... . ....... ..... ..... #.... ....# .... ..... .... ..... ..... ....... ..... .###. ..... .....
`, `
0 1 2 3 4 5 6 7 8 9
.###. ..#.. .###. .###. ...#. ##### .###. ##### .###. .###.
#...# .##.. #...# #...# ..##. #.... #.... ....# #...# #...#
#...# ..#.. ....# ....# .#.#. ####. #.... ...#. #...# #...#
#...# ..#.. ...#. ..##. #..#. ....# ####. ...#. .###. #...#
#...# ..#.. ..#.. ....# ##### ....# #...# ..#.. #...# .####
#...# ..#.. .#... ....# ...#. ....# #...# ..#.. #...# ....#
#...# ..#.. #.... #...# ...#. #...# #...# .#... #...# ....#
.###. .###. ##### .###. ...#. .###. .###. .#... .###. .###.
`, `
( ) % / : . , ! ? - + ' < > ;
..# #.. ##..# ...# . . .. # .###. .... ..... # .... .... ..
.#. .#. ##..# ...# . . .. # #...# .... ..... # ...# #... ..
#.. ..# ...#. ..#. # . .. # ....# .... ..#.. . ..#. .#.. .#
#.. ..# ..#.. ..#. . . .. # ...#. .... ..#.. . .#.. ..#. ..
#.. ..# ..#.. .#.. . . .. # ..#.. #### ##### . #... ...# ..
#.. ..# .#... .#.. . . .. # ..#.. .... ..#.. . .#.. ..#. ..
#.. ..# #..## #... . . .. . ..... .... ..#.. . ..#. .#.. ..
#.. ..# #..## #... # # .# # ..#.. .... ..... . ...# #... .#
.#. .#. ..... .... . . #. . ..... .... ..... . .... .... #.
..# #.. ..... .... . . .. . ..... .... ..... . .... .... ..
`];

/** @type {Object<string, {w: number, rows: string[]}>} */
export const GLYPHS = {};

function parseBank(text) {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const chars = lines[0].split(" ");
  const body = lines.slice(1).map((l) => l.split(" "));
  const top = 2, bottom = FONT.rows - top - body.length;
  for (let i = 0; i < chars.length; i++) {
    const rows = body.map((cols) => cols[i]);
    const w = rows[0].length;
    const blank = ".".repeat(w);
    GLYPHS[chars[i]] = { w, rows: [...Array(top).fill(blank), ...rows, ...Array(bottom).fill(blank)] };
  }
}
for (const b of BANKS) parseBank(b);
GLYPHS[" "] = { w: FONT.spaceW, rows: Array(FONT.rows).fill(".".repeat(FONT.spaceW)) };

/** Umlauts: base glyph plus two dots (row 0 above caps, row 2 above x-height), 2 columns apart so bold keeps a gap. */
function umlaut(ch, base, row) {
  const g = GLYPHS[base];
  const rows = g.rows.slice();
  const r = rows[row].split("");
  r[0] = "#"; r[g.w - 2] = "#";
  rows[row] = r.join("");
  GLYPHS[ch] = { w: g.w, rows };
}
umlaut("Ä", "A", 0); umlaut("Ö", "O", 0); umlaut("Ü", "U", 0);
umlaut("ä", "a", 2); umlaut("ö", "o", 2); umlaut("ü", "u", 2);
Object.freeze(GLYPHS);

/** @param {string} ch */
export function hasGlyph(ch) { return Object.prototype.hasOwnProperty.call(GLYPHS, ch); }
const glyphOf = (ch) => GLYPHS[ch] || GLYPHS["?"];

/**
 * @typedef {{scale?: number, bold?: boolean, outline?: boolean}} TextOpts
 */
function unscaledSize(text, bold, outline) {
  let w = 0;
  const chars = [...text];
  chars.forEach((ch, i) => { w += glyphOf(ch).w + (bold ? 1 : 0) + (i ? FONT.spacing : 0); });
  const pad = outline ? 2 : 0;
  return { w: w + pad, h: FONT.rows + pad };
}

/** Pixel size of a text run. @param {string} text @param {TextOpts} [o] */
export function measure(text, o = {}) {
  const s = o.scale || 1;
  const u = unscaledSize(text, !!o.bold, !!o.outline);
  return { w: u.w * s, h: u.h * s };
}

/**
 * Rasterise text into a w x h byte map: 0 empty, 1 fill, 2 outline.
 * @param {string} text @param {TextOpts} [o] @returns {{w: number, h: number, data: Uint8Array}}
 */
export function rasterize(text, o = {}) {
  const bold = !!o.bold, outline = !!o.outline, s = o.scale || 1;
  const u = unscaledSize(text, bold, outline);
  const base = new Uint8Array(u.w * u.h);
  const off = outline ? 1 : 0;
  let x = off;
  [...text].forEach((ch, i) => {
    if (i) x += FONT.spacing;
    const g = glyphOf(ch);
    for (let r = 0; r < FONT.rows; r++) {
      const row = g.rows[r];
      for (let c = 0; c < g.w; c++) {
        if (row[c] !== "#") continue;
        base[(r + off) * u.w + x + c] = 1;
        if (bold) base[(r + off) * u.w + x + c + 1] = 1;
      }
    }
    x += g.w + (bold ? 1 : 0);
  });
  if (outline) {
    for (let y = 0; y < u.h; y++) for (let xx = 0; xx < u.w; xx++) {
      if (base[y * u.w + xx]) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xn = xx + dx;
        if (yy >= 0 && yy < u.h && xn >= 0 && xn < u.w && base[yy * u.w + xn] === 1) { near = true; break; }
      }
      if (near) base[y * u.w + xx] = 2;
    }
  }
  if (s === 1) return { w: u.w, h: u.h, data: base };
  const w = u.w * s, h = u.h * s, data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) data[y * w + xx] = base[Math.floor(y / s) * u.w + Math.floor(xx / s)];
  return { w, h, data };
}

const CACHE = new Map();
const CACHE_MAX = 512;
function cachedRaster(text, o) {
  const key = `${o.scale || 1}|${o.bold ? 1 : 0}|${o.outline ? 1 : 0}|${text}`;
  let r = CACHE.get(key);
  if (!r) {
    r = rasterize(text, o);
    if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
    CACHE.set(key, r);
  }
  return r;
}

/**
 * Draw text with integer-pixel fillRect runs. (x, y) is the top-left of the glyph cell (row 0)
 * unless `align` / `valign` say otherwise.
 * @param {CanvasRenderingContext2D} ctx @param {string} text @param {number} x @param {number} y
 * @param {TextOpts & {color?: string, outlineColor?: string, align?: 'left'|'center'|'right'}} [o]
 * @returns {{w: number, h: number}}
 */
export function drawText(ctx, text, x, y, o = {}) {
  const r = cachedRaster(text, o);
  let x0 = Math.round(x), y0 = Math.round(y);
  if (o.align === "center") x0 = Math.round(x - r.w / 2);
  else if (o.align === "right") x0 = Math.round(x - r.w);
  const colors = [null, o.color || "#ffffff", o.outlineColor || "#000000"];
  for (const v of [2, 1]) {
    ctx.fillStyle = colors[v];
    for (let yy = 0; yy < r.h; yy++) {
      let run = -1;
      for (let xx = 0; xx <= r.w; xx++) {
        const on = xx < r.w && r.data[yy * r.w + xx] === v;
        if (on && run < 0) run = xx;
        else if (!on && run >= 0) { ctx.fillRect(x0 + run, y0 + yy, xx - run, 1); run = -1; }
      }
    }
  }
  return { w: r.w, h: r.h };
}

/**
 * Draw text centred (both axes) on the cap band of a rect {x0, y0, x1, y1}.
 * @param {CanvasRenderingContext2D} ctx @param {string} text @param {{x0: number, y0: number, x1: number, y1: number}} rect
 * @param {TextOpts & {color?: string, outlineColor?: string}} [o]
 */
export function drawTextIn(ctx, text, rect, o = {}) {
  const s = o.scale || 1, off = o.outline ? 1 : 0;
  const capMid = (FONT.capTop + FONT.baseline + 1) / 2 + off; // rows from cell top to the cap band centre
  const cy = (rect.y0 + rect.y1) / 2;
  return drawText(ctx, text, (rect.x0 + rect.x1) / 2, Math.round(cy - capMid * s), { ...o, align: "center" });
}
