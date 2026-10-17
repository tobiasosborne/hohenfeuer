// src/render/mesher.js - owns pure block meshing: face culling, vertex AO, sun term and damage tint into typed arrays (DESIGN 7.3).
//
// Input grid ("GridView"): the plot record of src/world/grid.js createPlot, read-only:
//   { width, height, depth, type: Uint8Array, hp: Uint8Array, meta: Uint8Array }
//   cell index = x + width*z + width*depth*y; meta bits 0-1 = facing (N,E,S,W).
// Block model: { opaque, faces: [{ cull, area, normal, positions, normals, uvs, colors, indices }] }
//   positions are cell-local (0..1); cull is 'px'|'nx'|'py'|'ny'|'pz'|'nz' when the face lies on that cell
//   boundary (hidden if the neighbour there is opaque), or null for faces inside the cell.
// Output: plot-local positions; the caller places the mesh at plot.origin.
// Pure: no three.js, no DOM; numbers from src/tuning.js.

import { BLOCK } from "../contracts.js";
import { TUNING } from "../tuning.js";
import { pow } from "../core/fmath.js";

export const FACE_DIRS = Object.freeze({
  px: [1, 0, 0], nx: [-1, 0, 0], py: [0, 1, 0], ny: [0, -1, 0], pz: [0, 0, 1], nz: [0, 0, -1],
});
const DIR_KEYS = ["px", "nx", "py", "ny", "pz", "nz"];
const AXIS = { px: 0, nx: 0, py: 1, ny: 1, pz: 2, nz: 2 };
const ROT_CULL = { px: "pz", pz: "nx", nx: "nz", nz: "px", py: "py", ny: "ny" }; // one clockwise quarter turn

export const AO_LEVELS = Object.freeze([0.55, 0.7, 0.85, 1.0]); // occluded corner count 3..0 -> brightness
export const SHADOW = 0.6; // face colour multiplier when the sun ray is blocked

/** sRGB hex -> linear [r, g, b] (three.js treats vertex colours as linear). */
export function hexToLinear(hex) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4));
  return [lin(((hex >> 16) & 255) / 255), lin(((hex >> 8) & 255) / 255), lin((hex & 255) / 255)];
}

/* ------------------------------------------------------------------ model construction */

const QUADS = {
  px: (a, b) => [[b[0], a[1], b[2]], [b[0], a[1], a[2]], [b[0], b[1], a[2]], [b[0], b[1], b[2]]],
  nx: (a, b) => [[a[0], a[1], a[2]], [a[0], a[1], b[2]], [a[0], b[1], b[2]], [a[0], b[1], a[2]]],
  py: (a, b) => [[a[0], b[1], b[2]], [b[0], b[1], b[2]], [b[0], b[1], a[2]], [a[0], b[1], a[2]]],
  ny: (a, b) => [[a[0], a[1], a[2]], [b[0], a[1], a[2]], [b[0], a[1], b[2]], [a[0], a[1], b[2]]],
  pz: (a, b) => [[a[0], a[1], b[2]], [b[0], a[1], b[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]]],
  nz: (a, b) => [[b[0], a[1], a[2]], [a[0], a[1], a[2]], [a[0], b[1], a[2]], [b[0], b[1], a[2]]],
};

/** Indexed triangle mesh of an axis-aligned box; colour is linear rgb. */
export function boxTriangles(min, max, color = [1, 1, 1]) {
  const positions = [], normals = [], uvs = [], colors = [], indices = [];
  for (const key of DIR_KEYS) {
    const base = positions.length / 3;
    const n = FACE_DIRS[key];
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
    QUADS[key](min, max).forEach((p, i) => { positions.push(...p); normals.push(...n); uvs.push(...uv[i]); colors.push(...color); });
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, uvs, colors, indices };
}

