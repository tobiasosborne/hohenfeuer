// tests/unit/npc-sim.test.js - owns real-sim NPC hooks and replay determinism acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resetRegistriesForTests, freezeRegistries, CMD, getMap, BLOCK, META } from '../../src/contracts.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim, restoreSim } from '../../src/sim/sim.js';
import { npcTick, moraleTick, npcKinematics, npcCommand, canDesignate } from '../../src/npc/index.js';
import { fixture } from './npc-fixture.test.js';
import { TUNING as T } from '../../src/tuning.js';

test('designation predicate matches NPC acceptance without mutating rejected orders', () => {
  resetRegistriesForTests(); registerCoreSim(); freezeRegistries();
  const scenarios = [
    { cell: [2, 1, 2], block: BLOCK.STONE, accepted: true },
    { cell: [2, 0, 2], block: BLOCK.STONE, accepted: false },
    { cell: [12, 1, 2], block: BLOCK.STONE, accepted: false },
    { cell: [2, 1, 2], block: BLOCK.PALACE, accepted: false },
    { cell: [2, 1, 2], block: BLOCK.STONE, occupied: true, accepted: false },
    { cell: [2, 1, 2], block: BLOCK.STONE, pending: true, accepted: false },
    { cell: [2, 1, 2], block: BLOCK.STONE, cap: true, accepted: false },
    { cell: [2, 1, 2], block: BLOCK.STONE, poor: true, accepted: false },
  ];
  for (const row of scenarios) {
    const { api, castle, put } = fixture();
    if (row.occupied) put(...row.cell, BLOCK.STONE);
    if (row.pending) castle.plot.meta[2 + castle.plot.width * 2 + castle.plot.width * castle.plot.depth] |= META.DESIGNATED_BIT;
    if (row.cap) castle.npcDesignations = Array.from({ length: T.world.maxOpenDesignations }, () => ({ cell: [1, 1, 1] }));
    if (row.poor) castle.gold = 0;
    const command = { type: CMD.DESIGNATE, slot: castle.slot, cell: row.cell, block: row.block, facing: 0 };
    const before = structuredClone(castle);
    assert.equal(canDesignate(castle, command), row.accepted, JSON.stringify(row));
    assert.deepEqual(castle, before, 'eligibility only reads state');
    assert.equal(npcCommand(api, command), row.accepted);
    if (!row.accepted) assert.deepEqual(castle, before, 'rejection changes no state');
  }
});

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
