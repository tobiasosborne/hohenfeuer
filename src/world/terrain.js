// src/world/terrain.js - owns seeded value-noise heightfields and bilinear height sampling.
import { hash } from '../core/hash.js';
import { TUNING as T } from '../tuning.js';
import { TERRAIN_WAVELENGTH } from '../sim/_tuning-local.js';
const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
function lattice(x, z, seed) {
  let word = Math.imul(x, 0x632be5ab) ^ Math.imul(z, 0x85157af5) ^ seed;
  word = Math.imul(word ^ word >>> 16, 0x21f0aaad);
  word = Math.imul(word ^ word >>> 15, 0x735a2d97);
  return ((word ^ word >>> 15) >>> 0) / 4294967296;
}
function noise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z), u = smooth(x - ix), v = smooth(z - iz);
  return lerp(lerp(lattice(ix, iz, seed), lattice(ix + 1, iz, seed), u), lerp(lattice(ix, iz + 1, seed), lattice(ix + 1, iz + 1, seed), u), v);
}
function flatten(height, plots, x, z) {
  for (const plot of plots) {
    const [px, py, pz] = plot.origin;
    const dx = Math.max(px - x, 0, x - px - plot.width), dz = Math.max(pz - z, 0, z - pz - plot.depth);
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance < T.world.plotSkirtM) height = lerp(py, height, smooth(distance / T.world.plotSkirtM));
  }
  return height;
}
/** Build a 2 m heightfield from MapDef; plot origin is its minimum x/y/z corner. */
export function generateTerrain(map, seed = 0) {
  const spacing = T.world.terrainGridM, width = Math.ceil(map.size[0] / spacing) + 1, depth = Math.ceil(map.size[1] / spacing) + 1;
  const params = map.terrain ?? {}, amplitude = params.amp ?? T.world.terrainAmpMaxM, octaves = params.octaves ?? T.world.terrainOctaves;
  const field = { width, depth, spacing, origin: { x: 0, z: 0 }, heights: new Float64Array(width * depth), baseHeights: new Float64Array(width * depth), plots: (map.slots ?? []).map(s => ({ origin: [...s.origin], width: T.world.plotW, depth: T.world.plotD })) };
  const key = hash(seed);
  for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) {
    const wx = x * spacing, wz = z * spacing;
    let value = 0, weight = 1, total = 0, scale = params.wavelength ?? TERRAIN_WAVELENGTH;
    for (let o = 0; o < octaves; o++) { value += noise(wx / scale, wz / scale, key + o) * weight; total += weight; weight *= 0.5; scale *= 0.5; }
    value = total ? amplitude * value / total : 0;
    const ridge = params.ridge;
    if (ridge?.height) {
      const alongX = ridge.axis !== 'z', center = ridge.center ?? map.size[alongX ? 0 : 1] / 2;
      const distance = Math.abs((alongX ? wx : wz) - center), halfWidth = ridge.width ?? TERRAIN_WAVELENGTH / 2;
      value += ridge.height * smooth(Math.max(0, 1 - distance / halfWidth));
    }
    field.baseHeights[x + width * z] = value;
    field.heights[x + width * z] = flatten(value, field.plots, wx, wz);
  }
  return field;
}
/** Bilinear sample, clamped at map edges; plot interiors remain exactly flat at odd origins. */
export function sampleHeight(field, x, z) {
  const gx = Math.max(0, Math.min(field.width - 1, (x - field.origin.x) / field.spacing));
  const gz = Math.max(0, Math.min(field.depth - 1, (z - field.origin.z) / field.spacing));
  const ix = Math.min(field.width - 2, Math.floor(gx)), iz = Math.min(field.depth - 2, Math.floor(gz)), tx = gx - ix, tz = gz - iz;
  const a = ix + field.width * iz;
  const heights = field.baseHeights ?? field.heights;
  const value = lerp(lerp(heights[a], heights[a + 1], tx), lerp(heights[a + field.width], heights[a + field.width + 1], tx), tz);
  return flatten(value, field.plots ?? [], x, z);
}
export const createTerrain = generateTerrain;
