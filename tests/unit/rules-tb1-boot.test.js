// tests/unit/rules-tb1-boot.test.js - owns the headless TB1 integration path used by index.html: slots, scripted walk, man, aim, fire, mid-flight tick.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as C from "../../src/contracts.js";
import { TUNING as T } from "../../src/tuning.js";
import { registerCoreSim } from "../../src/plugins/index.sim.js";
import { createSim } from "../../src/sim/sim.js";
import { TB1, tb1Slots, createTb1Script, ballNearEnemy } from "../../src/tb1-script.js";

function boot() {
  C.resetRegistriesForTests();
  registerCoreSim();
  C.freezeRegistries();
  return createSim({ map: TB1.map, seed: TB1.seed, slots: tb1Slots() });
}

/** Run the script until `until(state)` or maxTicks; returns {sim, script, state, events}. */
function run(until, maxTicks = 60 * T.sim.tickHz) {
  const sim = boot(), script = createTb1Script();
  let state = sim.state;
  const events = [];
  for (let i = 0; i < maxTicks && !until(state, script); i++) {
    sim.tick(script.next(state));
    events.push(...sim.drainEvents());
    state = sim.state;
  }
  return { sim, script, state, events };
}

test("TB1 boot: slot 0 local, slot 1 AI at the default level", () => {
  const slots = tb1Slots();
  assert.equal(slots[0].controller, C.CONTROLLER.LOCAL);
  assert.equal(slots[1].controller, C.CONTROLLER.AI);
  assert.equal(slots[1].aiLevel, T.ai.defaultLevel);
  for (const s of slots) C.validateSlot(s);
});

test("TB1 script: the ruler walks the stairs to the east cannon and mans it", () => {
  const { state, script } = run((s, sc) => sc.phase === "aim" || sc.phase === "fire" || sc.phase === "watch");
  const ruler = state.rulers[0];
  assert.equal(ruler.manning, script.weaponId);
  assert.ok(ruler.pos.y >= 6.9, `ruler stands on the walkway (y ${ruler.pos.y})`);
  assert.ok(state.tick < 30 * T.sim.tickHz, `reached the gun in ${state.tick} ticks`);
});

test("TB1 script: aim, fire, ball mid-flight near the enemy, then hits the enemy plot", () => {
  const near = run((s) => ballNearEnemy(s));
  assert.ok(near.script.firedTick !== null, "fired");
  assert.ok(ballNearEnemy(near.state), `ball near enemy by tick ${near.state.tick}`);
  assert.ok(near.events.some((e) => e.type === C.EV.SHOT_FIRED && e.payload.slot === 0));
  assert.deepEqual(near.script.aim, { az: 893, range: 1016, flat: near.script.aim.flat });
  assert.equal(near.script.firedTick, 254);
  assert.equal(near.state.tick, 307, 'new golden capture tick');
  const enemyHp = near.state.castles[1].plot.hp.slice();
  const midTick = near.state.tick, midHash = near.sim.hash();
  // Continue: the ball lands on the enemy plot (block damage or impact inside its footprint).
  const sim = near.sim, script = near.script;
  let state = near.state, landed = null;
  for (let i = 0; i < 10 * T.sim.tickHz && !landed; i++) {
    sim.tick(script.next(state));
    for (const e of sim.drainEvents()) if (e.type === C.EV.IMPACT && e.payload.slot === 0) landed = e.payload;
    state = sim.state;
  }
  assert.ok(landed, "slot 0 ball impacted");
  assert.equal(state.tick, 348, 'first shot reproducibly hits the keep');
  assert.ok(state.castles[1].plot.hp.some((hp, i) => hp < enemyHp[i]), 'first scripted shot damages the enemy');
  const enemy = state.castles[1].plot;
  assert.ok(landed.pos[0] >= enemy.origin.x - 10 && landed.pos[0] <= enemy.origin.x + enemy.width + 10, `impact x ${landed.pos[0]} near the enemy plot`);
  // Determinism of the golden tick across two runs.
  const again = run((s) => ballNearEnemy(s));
  assert.equal(again.state.tick, midTick);
  assert.equal(again.sim.hash(), midHash);
});
