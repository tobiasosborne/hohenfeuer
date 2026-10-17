// src/render/test-scene.js - owns the hard-coded 2-castle test grid for the render harness and goldens (no sim, no plugins).
// Layout follows DESIGN 2.4 loosely: 32x32 curtain wall 3 thick and 6 high with merlons, 6x6 corner towers with
// stepped roofs, south gatehouse, 10x10 keep around a 4x4x3 palace core, magazine, two houses, stairs, a ladder,
// and one cannon mount per castle facing the enemy. Pure: grid.js + contracts only.
import { createPlot, setCell } from "../world/grid.js";
import { BLOCK, FACING } from "../contracts.js";
import { TUNING } from "../tuning.js";

const HP = Object.fromEntries(Object.entries(BLOCK).map(([k, id]) => [id, Math.min(254, TUNING.blocks[k.toLowerCase()].hp)]));

export const TEST_SCENE = Object.freeze({
  seed: 1,
  // Plot min corners; centres are TUNING.world.duelDistanceM (192 m) apart on the x axis.
  origins: Object.freeze([[72, 4, 104], [72 + TUNING.world.duelDistanceM, 4, 104]]),
  sunDir: Object.freeze([-0.55, 0.7, 0.45]), // toward the sun: west-south-west, high afternoon sun
  map: Object.freeze({
    id: "render-test", biome: "forest", size: [384, 256],
    slots: [{ origin: [72, 4, 104], facingDeg: 90, castle: "test" }, { origin: [264, 4, 104], facingDeg: 270, castle: "test" }],
    terrain: { amp: 6, octaves: 3, ridge: null }, water: null,
  }),
});

function put(p, x, y, z, id, facing = 0) {
  setCell(p, x, y, z, id, id === BLOCK.AIR ? 0 : HP[id], facing);
}
function box(p, x0, y0, z0, x1, y1, z1, id, facing = 0) {
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) put(p, x, y, z, id, facing);
}
/** Facing of a roof cell on the ring of square [lo, hi] so its slope rises toward the centre. */
function inward(x, z, lo, hi) {
  if (z === lo) return FACING.S;
  if (z === hi) return FACING.N;
  if (x === lo) return FACING.E;
  return FACING.W;
}

function tower(p, x0, z0) {
  const x1 = x0 + 5, z1 = z0 + 5;
  box(p, x0, 1, z0, x1, 12, z1, BLOCK.AIR);
  for (let y = 1; y <= 10; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    if (x === x0 || x === x1 || z === z0 || z === z1) put(p, x, y, z, BLOCK.TOWER);
  }
  box(p, x0 + 1, 10, z0 + 1, x1 - 1, 10, z1 - 1, BLOCK.FLOOR);
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    if ((x === x0 || x === x1 || z === z0 || z === z1) && (x + z) % 2 === 0) put(p, x, 11, z, BLOCK.TOWER);
  }
  for (let z = z0 + 1; z <= z1 - 1; z++) for (let x = x0 + 1; x <= x1 - 1; x++) {
    if (x === x0 + 1 || x === x1 - 1 || z === z0 + 1 || z === z1 - 1) put(p, x, 11, z, BLOCK.ROOF, inward(x, z, x0 + 1, x1 - 1));
  }
  for (let z = z0 + 2; z <= z1 - 2; z++) for (let x = x0 + 2; x <= x1 - 2; x++) put(p, x, 12, z, BLOCK.ROOF, inward(x, z, x0 + 2, x1 - 2));
}

function house(p, x0, z0) {
  box(p, x0, 1, z0, x0 + 3, 3, z0 + 4, BLOCK.WOOD);
  put(p, x0 + 1, 1, z0 + 4, BLOCK.DOOR, FACING.S);
  put(p, x0 + 1, 2, z0 + 4, BLOCK.DOOR, FACING.S);
  for (let x = x0; x <= x0 + 3; x++) {
    put(p, x, 4, z0, BLOCK.ROOF, FACING.S); put(p, x, 4, z0 + 4, BLOCK.ROOF, FACING.N);
    box(p, x, 4, z0 + 1, x, 4, z0 + 3, BLOCK.WOOD);
    put(p, x, 5, z0 + 1, BLOCK.ROOF, FACING.S); put(p, x, 5, z0 + 3, BLOCK.ROOF, FACING.N);
    put(p, x, 5, z0 + 2, BLOCK.WOOD);
    put(p, x, 6, z0 + 2, BLOCK.ROOF, FACING.N);
  }
}

