// tests/unit/ai-aim.test.js - owns geometric aim, observed correction and seeded accuracy fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { geometryAim, createAimMemory, aimShot, recordAim, observeImpact, windChanged, aimNoise } from '../../src/ai/aim.js';
import { buildRangeTable, dialToElevation, traceFlight } from '../../src/sim/ballistics.js';
import { TUNING as T } from '../../src/tuning.js';
import { DEG, sin, cos } from '../../src/core/fmath.js';

const weapon = T.weapons.cannon;
const table = buildRangeTable(weapon);
const shooter = [0, 0, 0], target = [0, 0, -T.ai.hitTest.distanceM];
const neutral = () => 0.5;

test('geometry obeys north/east dial semantics and clamps through the production table', () => {
  const north = geometryAim(shooter, target, weapon, { x: 0, z: 0 }, table);
  assert.equal(north.azDeg, 0);
  assert.equal(north.dial, T.ai.hitTest.distanceM / T.aim.dialUnitM);
  assert.equal(north.elevation, dialToElevation(table, north.dial));
  assert.equal(geometryAim(shooter, [192, 0, 0], weapon, undefined, table).azDeg, 90);
  assert.equal(geometryAim(shooter, [-192, 0, 0], weapon, undefined, table).azDeg, 270);
  const far = geometryAim(shooter, [0, 0, -10000], weapon, undefined, table);
  assert.equal(far.reachable, false);
  assert.equal(far.dial, table.at(-1).range / T.aim.dialUnitM);
});

test('published crosswind is compensated using the production integrator', () => {
  const wind = { x: T.wind.driftTest.windMs, z: 0 };
  const solution = geometryAim(shooter, target, weapon, wind, table);
  const impact = traceFlight({ ...weapon, elevation: solution.elevation, azimuth: solution.azDeg, wind });
  assert.ok(Math.abs(impact.pos.x) < 0.1, JSON.stringify(impact.pos));
  assert.ok(Math.abs(impact.pos.z - target[2]) < 0.1);
  assert.ok(solution.azDeg > 180, 'aim west into wind blowing east');
});

test('observed angular and radial miss, rather than guessed error, drives correction', () => {
  const level = 5, memory = createAimMemory('palace', 1);
  const solution = geometryAim(shooter, target, weapon, undefined, table);
  aimShot(solution, level, neutral, memory);
  const missAz = 2, missM = 10, r = T.ai.hitTest.distanceM + missM;
  const impact = [r * sin(missAz * DEG), 0, -r * cos(missAz * DEG)];
  const before = structuredClone(memory);
  const corrected = observeImpact(memory, { shooter, target, impact, level });
  assert.deepEqual(memory, before, 'aim helpers return state instead of mutating it');
  const alpha = T.ai.alphaBase + T.ai.alphaPerLevel * level;
  assert.ok(Math.abs(corrected.biasAzDeg + alpha * missAz) < 1e-10);
  assert.ok(Math.abs(corrected.biasDial + alpha * missM / T.aim.dialUnitM) < 1e-10);
  assert.equal(corrected.observations, 1);
  const next = aimShot(solution, level, neutral, corrected);
  assert.ok(next.az >= 3500 && next.az < 3600);
  assert.equal(next.range, Math.round((solution.dial + corrected.biasDial) * T.aim.rangeUnitsPerDial));
});

test('noise shrinks with observations, respects level bounds and wind rolls back two steps', () => {
  const n0 = aimNoise(10, 0), n1 = aimNoise(10, 1);
  assert.equal(n0.azDeg, T.ai.sAz0PerLevelDeg);
  assert.equal(n0.rangeFrac, T.ai.sR0PerLevel);
  assert.equal(n1.azDeg, n0.azDeg * T.ai.shrink);
  assert.ok(aimNoise(10, 100).azDeg >= T.ai.sMinCoefDeg);
  assert.throws(() => aimNoise(0, 0), /level/i);
  const memory = { ...createAimMemory('a', 1), observations: 5, biasDial: 2 };
  assert.equal(windChanged(memory).observations, 5 - T.ai.windResetSteps);
  assert.equal(windChanged(memory).biasDial, 2);
  assert.equal(windChanged(createAimMemory('a', 1)).observations, 0);
});

test('correction starts from actual fired settings including the previous exploration error', () => {
  const solution = geometryAim(shooter, target, weapon, undefined, table);
  const memory = createAimMemory('palace', 1), command = aimShot(solution, 10, () => 0.75, memory);
  const fired = recordAim(memory, solution, command);
  const impact = traceFlight({ ...weapon, elevation: dialToElevation(table, command.range / T.aim.rangeUnitsPerDial), azimuth: command.az / T.aim.azUnitsPerDeg }).pos;
  const corrected = observeImpact(fired, { shooter, target, impact, level: 10 });
  const next = aimShot(solution, 10, neutral, corrected);
  assert.ok(next.az <= 1 || next.az >= 3599, 'full level-10 correction removes previous exploration error');
  assert.ok(Math.abs(next.range / T.aim.rangeUnitsPerDial * T.aim.dialUnitM - T.ai.hitTest.distanceM) <= 0.5);
});
