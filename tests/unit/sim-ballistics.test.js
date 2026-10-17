// tests/unit/sim-ballistics.test.js - owns converted executable ballistics and cyclic wind acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../../src/sim/ballistics.js';
import { createWind, tickWind, windVector, windHud, markWindShot } from '../../src/sim/wind.js';
import { TUNING as T } from '../../src/tuning.js';
import { hash } from '../../src/core/hash.js';
import { DEG, sin } from '../../src/core/fmath.js';

test('TB2: native length/time conversion preserves gravity, K and quadratic C/M', () => {
  assert.equal(T.sim.nativePositionM, 5 / 2048);
  assert.equal(T.sim.nativeTickS, 0.062);
  assert.equal(T.sim.gravity, 33 * T.sim.nativePositionM / T.sim.nativeTickS ** 2);
  assert.equal(T.weapons.cannon.speedPerCharge, 40 * T.sim.nativePositionM / T.sim.nativeTickS);
  assert.equal(T.weapons.cannon.k, 80 / (52 * 65536 * T.sim.nativePositionM));
  const p = { pos: { x: 0, y: 10, z: 0 }, vel: { x: 20, y: 3, z: -40 }, k: T.weapons.cannon.k };
  const h = 1 / T.sim.tickHz / T.sim.substeps, speed = Math.sqrt(5 ** 2 + 3 ** 2 + 38 ** 2);
  B.integrateProjectile(p, { x: 15, z: -2 });
  assert.equal(p.vel.x, 20 + p.k * speed * (15 - 20) * h);
  assert.equal(p.vel.y, 3 + (-p.k * speed * 3 - T.sim.gravity) * h);
  assert.equal(p.pos.y, 10 + p.vel.y * h);
});

test('zero-drag production flight agrees with the analytic parabola within 0.5%', () => {
  for (const elevation of [10, 15, 25, 45, 70, 80]) {
    const v0 = T.weapons.cannon.v0;
    const flight = B.traceFlight({ v0, elevation, k: 0, maxTime: 90 });
    const analytic = v0 * v0 * sin(2 * elevation * DEG) / T.sim.gravity;
    assert.ok(Math.abs(flight.range / analytic - 1) < 0.005, `${elevation}: ${flight.range}/${analytic}`);
  }
});

test('TB2: range is charge at a fixed elevation, with monotonic invertible tables', () => {
  for (const id of ['cannon', 'catapult', 'rocket']) {
    const weapon = T.weapons[id], table = B.buildRangeTable(weapon);
    for (let i = 1; i < table.length; i++) assert.ok(table[i].range > table[i - 1].range, id);
    for (const charge of [1, 48, 127, 200, 255]) {
      assert.equal(B.dialToElevation(table, charge), weapon.elevationDeg);
      assert.equal(B.dialToCharge(charge), charge);
      assert.equal(B.launchSpeed(weapon, charge), weapon.speedPerCharge * charge);
      const flight = B.traceFlight({ ...weapon, charge, elevation: weapon.elevationDeg });
      assert.ok(Math.abs(B.rangeToCharge(table, flight.range) - charge) < 0.1, `${id} charge ${charge}`);
    }
  }
  assert.equal(B.dialToCharge(0), 1);
  assert.equal(B.dialToCharge(999.9), 255);
  const cannon = B.traceFlight({ ...T.weapons.cannon, charge: 255, elevation: T.weapons.cannon.elevationDeg });
  assert.ok(cannon.range > T.world.duelDistanceM && cannon.range < T.world.duelDistanceM * 1.5, `${cannon.range}m full-charge cannon`);
});

test('TB2: scatter uses four angular draws, asymmetric elevation, and no speed noise', () => {
  const def = { id: 'cannon', ...T.weapons.cannon }, low = B.scatterAngles(def, 90, () => 0), high = B.scatterAngles(def, 90, () => 11 / 32768);
  assert.equal(low.azimuth, 90 - 11 * 360 / 4096);
  assert.equal(low.elevation, def.elevationDeg + Math.trunc(-5 * 11 / 4) * 360 / 4096);
  assert.equal(high.azimuth, 90 + 11 * 360 / 4096);
  assert.equal(high.elevation, def.elevationDeg + Math.trunc(11 / 4) * 360 / 4096);
});

test('TB2: nine wind strengths have constant magnitude and a precomputed 256x32 tick cycle', () => {
  assert.equal(T.wind.nativeSpeedByStrength.length, 9);
  for (let strength = 0; strength < 9; strength++) {
    const wind = createWind({ seed: 1, strength, change: 0 });
    assert.equal(wind.speed, T.wind.nativeSpeedByStrength[strength] * T.sim.nativePositionM / T.sim.nativeTickS);
    const before = windVector(wind); tickWind(wind, 1000); assert.deepEqual(windVector(wind), before);
    assert.equal(windHud(wind).speed, strength, 'compass number is the setting');
  }
  const a = createWind({ seed: 1, strength: 8, change: 5 }), b = createWind({ seed: 1, strength: 8, change: 5 });
  assert.equal(a.schedule.length, 256);
  const vector = windVector(a), cycle = 256 * 32 * T.sim.nativeTickS;
  for (let i = 0; i < 100; i++) {
    const changes = tickWind(a, cycle / 100); tickWind(b, cycle / 100);
    assert.equal(hash(a), hash(b));
    for (const c of changes) if (c.time < cycle) {
      const delta = (c.direction - c.previousDirection + 540) % 360 - 180;
      assert.ok(Math.abs(delta) <= 682 * 360 / 4096 + 1e-10);
    }
  }
  tickWind(a, 1e-8);
  assert.deepEqual(windVector(a), vector);
  assert.notEqual(hash(a.schedule), hash(createWind({ seed: 2, strength: 8, change: 5 }).schedule));
});

test('wind changes retain previous direction per slot until its next shot or timeout', () => {
  const changed = createWind({ seed: 3, strength: 5, change: 1 });
  tickWind(changed, changed.nextChange + 0.001);
  assert.notEqual(windHud(changed, 0).previousDirection, null);
  markWindShot(changed, 0);
  assert.equal(windHud(changed, 0).previousDirection, null);
  assert.notEqual(windHud(changed, 1).previousDirection, null);
  tickWind(changed, T.wind.blueArrowS);
  assert.equal(windHud(changed, 1).previousDirection, null);
  const calm = createWind({ seed: 3, strength: 0, change: 0 });
  assert.deepEqual(windVector(calm), { x: 0, z: 0 });
  assert.equal(windHud(calm).direction, null);
});

test('launch convention remains north=-z, east=+x with elevations in degrees', () => {
  const north = B.launchVelocity(10, 0, 0), east = B.launchVelocity(10, 0, 90);
  assert.ok(Math.abs(north.x) < 1e-12 && Math.abs(north.z + 10) < 1e-12);
  assert.ok(Math.abs(east.x - 10) < 1e-12 && Math.abs(east.z) < 1e-12);
});
