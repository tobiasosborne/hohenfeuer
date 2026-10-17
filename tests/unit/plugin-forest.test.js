// tests/unit/plugin-forest.test.js - owns forest biome and duel map conformance.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { K, PLUGIN_KIND, getMap, getBiome, getView, resetRegistriesForTests, validateMapPlugin, validateBiomePlugin, validateBiomeView } from '../../src/contracts.js';
import { TUNING } from '../../src/tuning.js';
import { FOREST_DUEL, FOREST_DUEL_SEED, registerForestDuel } from '../../src/plugins/maps/forest-duel.sim.js';
import { FOREST, registerForest } from '../../src/plugins/biomes/forest.sim.js';
import { FOREST_VIEW, registerForestView } from '../../src/plugins/biomes/forest.view.js';

afterEach(resetRegistriesForTests);

test('forest duel validates with two centred non-overlapping plots exactly one duel distance apart', () => {
  assert.equal(validateMapPlugin(FOREST_DUEL), true);
  assert.deepEqual(FOREST_DUEL.size, TUNING.world.duelMapM);
  assert.equal(FOREST_DUEL.slots.length, 2);
  const [left, right] = FOREST_DUEL.slots;
  assert.equal(right.origin[0] - left.origin[0], TUNING.world.duelDistanceM);
  assert.equal(left.origin[1], right.origin[1]);
  assert.equal(left.origin[2], right.origin[2]);
  assert.equal(left.origin[0] + right.origin[0] + K.PLOT_W, FOREST_DUEL.size[0]);
  assert.equal(left.origin[2] * 2 + K.PLOT_D, FOREST_DUEL.size[1]);
  assert.deepEqual([left.facingDeg, right.facingDeg], [90, 270]);
  for (const slot of FOREST_DUEL.slots) {
    assert.equal(slot.castle, 'default');
    assert.ok(slot.origin[0] >= 0 && slot.origin[0] + K.PLOT_W <= FOREST_DUEL.size[0]);
    assert.ok(slot.origin[2] >= 0 && slot.origin[2] + K.PLOT_D <= FOREST_DUEL.size[1]);
  }
  assert.ok(left.origin[0] + K.PLOT_W <= right.origin[0]);
});

test('forest map uses tuning for terrain, wind, gold and the weapon cap; seed is a separate sim input', () => {
  assert.equal(FOREST_DUEL.biome, FOREST.id);
  assert.deepEqual(FOREST_DUEL.terrain, { amp: TUNING.world.terrainAmpMaxM, octaves: TUNING.world.terrainOctaves, ridge: null });
  assert.deepEqual(FOREST_DUEL.wind, { strength: TUNING.wind.defaultStrength, change: TUNING.wind.defaultChange });
  assert.equal(FOREST_DUEL.startGold, TUNING.economy.startGold);
  assert.equal(FOREST_DUEL.weaponCap, TUNING.world.weaponCapDefault);
  assert.equal(FOREST_DUEL.suddenDeathS, null);
  assert.equal(FOREST_DUEL.water, null);
  assert.ok(Number.isInteger(FOREST_DUEL_SEED));
  assert.equal('seed' in FOREST_DUEL, false);
});

test('forest biome and view validate with green grass, grey stone, Lambert light and tuned fog', () => {
  assert.equal(validateBiomePlugin(FOREST), true);
  assert.equal(validateBiomeView(FOREST.id, FOREST_VIEW), true);
  for (const key of ['grass', 'earth', 'rock']) assert.match(FOREST.terrainPalette[key], /^#[0-9a-f]{6}$/);
  const grass = Number.parseInt(FOREST.terrainPalette.grass.slice(1), 16);
  assert.ok((grass >> 8 & 255) > (grass >> 16 & 255) && (grass >> 8 & 255) > (grass & 255));
  assert.equal(FOREST_VIEW.fog.near, TUNING.ruler.fogNearM);
  assert.equal(FOREST_VIEW.fog.far, TUNING.ruler.fogFarM);
  assert.equal(FOREST_VIEW.sky.cloudLayers, 3);
  assert.equal(FOREST_VIEW.atlas.material, 'MeshLambertMaterial');
  assert.equal(FOREST_VIEW.atlas.vertexColors, true);
  assert.equal(FOREST_VIEW.atlas.sizePx, TUNING.render.atlasPx);
  assert.equal(FOREST_VIEW.atlas.tilePx, TUNING.render.tilePx);
  assert.equal(FOREST_VIEW.atlas.gutterPx, TUNING.render.gutterPx);
  assert.equal(FOREST_VIEW.atlas.minFilter, 'LinearMipmapLinearFilter');
  assert.equal(FOREST_VIEW.atlas.maxMip, TUNING.render.maxMip);
  assert.ok(FOREST_VIEW.sun.direction[1] > 0);
  for (const prop of FOREST_VIEW.props) {
    assert.equal(prop.collision, false);
    assert.match(prop.model, /^assets\/kit-v0\/[a-z-]+\.glb$/);
    assert.ok(FOREST.props.some(p => p.id === prop.id));
  }
});

test('forest map, biome and view register through contracts and reject duplicates', () => {
  registerForestDuel(); registerForest(); registerForestView();
  assert.deepEqual(getMap(FOREST_DUEL.id), FOREST_DUEL);
  assert.deepEqual(getBiome(FOREST.id), FOREST);
  assert.deepEqual(getView(PLUGIN_KIND.BIOME, FOREST.id), FOREST_VIEW);
  assert.throws(registerForestDuel, /duplicate map/);
  assert.throws(registerForest, /duplicate biome/);
  assert.throws(registerForestView, /duplicate biome view/);
});
