// src/ui/paint.js - owns the procedural HUD materials (stone, steel, mesh textures) and small canvas drawing helpers.
// Texture generators are pure (integer hash noise, no Math.random) and return RGBA bytes; the
// helpers only issue canvas 2D path/fill calls. Everything is drawn from scratch, no ripped art.

/** Deterministic hash noise in [0, 1) for integer lattice points. */
export function hashNoise(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Bilinear value noise with cell size `s` px. */
export function valueNoise(x, y, s, seed) {
  const gx = Math.floor(x / s), gy = Math.floor(y / s);
  const fx = x / s - gx, fy = y / s - gy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hashNoise(gx, gy, seed), b = hashNoise(gx + 1, gy, seed);
  const c = hashNoise(gx, gy + 1, seed), d = hashNoise(gx + 1, gy + 1, seed);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}

const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

/**
 * Coursed stone: staggered blocks (height 13-16 px), dark mortar, per-block tint, grain, moss.
 * @returns {Uint8ClampedArray} w*h*4 RGBA
 */
export function stoneTexture(w, h, seed, base = [112, 102, 88]) {
  const out = new Uint8ClampedArray(w * h * 4);
  const rowH = 15;
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / rowH), ry = y - row * rowH;
    const shift = Math.floor(hashNoise(row, 0, seed) * 30);
    for (let x = 0; x < w; x++) {
      const bw = 34;
      const col = Math.floor((x + shift) / bw), rx = (x + shift) - col * bw;
      const tint = (hashNoise(col, row, seed + 1) - 0.5) * 30;
      const grain = (valueNoise(x, y, 3, seed + 2) - 0.5) * 34 + (hashNoise(x, y, seed + 3) - 0.5) * 22;
      const mortar = ry === 0 || rx === 0;
      const edgeHi = ry === 1 || rx === 1;
      const edgeLo = ry === rowH - 1 || rx === bw - 1;
      const moss = valueNoise(x, y, 6, seed + 4) > 0.72 && hashNoise(x, y, seed + 5) > 0.45;
      let r = base[0] + tint + grain, g = base[1] + tint + grain, b = base[2] + tint + grain;
      if (edgeHi) { r += 22; g += 22; b += 20; }
      if (edgeLo) { r -= 18; g -= 18; b -= 16; }
      if (mortar) { r = 52 + grain * 0.3; g = 47 + grain * 0.3; b = 40 + grain * 0.3; }
      if (moss && !mortar) { r = r * 0.7 + 20; g = g * 0.7 + 52; b = b * 0.6; }
      const i = (y * w + x) * 4;
      out[i] = clamp8(r); out[i + 1] = clamp8(g); out[i + 2] = clamp8(b); out[i + 3] = 255;
    }
  }
  return out;
}

/** Brushed steel: horizontal streaks plus fine grain. @returns {Uint8ClampedArray} */
export function steelTexture(w, h, seed, base = [176, 169, 162]) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const streak = (hashNoise(0, y, seed) - 0.5) * 10;
    for (let x = 0; x < w; x++) {
      const n = streak + (valueNoise(x, y * 6, 9, seed + 1) - 0.5) * 14 + (hashNoise(x, y, seed + 2) - 0.5) * 12;
      const i = (y * w + x) * 4;
      out[i] = clamp8(base[0] + n); out[i + 1] = clamp8(base[1] + n); out[i + 2] = clamp8(base[2] + n); out[i + 3] = 255;
    }
  }
  return out;
}

/** Dark chain-mail mesh for the info box (diagonal lattice). @returns {Uint8ClampedArray} */
export function meshTexture(w, h, seed, base = [58, 62, 68]) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = (x + y) % 8, b = (x - y + 800) % 8;
    let v = (a === 0 || b === 0) ? 38 : (a === 1 || b === 1) ? -18 : 0;
    v += (hashNoise(x, y, seed) - 0.5) * 12;
    const i = (y * w + x) * 4;
    out[i] = clamp8(base[0] + v); out[i + 1] = clamp8(base[1] + v); out[i + 2] = clamp8(base[2] + v); out[i + 3] = 255;
  }
  return out;
}

/** CSS colour from [r,g,b] (+ optional shade offset). */
export function rgb(c, d = 0) { return `rgb(${clamp8(c[0] + d)},${clamp8(c[1] + d)},${clamp8(c[2] + d)})`; }

/** Rounded-rect path (does not fill). */
export function roundRectPath(ctx, x0, y0, x1, y1, r) {
  const rr = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  ctx.beginPath();
  ctx.moveTo(x0 + rr, y0);
  ctx.lineTo(x1 - rr, y0);
  ctx.arc(x1 - rr, y0 + rr, rr, -Math.PI / 2, 0);
  ctx.lineTo(x1, y1 - rr);
  ctx.arc(x1 - rr, y1 - rr, rr, 0, Math.PI / 2);
  ctx.lineTo(x0 + rr, y1);
  ctx.arc(x0 + rr, y1 - rr, rr, Math.PI / 2, Math.PI);
  ctx.lineTo(x0, y0 + rr);
  ctx.arc(x0 + rr, y0 + rr, rr, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

/** Circle path. */
export function circlePath(ctx, cx, cy, r) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); }

/** 1-2 px bevel on an axis-aligned rect: light top/left, dark bottom/right. */
export function bevelRect(ctx, x0, y0, x1, y1, light, dark, w = 1) {
  ctx.fillStyle = light;
  ctx.fillRect(x0, y0, x1 - x0, w); ctx.fillRect(x0, y0, w, y1 - y0);
  ctx.fillStyle = dark;
  ctx.fillRect(x0, y1 - w, x1 - x0, w); ctx.fillRect(x1 - w, y0, w, y1 - y0);
}

/** Domed rivet / bolt head. */
export function rivet(ctx, cx, cy, r, base = [150, 146, 140]) {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, rgb(base, 80)); g.addColorStop(0.6, rgb(base, 0)); g.addColorStop(1, rgb(base, -70));
  ctx.fillStyle = g;
  circlePath(ctx, cx, cy, r); ctx.fill();
}

/** Filled triangle. */
export function tri(ctx, ax, ay, bx, by, cx, cy, fill) {
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}
