// tests/unit/rules-tb1.test.js - owns tracer bullet 1 (headless): one cannon shot hits the enemy palace.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim } from '../../src/sim/sim.js';
import { indexToCell, cellToWorld } from '../../src/world/grid.js';
import { atan2, PI } from '../../src/core/fmath.js';
import { palaceIntegrity } from '../../src/sim/rules.js';

function boot(seed = 1) {
  C.resetRegistriesForTests();
  registerCoreSim();
  C.freezeRegistries();
  return createSim({ map: 'forest-duel', seed });
}
const cmd = (type, slot, tick, seq, fields) => ({ type, slot, tick, seq, ...fields });

/** Aim solution: azimuth tenths of a degree clockwise from north; range dial tenths from flat distance (same-height assumption). */
function solve(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  let azDeg = atan2(dx, -dz) * 180 / PI; if (azDeg < 0) azDeg += 360;
  const flat = Math.sqrt(dx * dx + dz * dz);
  return { az: Math.round(azDeg * T.aim.azUnitsPerDeg) % 3600, range: Math.round(flat / T.aim.dialUnitM * T.aim.rangeUnitsPerDial), flat };
}

test('TB1: slot 0 cannon shot reaches and damages the slot 1 castle (headless)', () => {
  const sim = boot(1);
  const me = sim.state.castles[0], enemy = sim.state.castles[1];
  const weapon = sim.state.weapons.find(w => w.slot === 0);
  assert.ok(weapon, 'slot 0 has a cannon');
  const cells = enemy.palaceCells.map(i => indexToCell(enemy.plot, i));
  const centroid = cells.reduce((a, c) => ({ x: a.x + c.x / cells.length, y: a.y + c.y / cells.length, z: a.z + c.z / cells.length }), { x: 0, y: 0, z: 0 });
  const target = cellToWorld(enemy.plot, centroid.x, centroid.y, centroid.z);
  const before = palaceIntegrity(enemy);
  assert.equal(before, 1);
  const aim = solve(weapon.pos, target);
  assert.ok(aim.flat > 100 && aim.flat < 400, `castles are a duel distance apart (${aim.flat.toFixed(1)} m)`);
  // Fire repeatedly until a hit; the solver is approximate, so sweep the range dial in small steps around the solution.
  let hit = false, shots = 0;
  for (let attempt = 0; attempt <= 16 && !hit; attempt++) {
    const range = Math.max(0, Math.min(9999, aim.range + (attempt % 2 ? 1 : -1) * Math.ceil(attempt / 2) * 10));
    sim.tick([cmd(C.CMD.AIM, 0, sim.state.tick, 0, { weaponId: weapon.id, az: aim.az, range })]);
    sim.tick([cmd(C.CMD.FIRE, 0, sim.state.tick, 0, { weaponId: weapon.id })]);
    shots++;
    for (let i = 0; i < T.sim.tickHz * 23; i++) {
      sim.tick([]);
      const evs = sim.drainEvents();
      if (evs.some(e => e.type === C.EV.BLOCK_DAMAGED && e.payload.plot === enemy.plot.id)) { hit = true; break; }
    }
  }
  assert.ok(hit, `a cannon shot damaged the enemy plot after ${shots} shots (az ${aim.az}, range ${aim.range}, flat ${aim.flat.toFixed(1)} m)`);
  assert.ok(palaceIntegrity(enemy) <= before, 'palace integrity did not increase');
  assert.equal(palaceIntegrity(me), 1, 'own palace untouched');
  assert.equal(sim.state.outcome, null, 'game continues after one hit');
});

test('TB1: the same shot sequence is deterministic (hash equal across two sims)', () => {
  const a = boot(7), b = boot(7);
  const w = a.state.weapons.find(x => x.slot === 0);
  for (let i = 0; i < 300; i++) {
    const cmds = i === 0 ? [cmd(C.CMD.AIM, 0, 0, 0, { weaponId: w.id, az: 900, range: 380 })] : i === 1 ? [cmd(C.CMD.FIRE, 0, 1, 0, { weaponId: w.id })] : [];
    a.tick(cmds); b.tick(cmds);
  }
  assert.equal(a.hash(), b.hash());
});