/** Unit wedge rising toward north (-Z): the kit-v0 roof orientation. */
export function wedgeTriangles(color = [1, 1, 1]) {
  const A = [0, 0, 0], B = [1, 0, 0], C = [1, 0, 1], D = [0, 0, 1], E = [0, 1, 0], F = [1, 1, 0];
  const s = Math.sqrt(0.5);
  const polys = [
    [[A, B, C, D], [0, -1, 0]], [[B, A, E, F], [0, 0, -1]], [[D, C, F, E], [0, s, s]],
    [[A, D, E], [-1, 0, 0]], [[B, F, C], [1, 0, 0]],
  ];
  const positions = [], normals = [], uvs = [], colors = [], indices = [];
  for (const [pts, n] of polys) {
    const base = positions.length / 3;
    pts.forEach((p) => { positions.push(...p); normals.push(...n); uvs.push(p[0], p[1] + p[2]); colors.push(...color); });
    for (let i = 1; i + 1 < pts.length; i++) indices.push(base, base + i, base + i + 1);
  }
  return { positions, normals, uvs, colors, indices };
}

function mergeMeshes(...meshes) {
  const out = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
  for (const m of meshes) {
    const base = out.positions.length / 3;
    out.positions.push(...m.positions); out.normals.push(...m.normals); out.uvs.push(...m.uvs); out.colors.push(...m.colors);
    out.indices.push(...m.indices.map((i) => i + base));
  }
  return out;
}

/**
 * Classify a triangle mesh into block-model faces.
 * @param {{positions: ArrayLike<number>, normals?: ArrayLike<number>, uvs?: ArrayLike<number>,
 *   colors?: ArrayLike<number>, colorSize?: number, indices?: ArrayLike<number>}} mesh
 * @param {{offset?: number[], eps?: number}} [opts] offset moves the mesh into the 0..1 cell (kit-v0: [0.5, 0, 0.5])
 */
export function modelFromTriangles(mesh, { offset = [0, 0, 0], eps = 1e-4 } = {}) {
  const P = mesh.positions, N = mesh.normals, U = mesh.uvs, Cl = mesh.colors, cs = mesh.colorSize ?? 3;
  const vcount = P.length / 3;
  const idx = mesh.indices ?? Array.from({ length: vcount }, (_, i) => i);
  const groups = new Map(); // cull key ('none' for null) -> builder
  const pos = (i) => [P[i * 3] + offset[0], P[i * 3 + 1] + offset[1], P[i * 3 + 2] + offset[2]];
  for (let t = 0; t < idx.length; t += 3) {
    const vi = [idx[t], idx[t + 1], idx[t + 2]];
    const [p0, p1, p2] = vi.map(pos);
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const len = Math.sqrt(cr[0] * cr[0] + cr[1] * cr[1] + cr[2] * cr[2]);
    if (len < 1e-12) continue;
    const gn = [cr[0] / len, cr[1] / len, cr[2] / len];
    let cull = null;
    for (const key of DIR_KEYS) {
      const a = AXIS[key], s = FACE_DIRS[key][a], plane = s > 0 ? 1 : 0;
      if (gn[a] * s > 0.99 && [p0, p1, p2].every((p) => Math.abs(p[a] - plane) < eps)) { cull = key; break; }
    }
    const gkey = cull ?? "none";
    if (!groups.has(gkey)) groups.set(gkey, { cull, normal: gn, area: 0, map: new Map(), positions: [], normals: [], uvs: [], colors: [], indices: [] });
    const g = groups.get(gkey);
    g.area += len / 2;
    vi.forEach((i, k) => {
      const p = [p0, p1, p2][k];
      const n = N ? [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]] : gn;
      const uv = U ? [U[i * 2], U[i * 2 + 1]] : [0, 0];
      const c = Cl ? [Cl[i * cs], Cl[i * cs + 1], Cl[i * cs + 2]] : [1, 1, 1];
      const vkey = [...p, ...n, ...uv, ...c].join(",");
      let at = g.map.get(vkey);
      if (at === undefined) {
        at = g.positions.length / 3;
        g.map.set(vkey, at);
        g.positions.push(...p); g.normals.push(...n); g.uvs.push(...uv); g.colors.push(...c);
      }
      g.indices.push(at);
    });
  }
  const faces = [...DIR_KEYS, "none"].filter((k) => groups.has(k)).map((k) => {
    const g = groups.get(k);
    return Object.freeze({
      cull: g.cull, area: g.area, normal: g.normal,
      positions: Float32Array.from(g.positions), normals: Float32Array.from(g.normals),
      uvs: Float32Array.from(g.uvs), colors: Float32Array.from(g.colors), indices: Uint16Array.from(g.indices),
    });
  });
  const opaque = DIR_KEYS.every((k) => groups.has(k) && groups.get(k).area >= 1 - 1e-3);
  return Object.freeze({ opaque, faces: Object.freeze(faces) });
}

