// tests/unit/rules-tb1.test.js - owns tracer bullet 1 (headless): one cannon shot hits the enemy palace.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim } from '../../src/sim/sim.js';
import { indexToCell, cellToWorld } from '../../src/world/grid.js';
import { solveAim, createTb1Script } from '../../src/tb1-script.js';
import { windVector } from '../../src/sim/wind.js';
import { palaceIntegrity } from '../../src/sim/rules.js';

function boot(seed = 1) {
  C.resetRegistriesForTests();
  registerCoreSim();
  C.freezeRegistries();
  return createSim({ map: 'forest-duel', seed });
}
const cmd = (type, slot, tick, seq, fields) => ({ type, slot, tick, seq, ...fields });

test('TB1: slot 0 cannon shot reaches and damages the slot 1 castle (headless)', () => {
  const sim = boot(1);
  const me = sim.state.castles[0], enemy = sim.state.castles[1];
  const weapon = sim.state.weapons.filter(w => w.slot === 0)[1];
  assert.ok(weapon, 'slot 0 has a cannon');
  const cells = enemy.palaceCells.map(i => indexToCell(enemy.plot, i));
  const centroid = cells.reduce((a, c) => ({ x: a.x + c.x / cells.length, y: a.y + c.y / cells.length, z: a.z + c.z / cells.length }), { x: 0, y: 0, z: 0 });
  const target = cellToWorld(enemy.plot, centroid.x, centroid.y, centroid.z);
  const before = palaceIntegrity(enemy);
  assert.equal(before, 1);
  // TB2 crew rule (DESIGN 3.5): someone must be at the gun, so the ruler walks up and mans it first.
  const walk = createTb1Script();
  for (let i = 0; i < 30 * T.sim.tickHz && sim.state.rulers[0].manning !== weapon.id; i++) sim.tick(walk.next(sim.state));
  assert.equal(sim.state.rulers[0].manning, weapon.id, 'ruler mans the east cannon');
  sim.drainEvents();
  const aim = solveAim(weapon.pos, target, windVector(sim.state.wind));
  assert.ok(aim.flat > 100 && aim.flat < 400, `castles are a duel distance apart (${aim.flat.toFixed(1)} m)`);
  sim.tick([cmd(C.CMD.AIM, 0, sim.state.tick, 0, { weaponId: weapon.id, az: aim.az, range: aim.range })]);
  sim.tick([cmd(C.CMD.FIRE, 0, sim.state.tick, 0, { weaponId: weapon.id })]);
  let hit = false;
  for (let i = 0; i < T.sim.tickHz * 10 && !hit && !sim.state.outcome; i++) {
    sim.tick([]);
    hit = sim.drainEvents().some(e => [C.EV.BLOCK_DAMAGED, C.EV.BLOCK_DESTROYED].includes(e.type) && e.payload.plot === enemy.plot.id);
  }
  assert.ok(hit, `first shot damaged the enemy (az ${aim.az}, range ${aim.range})`);
  assert.ok(palaceIntegrity(enemy) <= before, 'palace integrity did not increase');
  assert.equal(palaceIntegrity(me), 1, 'own palace untouched');
  if (sim.state.outcome) assert.deepEqual(sim.state.outcome.winners, [0], 'a palace hit may now end the duel');
});

test('TB1: the same shot sequence is deterministic (hash equal across two sims)', () => {
  const a = boot(7), b = boot(7);
  const w = a.state.weapons.find(x => x.slot === 0);
  for (let i = 0; i < 300; i++) {
    const cmds = i === 0 ? [cmd(C.CMD.AIM, 0, 0, 0, { weaponId: w.id, az: 900, range: 1400 })] : i === 1 ? [cmd(C.CMD.FIRE, 0, 1, 0, { weaponId: w.id })] : [];
    a.tick(cmds); b.tick(cmds);
  }
  assert.equal(a.hash(), b.hash());
});
