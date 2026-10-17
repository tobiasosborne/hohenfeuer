// tests/unit/ai-controller.test.js - owns AI tick scheduling, command validity and feedback state isolation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { aiThink, createAiController } from '../../src/ai/controller.js';
import { createSlotTable, swapController } from '../../src/ai/slots.js';
import { BLOCK, CMD, EV, CONTROLLER, validateCommand } from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';

function fixture() {
  const slots = createSlotTable({ slots: [{ castle: 'keep' }, { castle: 'keep' }] }, { aiLevel: 10 });
  const plot = origin => ({ width: 8, depth: 8, height: 4, origin, type: new Uint8Array(256), meta: new Uint8Array(256), hp: new Uint8Array(256) });
  const castles = slots.map(s => ({ slot: s.id, gold: 2000, plot: plot([s.id * 192, 0, 0]), mountSpots: [] }));
  for (const c of castles) { c.plot.type[90] = BLOCK.PALACE; c.plot.hp[90] = 40; c.plot.type[91] = BLOCK.STONE; }
  const weapon = { id: 0, slot: 0, defId: 'cannon', pos: [4, 1.5, 4], hp: 36, loaded: true, aim: { az: 0, range: 0 } };
  return { view: { tick: 0, slots, castles, weapons: [weapon], rulers: [], wind: { x: 0, z: 0 }, events: [] }, slot: slots[0], weapon };
}
const rng = () => 0.5;
const at = (controller, view, slot, tick) => { view.tick = tick; return controller.think(view, slot, rng); };

test('entry signature returns integer next-tick commands only on staggered AI cadence', () => {
  const { view, slot } = fixture(), before = structuredClone(view);
  const output = aiThink(view, slot, () => 0.5);
  assert.ok(output.some(c => c.type === CMD.AIM));
  for (const c of output) { assert.equal(c.slot, slot.id); assert.equal(c.tick, 1); assert.equal(validateCommand(c), true); }
  assert.deepEqual(view, before);
  assert.deepEqual(aiThink({ ...view, tick: 1 }, slot, rng), []);
  assert.deepEqual(aiThink(view, { ...slot, controller: CONTROLLER.LOCAL }, rng), []);
  assert.deepEqual(aiThink({ ...view, castles: [{ ...view.castles[0], eliminated: true }] }, slot, rng), []);
  const second = createAiController();
  assert.deepEqual(second.think(view, view.slots[1], rng), []);
  assert.equal((10 + 1 * T.sim.aiSlotStaggerTicks) % T.sim.aiThinkEveryTicks, 0);
});

test('loaded fire delay is observed, own impacts correct once, no feedback causes no repeat aim', () => {
  const { view, slot, weapon } = fixture(), controller = createAiController();
  const first = at(controller, view, slot, 0);
  assert.ok(!first.some(c => c.type === CMD.FIRE));
  const next = at(controller, view, slot, T.sim.aiThinkEveryTicks);
  assert.ok(next.some(c => c.type === CMD.FIRE));
  assert.ok(!next.some(c => c.type === CMD.AIM));
  assert.deepEqual(at(controller, view, slot, T.sim.aiThinkEveryTicks), [], 'same think tick is idempotent');
  weapon.loaded = false;
  view.events = [{ type: EV.IMPACT, tick: 20, payload: { slot: 0, weaponId: 0, pos: [210, 1.5, 10] } }];
  const adjusted = at(controller, view, slot, 30);
  assert.ok(adjusted.some(c => c.type === CMD.AIM));
  assert.equal(controller.snapshot().slots[0].weapons[0].aim.observations, 1);
  at(controller, view, slot, 45);
  assert.equal(controller.snapshot().slots[0].weapons[0].aim.observations, 1);
});

test('two command sources replay identically; snapshot resumes feedback and swaps retain memory', () => {
  const { view, slot, weapon } = fixture(), a = createAiController(), b = createAiController();
  for (const tick of [0, 15, 30]) assert.deepEqual(at(a, view, slot, tick), at(b, view, slot, tick));
  const saved = a.snapshot(), restored = createAiController(saved);
  const human = swapController(view.slots, 0, CONTROLLER.LOCAL)[0];
  assert.deepEqual(at(a, view, human, 45), []);
  assert.deepEqual(a.snapshot(), saved);
  weapon.loaded = false;
  view.events = [{ type: EV.IMPACT, tick: 31, payload: { slot: 0, weaponId: 0, pos: [200, 1, 4] } }];
  assert.deepEqual(at(a, view, slot, 60), at(restored, view, slot, 60));
  assert.deepEqual(a.snapshot(), restored.snapshot());
});