/** Rotate a model clockwise (seen from above) by `facing` quarter turns about the cell centre; N=0 is identity. */
export function rotateModel(model, facing) {
  const f = facing & 3;
  if (f === 0) return model;
  const faces = model.faces.map((face) => {
    const positions = Float32Array.from(face.positions), normals = Float32Array.from(face.normals);
    const normal = [...face.normal];
    let cull = face.cull;
    for (let r = 0; r < f; r++) {
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i], z = positions[i + 2];
        positions[i] = 1 - z; positions[i + 2] = x;
        const nx = normals[i], nz = normals[i + 2];
        normals[i] = -nz; normals[i + 2] = nx;
      }
      const nx = normal[0];
      normal[0] = -normal[2]; normal[2] = nx;
      if (cull) cull = ROT_CULL[cull];
    }
    return Object.freeze({ ...face, cull, normal, positions, normals });
  });
  return Object.freeze({ opaque: model.opaque, faces: Object.freeze(faces) });
}

/**
 * Model lookup by block id, damage state and facing, with cached rotations and opacity tables.
 * @param {Array<object|null>} models indexed by block id (0..255): the intact (state 0) model
 * @param {Array<Array<object|null>|undefined>} [variants] variants[id] = [state1, state2, state3] models (kit _z1.._z3);
 *   a missing variant falls back to the intact model, which then gets the damage tint instead
 */
export function createModelSet(models, variants = []) {
  const opaque = new Uint8Array(256);
  const opaqueState = new Uint8Array(256 * 4);
  const base = new Array(256).fill(null);
  const vars = new Array(256).fill(null);
  models.forEach((m, id) => { if (m) { base[id] = m; opaque[id] = m.opaque ? 1 : 0; } });
  variants.forEach((v, id) => { if (v) vars[id] = v; });
  const pickModel = (id, state) => (state && vars[id] && vars[id][state - 1]) || base[id];
  for (let id = 0; id < 256; id++) for (let st = 0; st < 4; st++) { const m = pickModel(id, st); opaqueState[id * 4 + st] = m && m.opaque ? 1 : 0; }
  const cache = new Map();
  return {
    opaque,
    opaqueState,
    /** True when `state` (1..3) has its own variant model (no tint needed). */
    hasVariant(id, state) { return !!(state && vars[id] && vars[id][state - 1]); },
    get(id, facing = 0, state = 0) {
      const m = pickModel(id, state);
      if (!m || (facing & 3) === 0) return m;
      const key = (id * 4 + state) * 4 + (facing & 3);
      if (!cache.has(key)) cache.set(key, rotateModel(m, facing));
      return cache.get(key);
    },
  };
}

/** Fallback palette (sRGB) when no block kit or registry view is available. */
export const FALLBACK_COLORS = Object.freeze({
  stone: 0x9a968c, tower: 0x8a8276, gate: 0x7a7064, wood: 0x8a5a32, floor: 0xa07848, stairs: 0x8a6a48,
  ladder: 0x6e4a2a, door: 0x5a3a20, roof: 0xb04a2a, magazine: 0x5e5650, palace: 0xc0b8a4, mount: 0x86827a,
  foundation: 0x6f6a5e,
});

/** Colour-only models for every core block, shaped like the kit-v0 placeholders. */
export function fallbackModels(colors = FALLBACK_COLORS) {
  const models = [];
  for (const [name, id] of Object.entries(BLOCK)) {
    const key = name.toLowerCase();
    if (id === BLOCK.AIR) { models[id] = null; continue; }
    const c = hexToLinear(colors[key] ?? 0xff00ff);
    let mesh;
    if (id === BLOCK.FLOOR) mesh = boxTriangles([0, 0.82, 0], [1, 1, 1], c);
    else if (id === BLOCK.STAIRS) mesh = mergeMeshes(boxTriangles([0, 0, 0], [1, 0.5, 1], c), boxTriangles([0, 0.5, 0], [1, 1, 0.5], c));
    else if (id === BLOCK.LADDER) mesh = boxTriangles([0.1, 0, 0], [0.9, 1, 0.1], c);
    else if (id === BLOCK.ROOF) mesh = wedgeTriangles(c);
    else mesh = boxTriangles([0, 0, 0], [1, 1, 1], c);
    models[id] = modelFromTriangles(mesh);
  }
  return models;
}