/** Build one test castle into a fresh plot; gunDir is +1 (cannon faces east) or -1 (west). */
function buildCastle(id, origin, gunDir) {
  const p = createPlot({ id, origin });
  const lo = 8, hi = 39;
  // curtain wall
  for (let z = lo; z <= hi; z++) for (let x = lo; x <= hi; x++) {
    const d = Math.min(x - lo, hi - x, z - lo, hi - z);
    if (d > 2) continue;
    box(p, x, 1, z, x, 6, z, BLOCK.STONE);
    if (d === 0 && (x + z) % 2 === 0) put(p, x, 7, z, BLOCK.STONE);
  }
  for (const [x, z] of [[6, 6], [36, 6], [6, 36], [36, 36]]) tower(p, x, z);
  // gatehouse (south)
  box(p, 21, 1, 37, 26, 9, 39, BLOCK.GATE);
  box(p, 23, 1, 37, 24, 3, 39, BLOCK.AIR);
  for (let x = 21; x <= 26; x++) if (x % 2 === 0) put(p, x, 10, 39, BLOCK.GATE);
  // keep with palace core
  for (let y = 1; y <= 10; y++) for (let z = 19; z <= 28; z++) for (let x = 19; x <= 28; x++) {
    if (x === 19 || x === 28 || z === 19 || z === 28) put(p, x, y, z, BLOCK.TOWER);
  }
  box(p, 20, 4, 20, 27, 4, 27, BLOCK.FLOOR);
  box(p, 20, 8, 20, 27, 8, 27, BLOCK.FLOOR);
  box(p, 22, 1, 22, 25, 3, 25, BLOCK.PALACE);
  put(p, 23, 1, 28, BLOCK.DOOR, FACING.S); put(p, 23, 2, 28, BLOCK.DOOR, FACING.S);
  put(p, 24, 1, 28, BLOCK.DOOR, FACING.S); put(p, 24, 2, 28, BLOCK.DOOR, FACING.S);
  for (let k = 0; k <= 4; k++) {
    const y = 11 + k;
    for (let x = 19; x <= 28; x++) { put(p, x, y, 19 + k, BLOCK.ROOF, FACING.S); put(p, x, y, 28 - k, BLOCK.ROOF, FACING.N); }
    for (const x of [19, 28]) for (let z = 20 + k; z <= 27 - k; z++) put(p, x, y, z, BLOCK.TOWER);
  }
  // magazine, houses
  box(p, 12, 1, 12, 13, 2, 13, BLOCK.MAGAZINE);
  house(p, 13, 30);
  house(p, 31, 30);
  // stairs up the inside of the west wall to the walkway (rising north), with a landing
  for (let k = 0; k <= 5; k++) {
    if (k > 0) box(p, 11, 1, 26 - k, 11, k, 26 - k, BLOCK.STONE);
    put(p, 11, k + 1, 26 - k, BLOCK.STAIRS, FACING.N);
  }
  box(p, 11, 1, 20, 11, 6, 20, BLOCK.STONE);
  // ladder up the keep's west face
  for (let y = 1; y <= 10; y++) put(p, 18, y, 23, BLOCK.LADDER, FACING.E);
  // cannon mount on the wall facing the enemy, embrasure cleared
  const gx = gunDir > 0 ? 38 : 9, ex = gunDir > 0 ? 39 : 8;
  put(p, gx, 6, 23, BLOCK.MOUNT);
  put(p, ex, 7, 23, BLOCK.AIR);
  put(p, gx, 6, 16, BLOCK.MOUNT);
  put(p, gx, 6, 30, BLOCK.MOUNT);
  return { plot: p, cannon: { cell: [gx, 7, 23], dir: [gunDir, 0, 0], azDeg: gunDir > 0 ? 90 : 270 } };
}

/** @returns {{ plots: object[], cannons: Array<{plot: number, cell: number[], dir: number[], azDeg: number}>, map: object, terrainMap: object, sunDir: number[] }} */
export function buildTestScene() {
  const castles = TEST_SCENE.origins.map((o, i) => buildCastle(i, o, i === 0 ? 1 : -1));
  return {
    plots: castles.map((c) => c.plot),
    cannons: castles.map((c, i) => ({ plot: i, ...c.cannon })),
    map: TEST_SCENE.map,
    // terrain.js flattens plots to origin.y (the foundation bottom); the harness flattens to 3 cm below the
    // foundation top instead, so the ground meets the castle floor without z-fighting (see lane-D report).
    terrainMap: { ...TEST_SCENE.map, slots: TEST_SCENE.map.slots.map((s) => ({ ...s, origin: [s.origin[0], s.origin[1] + 0.97, s.origin[2]] })) },
    sunDir: [...TEST_SCENE.sunDir],
  };
}
