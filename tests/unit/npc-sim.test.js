// tests/unit/npc-sim.test.js - owns real-sim NPC hooks and replay determinism acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resetRegistriesForTests, freezeRegistries, CMD, getMap } from '../../src/contracts.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim, restoreSim } from '../../src/sim/sim.js';
import { npcTick, moraleTick, npcKinematics } from '../../src/npc/index.js';

test('actual SimApi hooks spawn both populations and resume deterministic NPC state from saves', () => {
  resetRegistriesForTests(); registerCoreSim(); freezeRegistries();
  const hooks = { npcTick, moraleTick, npcKinematics, aiThink: () => [] };
  const options = { map: 'forest-duel', seed: 17, hooks };
  assert.ok(getMap(options.map));
  const a = createSim(options), b = createSim(options);
  for (let tick = 0; tick < 100; tick++) {
    const commands = tick === 0 ? [{ type: CMD.ORDER_CREW, slot: 0, tick, seq: 0, weaponId: 0, on: 1 }]
      : tick === 60 ? [{ type: CMD.SHELTER, slot: 0, tick, seq: 0, on: 1 }] : [];
    a.tick(commands); b.tick(commands);
  }
  assert.equal(a.state.npcs.length, a.state.castles.reduce((sum, c) => sum + c.initialPopulation, 0));
  assert.ok(a.state.castles.every(c => c.population > 0)); assert.equal(a.hash(), b.hash());
  const restored = restoreSim(a.serialize(), { hooks }); assert.equal(restored.hash(), a.hash());
  for (let tick = 0; tick < 60; tick++) { a.tick([]); restored.tick([]); }
  assert.equal(restored.hash(), a.hash());
});