test('rebuild designates supported contract kinds every two seconds under the income budget', () => {
  const { view, slot } = fixture(), controller = createAiController();
  at(controller, view, slot, 0);
  view.castles[0].plot.type[91] = BLOCK.AIR;
  assert.ok(!at(controller, view, slot, 15).some(c => c.type === CMD.DESIGNATE));
  view.castles[0].stats = { income: 100 };
  const commands = at(controller, view, slot, T.ai.buildEveryS * T.sim.tickHz);
  assert.ok(commands.some(c => c.type === CMD.DESIGNATE));
  for (const c of commands) assert.equal(validateCommand(c), true);
  assert.equal(controller.snapshot().slots[0].spentGold, T.blocks.stone.cost);
});

test('unsupported FIRE does not consume the loaded latch and level 1 waits five seconds', () => {
  const { view, slot } = fixture(), controller = createAiController();
  view.commandKinds = [CMD.AIM];
  at(controller, view, slot, 0);
  assert.deepEqual(at(controller, view, slot, 15), []);
  assert.equal(controller.snapshot().slots[0].weapons[0].firedWhileLoaded, false);
  view.commandKinds.push(CMD.FIRE);
  assert.ok(at(controller, view, slot, 30).some(c => c.type === CMD.FIRE));
  const slow = createAiController(), low = { ...slot, aiLevel: 1 };
  at(slow, view, low, 0);
  const delay = (T.ai.levelMax + 1 - low.aiLevel) * T.ai.fireDelayPerLevelS * T.sim.tickHz;
  for (let tick = T.sim.aiThinkEveryTicks; tick < delay; tick += T.sim.aiThinkEveryTicks)
    assert.ok(!at(slow, view, low, tick).some(c => c.type === CMD.FIRE));
  assert.ok(at(slow, view, low, delay).some(c => c.type === CMD.FIRE));
});

test('wind change rolls back learning even when an impact arrives on the same think', () => {
  const { view, slot, weapon } = fixture(), controller = createAiController();
  at(controller, view, slot, 0); at(controller, view, slot, 15);
  weapon.loaded = false;
  view.wind = { x: 15, z: 0 };
  view.events = [{ type: EV.IMPACT, tick: 20, payload: { slot: 0, weaponId: 0, pos: [200, 1.5, 4] } }];
  at(controller, view, slot, 30);
  assert.equal(controller.snapshot().slots[0].weapons[0].aim.observations, 0);
});

test('target loss triggers immediate retarget and visible moving targets update their aim', () => {
  const { view, slot } = fixture(), controller = createAiController();
  view.rulers = [{ id: 1, slot: 1, hp: 100, pos: [200, 1.5, 5] }];
  at(controller, view, slot, 0);
  const first = controller.snapshot().slots[0].weapons[0].target;
  assert.equal(first.kind, 'ruler');
  view.rulers[0].pos = [200, 1.5, 15];
  const moved = at(controller, view, slot, 15);
  assert.ok(moved.some(c => c.type === CMD.AIM));
  assert.equal(controller.snapshot().slots[0].weapons[0].target.pos.z, 15);
  view.rulers[0].hp = 0;
  assert.ok(at(controller, view, slot, 30).some(c => c.type === CMD.AIM));
  assert.equal(controller.snapshot().slots[0].weapons[0].target.kind, 'palace');
});

test('shelter requires both low own morale and three recent enemy impacts, then quiet hysteresis', () => {
  const { view, slot } = fixture(), controller = createAiController();
  view.castles[0].morale = T.ai.shelterBelow - 1;
  view.events = [0, 1, 2].map(id => ({ type: EV.IMPACT, tick: id,
    payload: { slot: 1, weaponId: id, pos: [3, 1, 3] } }));
  assert.ok(at(controller, view, slot, 0).some(c => c.type === CMD.SHELTER && c.on === 1));
  view.castles[0].shelter = true;
  view.castles[0].morale = T.ai.shelterBelow;
  view.events = [];
  const quiet = T.ai.shelterWindowS * T.sim.tickHz + T.sim.aiThinkEveryTicks;
  assert.ok(!at(controller, view, slot, quiet).some(c => c.type === CMD.SHELTER));
  const off = at(controller, view, slot, quiet + T.ai.shelterOffS * T.sim.tickHz);
  assert.ok(off.some(c => c.type === CMD.SHELTER && c.on === 0));
});
