// src/render/chunks.js - owns chunk geometries per plot and the dirty queue (max TUNING.render.remeshPerFrame remeshes per frame).
import * as THREE from "three";
import { TUNING } from "../tuning.js";
import { meshChunk } from "./mesher.js";

const now = () => (globalThis.performance ? globalThis.performance.now() : 0);

/**
 * @param {object} o
 * @param {ReturnType<import('./mesher.js').createModelSet>} o.models
 * @param {THREE.Material} o.material shared chunk material (vertexColors on)
 * @param {object} [o.meshOpts] extra meshChunk options (sunDir, sunSteps, ...)
 * @param {number} [o.chunk] chunk edge in cells (DESIGN 7.3: 16)
 * @param {number} [o.maxPerFrame] remesh budget per update (DESIGN 7.3: 2)
 */
export function createChunkManager({ models, material, meshOpts = {}, chunk = TUNING.world.chunk, maxPerFrame = TUNING.render.remeshPerFrame }) {
  const group = new THREE.Group();
  group.name = "chunks";
  const plots = new Map(); // plot.id -> { plot, nx, ny, nz }
  const chunks = new Map(); // key -> { plot, cx, cy, cz, mesh }
  const dirty = new Set();
  let lastMs = 0;

  const key = (plot, cx, cy, cz) => `${plot.id}:${cx}:${cy}:${cz}`;

  function addPlot(plot) {
    if (plots.has(plot.id)) throw new Error(`chunks: plot id ${plot.id} already added`);
    const nx = Math.ceil(plot.width / chunk), ny = Math.ceil(plot.height / chunk), nz = Math.ceil(plot.depth / chunk);
    plots.set(plot.id, { plot, nx, ny, nz });
    for (let cy = 0; cy < ny; cy++) for (let cz = 0; cz < nz; cz++) for (let cx = 0; cx < nx; cx++) {
      const k = key(plot, cx, cy, cz);
      chunks.set(k, { plot, cx, cy, cz, mesh: null });
      dirty.add(k);
    }
  }

  function removePlot(plot) {
    for (const [k, c] of chunks) if (c.plot === plot) { drop(c); chunks.delete(k); dirty.delete(k); }
    plots.delete(plot.id);
  }

  /** Mark the chunk holding (x,y,z) and every chunk within one cell of it. Returns newly dirtied count. */
  function markCell(plot, x, y, z) {
    let n = 0;
    const seen = new Set();
    for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy, zz = z + dz;
      if (xx < 0 || yy < 0 || zz < 0 || xx >= plot.width || yy >= plot.height || zz >= plot.depth) continue;
      const k = key(plot, Math.floor(xx / chunk), Math.floor(yy / chunk), Math.floor(zz / chunk));
      if (seen.has(k) || !chunks.has(k)) continue;
      seen.add(k);
      if (!dirty.has(k)) { dirty.add(k); n++; }
    }
    return n;
  }

  function markPlot(plot) {
    for (const [k, c] of chunks) if (c.plot === plot) dirty.add(k);
  }

  function drop(c) {
    if (!c.mesh) return;
    group.remove(c.mesh);
    c.mesh.geometry.dispose();
    c.mesh = null;
  }

  function remesh(k) {
    const c = chunks.get(k);
    dirty.delete(k);
    const out = meshChunk(c.plot, c.cx, c.cy, c.cz, { models, chunk, ...meshOpts });
    drop(c);
    if (out.vertexCount === 0) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(out.positions, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(out.normals, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(out.uvs, 2));
    g.setAttribute("color", new THREE.BufferAttribute(out.colors, 3));
    g.setIndex(new THREE.BufferAttribute(out.indices, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.name = `chunk ${k}`;
    const o = c.plot.origin;
    mesh.position.set(o.x, o.y, o.z);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    c.mesh = mesh;
    group.add(mesh);
  }

  /** Dirty keys in deterministic order: by distance of chunk centre to focus, then key. */
  function ordered(focus) {
    const list = [...dirty];
    const dist = (k) => {
      if (!focus) return 0;
      const c = chunks.get(k), o = c.plot.origin;
      const x = o.x + (c.cx + 0.5) * chunk - focus.x, y = o.y + (c.cy + 0.5) * chunk - focus.y, z = o.z + (c.cz + 0.5) * chunk - focus.z;
      return x * x + y * y + z * z;
    };
    return list.map((k) => [dist(k), k]).sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)).map((e) => e[1]);
  }

  /** Remesh up to `max` dirty chunks nearest `focus` (world {x,y,z} or null). Returns the number remeshed. */
  function update(focus = null, max = maxPerFrame) {
    const t0 = now();
    const keys = ordered(focus).slice(0, max);
    for (const k of keys) remesh(k);
    if (keys.length) lastMs = now() - t0;
    return keys.length;
  }

  /** Remesh every dirty chunk now (initial load, golden mode). */
  function flush() {
    const t0 = now();
    const keys = ordered(null);
    for (const k of keys) remesh(k);
    if (keys.length) lastMs = (now() - t0) / keys.length;
    return keys.length;
  }

  return {
    group, addPlot, removePlot, markCell, markPlot, update, flush,
    dirtyCount: () => dirty.size,
    dirtyKeys: () => ordered(null),
    chunkCount: () => chunks.size,
    meshCount: () => group.children.length,
    lastMs: () => lastMs,
  };
}
