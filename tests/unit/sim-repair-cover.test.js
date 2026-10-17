// tests/unit/sim-repair-cover.test.js - owns AI throne placement and blast cover fairness.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim } from '../../src/sim/sim.js';
import { createSlotTable } from '../../src/ai/slots.js';
import { damagePeople } from '../../src/sim/damage.js';
import { fixture, person } from './npc-fixture.test.js';
test('AI rulers use their throne behind the keep; local rulers use the terrace spawn', () => {
  C.resetRegistriesForTests(); registerCoreSim(); C.freezeRegistries();
  const local = createSim({map:'forest-duel'}).state;
  const ai = createSim({map:'forest-duel', slots:createSlotTable(C.getMap('forest-duel'))}).state;
  assert.deepEqual(ai.rulers[0].pos, ai.castles[0].throne);
  assert.deepEqual(local.rulers[0].pos, local.castles[0].rulerSpawn);
});
test('solid cover stops blast injury; exposed people still take the same blast', () => {
  const f = fixture(), n = person(4, C.ROLE.CREW, [4,1,3]);
  f.state.npcs.push(n); f.put(3,1,3,C.BLOCK.STONE); f.put(3,2,3,C.BLOCK.STONE);
  damagePeople({ state:f.state, getBlock:C.getBlock }, {pos:{x:2.5,y:1.8,z:3.5},radius:5,peak:150,sourceSlot:1});
  assert.equal(n.hp,100);
  f.put(3,1,3,C.BLOCK.AIR);f.put(3,2,3,C.BLOCK.AIR);
  damagePeople({ state:f.state, getBlock:C.getBlock }, {pos:{x:2.5,y:1.8,z:3.5},radius:5,peak:150,sourceSlot:1});
  assert.ok(n.hp<100);
});
