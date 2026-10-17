// src/render/terrain-view.js - owns the terrain mesh (heightfield from src/world/terrain.js, else flat) and the horizon skirt plane.
import * as THREE from "three";
import { generateTerrain } from "../world/terrain.js";
import { hash } from "../core/hash.js";

/** Biome ground colours (sRGB hex): base grass, alternate, plot/sand. */
export const GROUND = Object.freeze({
  forest: [0x5c8a3c, 0x6e9846, 0xb89a68],
  desert: [0xc9a66b, 0xbf9a5e, 0xd4b47c],
  ice: [0xe4ecf2, 0xc8d4e0, 0xb0b8c0],
  volcano: [0x3a3230, 0x4a3e38, 0x5a4a40],
});

/**
 * @param {object} o
 * @param {object} [o.map] MapDef-like {size, slots, terrain}; slot origins are where the ground is flattened
 * @param {object} [o.field] precomputed heightfield (overrides map)
 * @param {number} [o.seed]
 * @param {string} [o.biome]
 * @param {number} [o.flatY] used when neither map nor field is given
 */
export function createTerrainView({ map, field, seed = 1, biome = "forest", flatY = 0 } = {}) {
  const f = field ?? (map ? generateTerrain(map, seed) : null);
  const [c0, c1, c2] = (GROUND[biome] ?? GROUND.forest).map((h) => new THREE.Color(h));
  const group = new THREE.Group();
  group.name = "terrain";
  let minY = flatY;
  if (f) {
    const { width, depth, spacing, heights } = f;
    const pos = new Float32Array(width * depth * 3), col = new Float32Array(width * depth * 3);
    const plots = f.plots ?? [];
    for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) {
      const i = x + width * z, wx = f.origin.x + x * spacing, wz = f.origin.z + z * spacing, y = heights[i];
      minY = Math.min(minY, y);
      pos.set([wx, y, wz], i * 3);
      // deterministic speckle between the two grass tones; sand on and around plots
      const t = (hash([x, z, seed]) >>> 0) / 4294967296;
      const c = c0.clone().lerp(c1, t * 0.8);
      let sand = 0;
      for (const p of plots) {
        const [px, , pz] = p.origin;
        const dx = Math.max(px - wx, 0, wx - px - p.width), dz = Math.max(pz - wz, 0, wz - pz - p.depth);
        sand = Math.max(sand, 1 - Math.min(1, Math.sqrt(dx * dx + dz * dz) / 10));
      }
      c.lerp(c2, sand);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const idx = [];
    for (let z = 0; z < depth - 1; z++) for (let x = 0; x < width - 1; x++) {
      const a = x + width * z, b = a + 1, c = a + width, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.name = "terrain-field";
    group.add(mesh);
  }
  // Horizon skirt: a large flat plane just below the lowest terrain point, hidden by fog at distance.
  const cx = f ? f.origin.x + ((f.width - 1) * f.spacing) / 2 : 0, cz = f ? f.origin.z + ((f.depth - 1) * f.spacing) / 2 : 0;
  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: c0 }));
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.set(cx, minY - 0.05, cz);
  skirt.name = "terrain-skirt";
  group.add(skirt);
  return { group, field: f, dispose() { group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); } };
}
