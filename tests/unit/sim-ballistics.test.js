// tests/unit/sim-ballistics.test.js - owns projectile, dial and seeded wind acceptance fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { launchVelocity, integrateProjectile, traceFlight, buildRangeTable, dialToElevation, elevationToDial } from '../../src/sim/ballistics.js';
import { createWind, tickWind, windVector, windHud, markWindShot } from '../../src/sim/wind.js';
import { TUNING as T } from '../../src/tuning.js';
import { hash } from '../../src/core/hash.js';
import { DEG, sin } from '../../src/core/fmath.js';

test('zero wind k=0 semi-implicit flight is within 0.5% of analytic range', () => {
  for (const elevation of [10, 15, 25, 45, 70, 80]) {
    const speed = T.weapons.cannon.v0;
    const flight = traceFlight({ v0: speed, elevation, k: 0 });
    const analytic = speed * speed * sin(2 * elevation * DEG) / T.sim.gravity;
    assert.ok(Math.abs(flight.range / analytic - 1) < 0.005, `${elevation}: ${flight.range}/${analytic}`);
  }
  const p = { pos: { x: 0, y: 10, z: 0 }, vel: { x: 20, y: 3, z: -40 }, k: T.weapons.cannon.k };
  const h = 1 / T.sim.tickHz / T.sim.substeps;
  integrateProjectile(p, { x: 15, z: -2 });
  assert.equal(p.vel.x, 20 + T.weapons.cannon.k * (15 - 20) * h);
  assert.equal(p.pos.y, 10 + (3 - T.sim.gravity * h) * h);
});

test('straight and lobbed range tables are monotonic and invert the dial within 0.1', () => {
  for (const id of ['cannon', 'catapult', 'rocket']) {
    const table = buildRangeTable(T.weapons[id]);
    for (let i = 1; i < table.length; i++) assert.ok(table[i].range > table[i - 1].range, id);
    const lo = table[0].range / T.aim.dialUnitM, hi = table.at(-1).range / T.aim.dialUnitM;
    for (let i = 0; i <= 100; i++) {
      const dial = lo + (hi - lo) * i / 100;
      assert.ok(Math.abs(elevationToDial(table, dialToElevation(table, dial)) - dial) < 0.1);
    }
  }
});

test('15 m/s crosswind at 192 m meets all three drift targets within 25%', () => {
  const calibration = T.wind.driftTest;
  for (const id of ['cannon', 'catapult', 'rocket']) {
    const weapon = T.weapons[id], table = buildRangeTable(weapon);
    const elevation = dialToElevation(table, calibration.distanceM / T.aim.dialUnitM);
    const baseline = traceFlight({ ...weapon, elevation });
    const windy = traceFlight({ ...weapon, elevation, wind: { x: calibration.windMs, z: 0 } });
    const drift = Math.abs(windy.pos.x - baseline.pos.x), target = calibration[`${id}M`];
    assert.ok(Math.abs(drift / target - 1) <= calibration.tolerance, `${id}: ${drift} m, target ${target}`);
  }
});

test('wind walk replays seed, respects strength and preserves previous arrow per slot', () => {
  const a = createWind({ seed: 1, strength: 5, change: 5 }), b = createWind({ seed: 1, strength: 5, change: 5 });
  for (let i = 0; i < 20000; i++) {
    tickWind(a); tickWind(b);
    assert.equal(hash(a), hash(b));
    assert.ok(a.speed >= 0 && a.speed <= T.wind.maxSpeedByStrength[5]);
  }
  assert.notEqual(hash(a), hash(createWind({ seed: 2, strength: 5, change: 5 })));
  const changed = createWind({ seed: 3, strength: 5, change: 5 });
  tickWind(changed, changed.nextChange + 0.001);
  assert.notEqual(windHud(changed, 0).previousDirection, null);
  markWindShot(changed, 0);
  assert.equal(windHud(changed, 0).previousDirection, null);
  assert.notEqual(windHud(changed, 1).previousDirection, null);
  tickWind(changed, T.wind.blueArrowS);
  assert.equal(windHud(changed, 1).previousDirection, null);
  const calm = createWind({ seed: 3, strength: 0, change: 0 });
  tickWind(calm, 1000);
  assert.deepEqual(windVector(calm), { x: 0, z: 0 });
  assert.equal(windHud(calm).direction, null);
});

test('launch convention is north=-z, east=+x and elevations are degrees', () => {
  const north = launchVelocity(10, 0, 0), east = launchVelocity(10, 0, 90);
  assert.ok(Math.abs(north.x) < 1e-12 && Math.abs(north.z + 10) < 1e-12);
  assert.ok(Math.abs(east.x - 10) < 1e-12 && Math.abs(east.z) < 1e-12);
});
