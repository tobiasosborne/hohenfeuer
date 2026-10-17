// src/render/terrain-view.js - owns the terrain mesh (heightfield from src/world/terrain.js, else flat) and the horizon skirt plane.
import * as THREE from "three";
import { generateTerrain } from "../world/terrain.js";
import { hash } from "../core/hash.js";
import { createRng } from "../core/rng.js";
import { addForestBackdrop } from "./forest-backdrop.js";

/** Biome ground colours (sRGB hex): base grass, alternate, plot/sand. */
export const GROUND = Object.freeze({
  forest: [0x3f4e24, 0x4b592c, 0x9f9378],
  desert: [0xc9a66b, 0xbf9a5e, 0xd4b47c],
  ice: [0xe4ecf2, 0xc8d4e0, 0xb0b8c0],
  volcano: [0x3a3230, 0x4a3e38, 0x5a4a40],
});

// A 2.5 m repeat: fine turf mottling and sand grain at wall-walk distance. Authored from seeded
// periodic noise, with the same world UVs on the skirt (no reference-image input).
const REPEAT_M = 2.5;
function groundTexture(seed) {
  const size = 256, rng = createRng(seed), data = new Uint8Array(size * size * 4);
  const fields = [8, 32, 128].map(n => ({ n, values: Float32Array.from({ length: n * n }, () => rng()) }));
  const noise = (f, x, y) => {
    const u = x / size * f.n, v = y / size * f.n, i = Math.floor(u), j = Math.floor(v);
    const tx = u - i, ty = v - j;
    const at = (a, b) => f.values[(a % f.n) + (b % f.n) * f.n];
    return (at(i,j) * (1-tx) + at(i+1,j) * tx) * (1-ty) + (at(i,j+1) * (1-tx) + at(i+1,j+1) * tx) * ty;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = Math.round(171 + noise(fields[0],x,y) * 35 + noise(fields[1],x,y) * 35 + noise(fields[2],x,y) * 25);
    const i = (x + size * y) * 4;
    data[i] = data[i+1] = data[i+2] = value; data[i+3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 1; texture.needsUpdate = true;
  return texture;
}

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
  const texture = groundTexture(seed);
  group.name = "terrain";
  let minY = flatY;
  if (f) {
    const { width, depth, spacing, heights } = f;
    const pos = new Float32Array(width * depth * 3), col = new Float32Array(width * depth * 3), uv = new Float32Array(width * depth * 2);
    const plots = f.plots ?? [];
    for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) {
      const i = x + width * z, wx = f.origin.x + x * spacing, wz = f.origin.z + z * spacing, y = heights[i];
      minY = Math.min(minY, y);
      pos.set([wx, y, wz], i * 3);
      uv.set([wx / REPEAT_M, wz / REPEAT_M], i * 2);
      // deterministic speckle between the two grass tones; sand on and around plots
      const t = (hash([x, z, seed]) >>> 0) / 4294967296;
      const c = c0.clone().lerp(c1, t * 0.8);
      let sand = 0;
      for (const p of plots) {
        const [px, , pz] = p.origin;
        const dx = Math.max(px - wx, 0, wx - px - p.width), dz = Math.max(pz - wz, 0, wz - pz - p.depth);
        // Narrow worn verge with a world-anchored irregular edge; never changes collision heights.
        const distance = Math.sqrt(dx * dx + dz * dz);
        const edge = .55 * Math.sin(wx * .71) + .4 * Math.sin(wz * .93 + wx * .17);
        const u = Math.max(0, Math.min(1, (distance - .6 + edge) / 4.4));
        sand = Math.max(sand, 1 - u * u * (3 - 2 * u));
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
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, map: texture }));
    mesh.name = "terrain-field";
    group.add(mesh);
  }
  // Horizon skirt: a large flat plane just below the lowest terrain point, hidden by fog at distance.
  const cx = f ? f.origin.x + ((f.width - 1) * f.spacing) / 2 : 0, cz = f ? f.origin.z + ((f.depth - 1) * f.spacing) / 2 : 0;
  const skirtGeo = new THREE.PlaneGeometry(4000, 4000);
  const skirtUv = skirtGeo.getAttribute("uv"), skirtPos = skirtGeo.getAttribute("position");
  for (let i = 0; i < skirtUv.count; i++) skirtUv.setXY(i, (cx + skirtPos.getX(i)) / REPEAT_M, (cz - skirtPos.getY(i)) / REPEAT_M);
  const skirt = new THREE.Mesh(skirtGeo, new THREE.MeshLambertMaterial({ color: c0, map: texture }));
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.set(cx, minY - 0.05, cz);
  skirt.name = "terrain-skirt";
  group.add(skirt);
  if (biome === "forest") addForestBackdrop(group, f, seed);
  return { group, field: f, dispose() {
    const maps = new Set([texture]);
    group.traverse((o) => { if (o.isMesh) { if (o.material.map) maps.add(o.material.map); o.geometry.dispose(); o.material.dispose(); } });
    for (const map of maps) map.dispose();
  } };
}
