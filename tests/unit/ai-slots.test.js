// tests/unit/ai-slots.test.js - owns validated slot creation and controller-only swaps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlotTable, swapController, createHotSeatTimer, createLockstepHarness } from '../../src/ai/slots.js';
import { CONTROLLER, TACTIC, validateSlot, K } from '../../src/contracts.js';

test('map slots become a validated deterministic slot table with per-slot settings', () => {
  const map = { slots: [{ castle: 'keep' }, { castle: 'fort' }] };
  const settings = { slots: [{ controller: CONTROLLER.LOCAL, color: 0x123456 }, { aiLevel: 10, aiTactic: TACTIC.DAREDEVIL, team: 0 }] };
  const before = structuredClone({ map, settings });
  const slots = createSlotTable(map, settings);
  assert.equal(slots.length, 2);
  assert.ok(slots.every(s => validateSlot(s)));
  assert.equal(slots[0].controller, CONTROLLER.LOCAL);
  assert.equal(slots[1].controller, CONTROLLER.AI);
  assert.equal(slots[1].castleId, 'fort');
  assert.equal(slots[1].team, 0);
  assert.deepEqual(createSlotTable(map, settings), slots);
  assert.deepEqual({ map, settings }, before);
  assert.throws(() => createSlotTable({ slots: Array(K.MAX_SLOTS + 1).fill({ castle: 'keep' }) }), /slots/i);
  assert.throws(() => createSlotTable(map, { slots: [{ aiLevel: 11 }] }), /aiLevel/i);
});

test('AI to local to AI swaps only controller metadata and keeps external state untouched', () => {
  const table = createSlotTable({ slots: [{ castle: 'keep' }] });
  const simState = { rulers: [{ hp: 42 }], gold: 515, aim: { az: 200, range: 384 } };
  const before = structuredClone({ table, simState });
  const human = swapController(table, 0, CONTROLLER.LOCAL);
  assert.deepEqual(human[0], { ...table[0], controller: CONTROLLER.LOCAL });
  assert.deepEqual(swapController(human, 0, CONTROLLER.AI), table);
  assert.deepEqual({ table, simState }, before);
  assert.throws(() => swapController(table, 0, 'robot'), /controller/);
  assert.throws(() => swapController(table, 3, CONTROLLER.REMOTE), /slot/i);
});

test('Phase 4 timer and lockstep interfaces are explicit NotImplemented stubs', () => {
  for (const fn of [createHotSeatTimer, createLockstepHarness]) {
    assert.throws(fn, { name: 'NotImplemented', message: /Phase 4/ });
  }
});
