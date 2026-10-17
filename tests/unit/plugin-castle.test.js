// tests/unit/plugin-castle.test.js - owns starter castle layout and loader integration checks.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { BLOCK, FACING, K, getBlockByKey, getCastle, resetRegistriesForTests, validateCastlePlugin } from '../../src/contracts.js';
import { TUNING } from '../../src/tuning.js';
import { registerCoreBlocks } from '../../src/plugins/blocks/core.sim.js';
import { DEFAULT_CASTLE, registerDefaultCastle } from '../../src/plugins/castles/default.sim.js';

afterEach(resetRegistriesForTests);

/** Read the CastleDef's ASCII in local x/y/z coordinates; y=0 is implicit foundation. */
function keyAt(x, y, z) {
  if (y === 0) return 'foundation';
  const char = DEFAULT_CASTLE.layers[y - 1]?.[z]?.[x] ?? '.';
  return char === '.' ? 'air' : DEFAULT_CASTLE.legend[char];
}

/** Check the walking volume used by population markers and gun operator cells. */
function assertStandable([x, y, z]) {
  assert.equal(getBlockByKey(keyAt(x, y - 1, z)).walkOn, true, `floor at ${[x, y, z]}`);
  assert.equal(getBlockByKey(keyAt(x, y, z)).passable, true, `feet at ${[x, y, z]}`);
  assert.equal(getBlockByKey(keyAt(x, y + 1, z)).passable, true, `head at ${[x, y, z]}`);
}

test('starter castle validates, fits the plot, and has exact east/west geometry symmetry', () => {
  assert.equal(validateCastlePlugin(DEFAULT_CASTLE), true);
  const [w, h, d] = DEFAULT_CASTLE.size;
  assert.ok(w <= K.PLOT_W && d <= K.PLOT_D && h < K.PLOT_H);
  assert.equal(DEFAULT_CASTLE.layers.length, h);
  for (const layer of DEFAULT_CASTLE.layers) {
    assert.equal(layer.length, d);
    for (const row of layer) {
      assert.equal(row.length, w);
      assert.equal(row, [...row].reverse().join(''));
    }
  }
  assert.equal(DEFAULT_CASTLE.population, TUNING.npc.population);
  registerDefaultCastle();
  assert.deepEqual(getCastle(DEFAULT_CASTLE.id), DEFAULT_CASTLE);
  assert.throws(registerDefaultCastle, /duplicate castle/);
});

test('starter castle has a palace core, four towers, magazine prefab and two cannon mounts', () => {
  const all = DEFAULT_CASTLE.layers.flat().join('');
  const counts = {};
  for (const char of all) if (char !== '.') counts[DEFAULT_CASTLE.legend[char]] = (counts[DEFAULT_CASTLE.legend[char]] ?? 0) + 1;
  assert.ok(counts.palace > 0);
  assert.equal(counts.magazine, TUNING.magazine.prefab.reduce((n, v) => n * v, 1));
  for (const [x, z] of [[6, 6], [36, 6], [6, 36], [36, 36]]) {
    assert.equal(keyAt(x, 1, z), 'tower');
    assert.equal(keyAt(x, 11, z), 'tower');
  }
  for (const key of ['stone', 'stairs', 'ladder', 'floor', 'door', 'roof']) assert.ok(counts[key] > 0, key);
  assert.ok(DEFAULT_CASTLE.mountSpots.length >= 2);
  assert.equal(DEFAULT_CASTLE.weapons.length, 2);
  registerCoreBlocks();
  for (const weapon of DEFAULT_CASTLE.weapons) {
    const [x, y, z] = weapon.at;
    assert.equal(weapon.id, 'cannon');
    assert.equal(keyAt(x, y - 1, z), 'mount');
    assert.equal(keyAt(x, y, z), 'air');
    assert.ok(DEFAULT_CASTLE.mountSpots.some(m => m.join() === [...weapon.at, weapon.facing].join()));
    assertStandable([x + (weapon.facing === FACING.W ? 1 : -1), y, z]);
  }
  const [left, right] = DEFAULT_CASTLE.weapons;
  assert.equal(left.at[0] + right.at[0], DEFAULT_CASTLE.size[0] - 1);
  assert.deepEqual(left.at.slice(1), right.at.slice(1));
  assert.deepEqual([left.facing, right.facing], [FACING.W, FACING.E]);
});

