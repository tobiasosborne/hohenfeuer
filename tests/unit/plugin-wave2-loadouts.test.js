// Owns playable armed starts and physically reachable starter-gun routes.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { loadCastle } from '../../src/world/castle-load.js';
import { findPath } from '../../src/npc/path.js';

test('all converted castles have a default battery; shipped duels have fair armed starts and supply', () => {
  C.resetRegistriesForTests(); registerCoreSim();
  for (const def of C.listPlugins(C.PLUGIN_KIND.CASTLE)) assert.ok(def.weapons.length, def.id);
  for (const biome of ['forest', 'desert', 'ice', 'volcano']) {
    const map = C.getMap(`${biome}-duel`), defs = map.slots.map(s => C.getCastle(s.castle));
    assert.equal(defs[0].weapons.length, defs[1].weapons.length, `${biome}: gun parity`);
    for (const def of defs) {
      assert.ok(def.layers.flat().some(row => row.includes('M')), `${biome}/${def.id}: ammunition supply`);
      const { plot } = loadCastle(def, { getBlock: C.getBlockByKey });
      assert.equal(plot.type.filter(id=>id===C.BLOCK.PALACE).length,48,`${biome}: comparable keep capacity`);
      for (const w of def.weapons) {
        assert.equal(plot.type[w.at[0] + 48 * w.at[2] + 2304 * (w.at[1] - 1)], C.BLOCK.MOUNT);
        assert.ok(findPath(plot, def.rulerSpawn, w.at), `${def.id}: reachable gun ${w.at}`);
      }
    }
  }
  C.resetRegistriesForTests();
});
