// tests/unit/plugin-blocks.test.js - owns core block data and view conformance checks.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK, COLLIDER, PLUGIN_KIND, getBlock, getView, listPlugins, resetRegistriesForTests, validateBlockPlugin, validateBlockView } from '../../src/contracts.js';
import { TUNING } from '../../src/tuning.js';
import { CORE_BLOCKS, registerCoreBlocks } from '../../src/plugins/blocks/core.sim.js';
import { CORE_BLOCK_VIEWS, DAMAGE_STATE_SUFFIXES, blockModelNode, registerCoreBlockViews } from '../../src/plugins/blocks/core.view.js';

afterEach(resetRegistriesForTests);

test('all fourteen core blocks validate and use the shared ids and tuning', () => {
  assert.equal(CORE_BLOCKS.length, Object.keys(BLOCK).length);
  registerCoreBlocks();
  assert.equal(listPlugins(PLUGIN_KIND.BLOCK).length, CORE_BLOCKS.length);
  for (const [name, id] of Object.entries(BLOCK)) {
    const def = getBlock(id);
    assert.equal(def.key, name.toLowerCase());
    assert.equal(validateBlockPlugin(def), true);
    for (const field of ['hp', 'cost', 'buildS']) assert.equal(def[field], TUNING.blocks[def.key][field], `${def.key}.${field}`);
    assert.equal(def.mapOnly, ['air', 'gate', 'palace', 'foundation'].includes(def.key));
    assert.equal(def.burnable, ['wood', 'floor'].includes(def.key));
  }
});

test('blocks distinguish walking, climbing, shots and structural support', () => {
  registerCoreBlocks();
  const air = getBlock(BLOCK.AIR), ladder = getBlock(BLOCK.LADDER), door = getBlock(BLOCK.DOOR);
  const stairs = getBlock(BLOCK.STAIRS), roof = getBlock(BLOCK.ROOF);
  assert.deepEqual([air.solid, air.walkOn, air.passable, air.projectileSolid, air.collider], [false, false, true, false, COLLIDER.NONE]);
  assert.deepEqual([ladder.solid, ladder.walkOn, ladder.passable, ladder.climbable, ladder.projectileSolid, ladder.collider], [false, false, true, true, false, COLLIDER.NONE]);
  assert.deepEqual([door.solid, door.walkOn, door.passable, door.projectileSolid, door.collider], [false, false, true, true, COLLIDER.NONE]);
  assert.deepEqual([stairs.solid, stairs.walkOn, stairs.passable, stairs.projectileSolid, stairs.collider], [true, true, false, true, COLLIDER.STAIRS]);
  assert.equal(roof.walkOn, false);
  for (const def of CORE_BLOCKS) {
    assert.equal(def.climbable, def.id === BLOCK.LADDER);
    assert.equal(def.oriented, [BLOCK.STAIRS, BLOCK.LADDER, BLOCK.DOOR, BLOCK.ROOF].includes(def.id) ? 'h4' : false);
    if (![BLOCK.AIR, BLOCK.STAIRS, BLOCK.LADDER, BLOCK.DOOR, BLOCK.ROOF].includes(def.id)) {
      assert.deepEqual([def.solid, def.walkOn, def.passable, def.projectileSolid, def.collider], [true, true, false, true, COLLIDER.CUBE], def.key);
    }
  }
  // DESIGN support includes ladders and doors explicitly; BlockDef has no support flag.
  assert.equal(getBlock(BLOCK.FOUNDATION).hp, TUNING.hpIndestructible);
});

test('kit v0 block views validate with flat colours and named damage states', () => {
  registerCoreBlocks();
  registerCoreBlockViews();
  assert.deepEqual(Object.keys(CORE_BLOCK_VIEWS).sort(), CORE_BLOCKS.map(b => b.key).sort());
  assert.deepEqual(DAMAGE_STATE_SUFFIXES, ['_z0', '_z1', '_z2', '_z3']);
  for (const def of CORE_BLOCKS) {
    const view = getView(PLUGIN_KIND.BLOCK, def.key);
    assert.equal(validateBlockView(def.key, view), true);
    assert.equal(view.model, def.id === BLOCK.AIR ? null : `assets/kit-v0/${def.key}.glb`);
    assert.equal(view.variants, DAMAGE_STATE_SUFFIXES.length);
    for (const colour of Object.values(view.tiles)) assert.match(colour, /^#[0-9a-f]{6}$/);
    if (def.id !== BLOCK.AIR) for (const [state, suffix] of DAMAGE_STATE_SUFFIXES.entries()) assert.equal(blockModelNode(def.key, state), `${def.key}${suffix}`);
  }
  assert.throws(() => blockModelNode('stone', -1), RangeError);
  assert.throws(() => blockModelNode('stone', DAMAGE_STATE_SUFFIXES.length), RangeError);
});

test('core block and block view registrations reject duplicates', () => {
  registerCoreBlocks();
  registerCoreBlockViews();
  assert.throws(registerCoreBlocks, /duplicate block/);
  assert.throws(registerCoreBlockViews, /duplicate block view/);
});