/* ------------------------------------------------------------------ meshing */

const DEFAULT_MAX_HP = (() => {
  const hp = new Uint16Array(256);
  for (const [name, id] of Object.entries(BLOCK)) hp[id] = TUNING.blocks[name.toLowerCase()].hp;
  return hp;
})();

function normalize(v) {
  const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/**
 * Mesh one chunk of a plot.
 * @param {object} plot GridView (see header)
 * @param {number} cx @param {number} cy @param {number} cz chunk coordinates
 * @param {object} o
 * @param {ReturnType<typeof createModelSet>} o.models
 * @param {number[]} [o.sunDir] direction toward the sun (normalised here)
 * @param {number} [o.chunk] chunk edge, default TUNING.world.chunk
 * @param {number} [o.sunSteps] max cells marched toward the sun, default TUNING.render.sunDdaSteps
 * @param {boolean} [o.belowOpaque] treat y < 0 as solid ground (default true)
 * @param {(x: number, y: number, z: number) => number} [o.neighbor] block id outside the plot (default air)
 * @param {ArrayLike<number>} [o.maxHp] per block id, default from TUNING.blocks
 * @param {number} [o.only] debug filter: mesh only this block id
 * @param {number[]} [o.at] debug filter: mesh only this cell
 */
export function meshChunk(plot, cx, cy, cz, o) {
  const set = o.models, opaque = set.opaque;
  const C = o.chunk ?? TUNING.world.chunk;
  const sun = normalize(o.sunDir ?? [0.45, 0.8, 0.4]);
  const steps = o.sunSteps ?? TUNING.render.sunDdaSteps;
  const shadow = o.shadow ?? SHADOW;
  const aoLevels = o.aoLevels ?? AO_LEVELS;
  const maxHp = o.maxHp ?? DEFAULT_MAX_HP;
  const tints = TUNING.render.damageTint, above = TUNING.damageStateAbove;
  const belowOpaque = o.belowOpaque ?? true;
  const W = plot.width, H = plot.height, D = plot.depth, layer = W * D;
  const T = plot.type, HP = plot.hp, M = plot.meta;
  const outside = o.neighbor ?? ((x, y) => (y < 0 && belowOpaque ? BLOCK.FOUNDATION : BLOCK.AIR));
  const opaqueState = set.opaqueState;
  /** Damage state 0..3 from hp (TUNING.damageStateAbove); indestructible and hp-less blocks stay 0. */
  const stateOf = (type, hp) => {
    const mh = maxHp[type];
    if (!(mh > 0 && mh < 255)) return 0;
    const frac = hp / mh;
    return frac > above[0] ? 0 : frac > above[1] ? 1 : frac > above[2] ? 2 : 3;
  };
  const solidAt = (x, y, z) => {
    if (x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D) {
      const i = x + W * z + layer * y, t = T[i];
      return opaqueState ? opaqueState[t * 4 + stateOf(t, HP[i])] : opaque[t];
    }
    return opaque[outside(x, y, z)];
  };

  // Amanatides-Woo march toward the sun from point p; true if an opaque cell (other than skip) blocks it.
  const sunBlocked = (px, py, pz, skipX, skipY, skipZ) => {
    let x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz);
    const sx = sun[0] > 0 ? 1 : sun[0] < 0 ? -1 : 0, sy = sun[1] > 0 ? 1 : sun[1] < 0 ? -1 : 0, sz = sun[2] > 0 ? 1 : sun[2] < 0 ? -1 : 0;
    const tdx = sx ? Math.abs(1 / sun[0]) : Infinity, tdy = sy ? Math.abs(1 / sun[1]) : Infinity, tdz = sz ? Math.abs(1 / sun[2]) : Infinity;
    let tmx = sx ? ((sx > 0 ? x + 1 : x) - px) / sun[0] : Infinity;
    let tmy = sy ? ((sy > 0 ? y + 1 : y) - py) / sun[1] : Infinity;
    let tmz = sz ? ((sz > 0 ? z + 1 : z) - pz) / sun[2] : Infinity;
    for (let i = 0; i <= steps; i++) {
      if (x < 0 || z < 0 || x >= W || z >= D || y >= H) return false;
      if (!(x === skipX && y === skipY && z === skipZ) && solidAt(x, y, z)) return true;
      if (tmx <= tmy && tmx <= tmz) { x += sx; tmx += tdx; } else if (tmy <= tmz) { y += sy; tmy += tdy; } else { z += sz; tmz += tdz; }
    }
    return false;
  };

  const pos = [], nor = [], uv = [], col = [], ind = [];
  let faceCount = 0;
  const x0 = cx * C, y0 = cy * C, z0 = cz * C;
  const x1 = Math.min(W, x0 + C), y1 = Math.min(H, y0 + C), z1 = Math.min(D, z0 + C);
  const at = o.at;
  for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
    const i = x + W * z + layer * y;
    const type = T[i];
    if (type === BLOCK.AIR) continue;
    if (o.only !== undefined && type !== o.only) continue;
    if (at && (at[0] !== x || at[1] !== y || at[2] !== z)) continue;
    const state = stateOf(type, HP[i]);
    const model = set.get(type, M ? M[i] & 3 : 0, state);
    if (!model) continue;
    const tint = state && !(set.hasVariant && set.hasVariant(type, state)) ? tints[state - 1] : 1;
    for (const face of model.faces) {
      let d = null;
      if (face.cull) {
        d = FACE_DIRS[face.cull];
        if (solidAt(x + d[0], y + d[1], z + d[2])) continue;
      }
      const fn = face.normal;
      let vis = 1;
      if (fn[0] * sun[0] + fn[1] * sun[1] + fn[2] * sun[2] > 0) {
        const blocked = d
          ? sunBlocked(x + 0.5 + d[0] * 0.5 + d[0] * 1e-4, y + 0.5 + d[1] * 0.5 + d[1] * 1e-4, z + 0.5 + d[2] * 0.5 + d[2] * 1e-4, x, y, z)
          : sunBlocked(x + 0.5, y + 0.5, z + 0.5, x, y, z);
        if (blocked) vis = shadow;
      }
      const base = pos.length / 3;
      const fp = face.positions, fnn = face.normals, fu = face.uvs, fc = face.colors;
      const nv = fp.length / 3;
      let ua = 0, va = 0, bx = 0, by = 0, bz = 0;
      if (d) { const a = AXIS[face.cull]; ua = (a + 1) % 3; va = (a + 2) % 3; bx = x + d[0]; by = y + d[1]; bz = z + d[2]; }
      for (let v = 0; v < nv; v++) {
        const lx = fp[v * 3], ly = fp[v * 3 + 1], lz = fp[v * 3 + 2];
        let ao = 1;
        if (d) {
          // tangent offsets toward the vertex corner: e1 along axis ua, e2 along axis va
          const su = (ua === 0 ? lx : ua === 1 ? ly : lz) < 0.5 ? -1 : 1;
          const sv = (va === 0 ? lx : va === 1 ? ly : lz) < 0.5 ? -1 : 1;
          const e1x = ua === 0 ? su : 0, e1y = ua === 1 ? su : 0, e1z = ua === 2 ? su : 0;
          const e2x = va === 0 ? sv : 0, e2y = va === 1 ? sv : 0, e2z = va === 2 ? sv : 0;
          const s1 = solidAt(bx + e1x, by + e1y, bz + e1z);
          const s2 = solidAt(bx + e2x, by + e2y, bz + e2z);
          const cc = solidAt(bx + e1x + e2x, by + e1y + e2y, bz + e1z + e2z);
          ao = aoLevels[s1 && s2 ? 0 : 3 - (s1 + s2 + cc)];
        }
        const k = ao * vis * tint;
        pos.push(x + lx, y + ly, z + lz);
        nor.push(fnn[v * 3], fnn[v * 3 + 1], fnn[v * 3 + 2]);
        uv.push(fu[v * 2], fu[v * 2 + 1]);
        col.push(fc[v * 3] * k, fc[v * 3 + 1] * k, fc[v * 3 + 2] * k);
      }
      for (const j of face.indices) ind.push(base + j);
      faceCount++;
    }
  }
  return {
    positions: Float32Array.from(pos), normals: Float32Array.from(nor), uvs: Float32Array.from(uv),
    colors: Float32Array.from(col), indices: Uint32Array.from(ind),
    vertexCount: pos.length / 3, triangleCount: ind.length / 3, faceCount,
  };
}
