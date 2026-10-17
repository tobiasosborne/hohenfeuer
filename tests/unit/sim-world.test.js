// tests/unit/sim-world.test.js - owns grid, terrain, castle and structural acceptance fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlot, cellIndex, worldToCell, cellToWorld, getCell, setCell, raycast } from '../../src/world/grid.js';
import { generateTerrain, sampleHeight } from '../../src/world/terrain.js';
import { loadCastle } from '../../src/world/castle-load.js';
import { createSupport, queueSupport, stepSupport } from '../../src/world/support.js';
import { createRng } from '../../src/core/rng.js';
import { hash } from '../../src/core/hash.js';
import { TUNING as T } from '../../src/tuning.js';

test('plot storage has DESIGN indexing, indestructible foundation and coordinate transforms', () => {
  const plot = createPlot({ origin: [-24, 3, 100] });
  assert.equal(plot.type.length, T.world.plotW * T.world.plotH * T.world.plotD);
  assert.equal(cellIndex(plot, 4, 3, 2), 4 + T.world.plotW * 2 + T.world.plotW * T.world.plotD * 3);
  assert.equal(getCell(plot, 4, 0, 2).hp, T.hpIndestructible);
  assert.equal(setCell(plot, 4, 0, 2, 0, 0), false);
  setCell(plot, 4, 3, 2, 1, 40, 17);
  assert.deepEqual(worldToCell(plot, cellToWorld(plot, 4, 3, 2)), { x: 4, y: 3, z: 2 });
  assert.equal(getCell(plot, 4, 3, 2).meta, 17);
  assert.equal(getCell(plot, -1, 0, 0), null);
});

test('DDA never tunnels a 1 m wall in 10,000 seeded 150 m/s segments', () => {
  const plot = createPlot();
  for (let y = 1; y < plot.height; y++) for (let z = 0; z < plot.depth; z++) setCell(plot, 20, y, z, 1, 40);
  const rng = createRng(10000);
  for (let i = 0; i < 10000; i++) {
    const sign = rng() < 0.5 ? -1 : 1;
    const start = { x: sign > 0 ? 19 - rng() * 0.2 : 22 + rng() * 0.2, y: 2 + rng() * 18, z: 2 + rng() * 42 };
    const length = 150 / 30, dx = sign * (3 + rng());
    const end = { x: start.x + dx, y: start.y + (rng() - 0.5) * 0.5, z: start.z + Math.sqrt(length * length - dx * dx) };
    const hit = raycast(plot, start, end);
    assert.ok(hit, `shot ${i}`);
    assert.equal(hit.cell.x, 20);
    assert.ok(hit.t >= 0 && hit.t <= 1);
  }
});

test('DDA handles outside starts, reverse rays, starts inside, zero rays and corner ties', () => {
  const plot = createPlot({ width: 4, height: 4, depth: 4, foundation: false });
  setCell(plot, 0, 1, 1, 1, 40);
  assert.equal(raycast(plot, { x: -3, y: 1.5, z: 1.5 }, { x: 4, y: 1.5, z: 1.5 }).cell.x, 0);
  assert.equal(raycast(plot, { x: 4, y: 1.5, z: 1.5 }, { x: -3, y: 1.5, z: 1.5 }).cell.x, 0);
  assert.equal(raycast(plot, { x: 0.5, y: 1.5, z: 1.5 }, { x: 0.5, y: 1.5, z: 1.5 }).t, 0);
  assert.equal(raycast(plot, { x: -1, y: 9, z: 0 }, { x: 5, y: 9, z: 0 }), null);
  setCell(plot, 1, 2, 1, 1, 40);
  assert.ok(raycast(plot, { x: 0.5, y: 2.5, z: 0.5 }, { x: 2.5, y: 2.5, z: 2.5 }));
});

test('ASCII castle loader resolves legend data and retains plot placements', () => {
  const def = { id: 'fixture', size: [3, 3, 2], legend: { '#': 'stone', L: { key: 'ladder', facing: 2 } }, layers: [['###', '#L#'], ['# #', '###']], weapons: [], rulerSpawn: [1, 1, 0] };
  const blocks = { stone: { id: 1, hp: 40 }, ladder: { id: 7, hp: 6 } };
  const castle = loadCastle(def, { origin: [10, 2, 20], getBlock: key => blocks[key] });
  assert.equal(getCell(castle.plot, 1, 1, 1).type, blocks.ladder.id);
  assert.equal(getCell(castle.plot, 1, 1, 1).meta & 3, 2);
  assert.equal(getCell(castle.plot, 1, 2, 0).type, 0);
  assert.deepEqual(castle.rulerSpawn, { x: 11.5, y: 3, z: 20.5 });
  assert.throws(() => loadCastle({ ...def, layers: [['?#?', '###']] }, { getBlock: key => blocks[key] }), /legend|width/);
});

test('terrain is seeded, bilinear, flat under plots and skirt is continuous', () => {
  const map = { size: [160, 128], terrain: { amp: T.world.terrainAmpMaxM, octaves: T.world.terrainOctaves }, slots: [{ origin: [50, 7, 40] }] };
  const a = generateTerrain(map, 42), b = generateTerrain(map, 42), c = generateTerrain(map, 43);
  assert.equal(hash(a), hash(b));
  assert.notEqual(hash(a), hash(c));
  assert.equal(sampleHeight(a, 51.5, 42.25), 7);
  assert.equal(sampleHeight(a, 97, 87), 7);
  const fixture = { width: 2, depth: 2, spacing: 2, origin: { x: 0, z: 0 }, heights: new Float64Array([0, 2, 4, 6]) };
  assert.equal(sampleHeight(fixture, 1, 1), 3);
  assert.equal(sampleHeight(fixture, -10, -10), 0);
});

test('cut tower collapses with a resumable budget; a remote foundation path stays supported', () => {
  const plot = createPlot({ width: 8, height: 24, depth: 8 });
  for (let y = 1; y <= 20; y++) setCell(plot, 3, y, 3, 2, 72);
  const support = createSupport(plot);
  setCell(plot, 3, 1, 3, 0, 0);
  queueSupport(support, [{ x: 3, y: 1, z: 3 }]);
  const collapsed = [];
  let loops = 0;
  while (support.pending) {
    const result = stepSupport(support, 3);
    assert.ok(result.visited <= 3);
    collapsed.push(...result.collapsed);
    assert.ok(++loops < 100);
  }
  assert.equal(collapsed.length, 19);
  assert.equal(getCell(plot, 3, 20, 3).type, 0);
  for (let y = 1; y <= 4; y++) { setCell(plot, 2, y, 2, 2, 72); setCell(plot, 4, y, 2, 2, 72); }
  setCell(plot, 3, 4, 2, 2, 72);
  setCell(plot, 2, 1, 2, 0, 0);
  queueSupport(support, [{ x: 2, y: 1, z: 2 }]);
  while (support.pending) assert.equal(stepSupport(support, 8).collapsed.length, 0);
  assert.equal(getCell(plot, 2, 4, 2).type, 2);
});

test('odd-origin plot skirts meet the flat interior continuously', () => {
  const field = generateTerrain({ size: [160, 128], terrain: { amp: T.world.terrainAmpMaxM }, slots: [{ origin: [51, 7, 41] }] }, 7);
  const inside = sampleHeight(field, 51 + 1e-6, 60), outside = sampleHeight(field, 51 - 1e-6, 60);
  assert.ok(Math.abs(inside - outside) < 1e-6, `${inside} vs ${outside}`);
});