test('courtyard markers and both six-step north-facing rampart stairs have clearance', () => {
  registerCoreBlocks();
  for (const point of [DEFAULT_CASTLE.rulerSpawn, DEFAULT_CASTLE.throne, DEFAULT_CASTLE.exit, ...DEFAULT_CASTLE.workSpots]) assertStandable(point);
  for (const [x0, y0, z0, x1, y1, z1] of DEFAULT_CASTLE.shelters) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) assertStandable([x, y, z]);
  }
  for (const x of [9, 10, 37, 38]) {
    assertStandable([x, 1, 35]);
    for (let step = 1; step <= 6; step++) {
      const z = 35 - step;
      assert.equal(keyAt(x, step, z), 'stairs');
      assert.equal(keyAt(x, step + 1, z), 'air');
      assert.equal(keyAt(x, step + 2, z), 'air');
    }
    assertStandable([x, 7, 28]);
  }
});

test('every castle block connects to the foundation through six-neighbour support', () => {
  const [w, h, d] = DEFAULT_CASTLE.size, pending = [], seen = new Set();
  const encode = (x, y, z) => x + w * z + w * d * y;
  let blocks = 0;
  for (let y = 1; y <= h; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    if (keyAt(x, y, z) === 'air') continue;
    blocks++;
    if (y === 1) { pending.push([x, y, z]); seen.add(encode(x, y, z)); }
  }
  for (let i = 0; i < pending.length; i++) {
    const [x, y, z] = pending[i];
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const p = [x + dx, y + dy, z + dz], code = encode(...p);
      if (p[0] < 0 || p[0] >= w || p[1] < 1 || p[1] > h || p[2] < 0 || p[2] >= d || seen.has(code) || keyAt(...p) === 'air') continue;
      seen.add(code); pending.push(p);
    }
  }
  assert.equal(seen.size, blocks);
});

test('both timber houses have level entrances and two-cell interior clearance', () => {
  registerCoreBlocks();
  for (const x of [14, 15, 32, 33]) for (let z = 30; z <= 33; z++) assertStandable([x, 1, z]);
});

const loaderUrl = new URL('../../src/world/castle-load.js', import.meta.url);
test('starter castle loads through Lane A castle-load with exact block hp and placements', { skip: !existsSync(loaderUrl) && 'Lane A castle loader has not landed; ASCII checks run above' }, async () => {
  registerCoreBlocks();
  const { loadCastle } = await import(loaderUrl.href);
  const origin = [0, 0, 0], loaded = loadCastle(DEFAULT_CASTLE, { origin, getBlock: getBlockByKey });
  assert.equal(loaded.population, DEFAULT_CASTLE.population);
  assert.equal(loaded.weapons.length, DEFAULT_CASTLE.weapons.length);
  assert.ok(loaded.palaceCells.length >= 1);
  assert.equal(loaded.initialPalaceHp, loaded.palaceCells.length * TUNING.blocks.palace.hp);
  for (let z = 0; z < K.PLOT_D; z++) for (let x = 0; x < K.PLOT_W; x++) {
    const i = x + K.PLOT_W * z;
    assert.equal(loaded.plot.type[i], BLOCK.FOUNDATION);
    assert.equal(loaded.plot.hp[i], TUNING.hpIndestructible);
  }
  const [w, h, d] = DEFAULT_CASTLE.size;
  for (let y = 1; y <= h; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    const block = getBlockByKey(keyAt(x, y, z)), i = x + K.PLOT_W * z + K.CELLS_PER_LAYER * y;
    assert.equal(loaded.plot.type[i], block.id);
    assert.equal(loaded.plot.hp[i], block.hp);
  }
});
