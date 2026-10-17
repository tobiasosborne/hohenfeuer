// tests/unit/npc-morale.test.js - owns every morale input and spiral-guard acceptance fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EV, ROLE, NPC_STATE, K } from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';
import { moraleTick, queueMoraleInput, recordNpcEvent, recordProjectileResult, workSpeed } from '../../src/npc/morale.js';
import { fixture, person } from './npc-fixture.test.js';

function step(f, input) { if (input) queueMoraleInput(f.castle, input); moraleTick(f.api, f.castle); f.state.tick++; }
function expected(fast, baseline) { return fast + (baseline - fast) * K.DT / T.morale.tauFastS; }
function checkImpulse(input, delta, start = 50) {
  const f = fixture(); f.castle.morale = start; step(f, input);
  assert.ok(Math.abs(f.castle.moraleState.fast - expected(start + delta, start)) < 1e-9);
  return f;
}
for (const role of [ROLE.CREW, ROLE.RUNNER, ROLE.MASON, ROLE.CIVILIAN]) test(`morale row: own ${role} killed, counted once`, () => {
  const delta = role === ROLE.CIVILIAN ? T.morale.civilianDeath : T.morale.crewDeath;
  const f = checkImpulse({ deaths: [{ entityId: 9, role }] }, delta);
  const before = f.castle.moraleState.fast;
  step(f, { deaths: [{ entityId: 9, role }] });
  assert.ok(f.castle.moraleState.fast > before);
});

test('morale row: deaths capped at -15 in a rolling 10 second window', () => {
  const f = checkImpulse({ deaths: Array.from({ length: 20 }, (_, entityId) => ({ entityId, role: ROLE.CREW })) }, T.morale.deathCap);
  const before = f.castle.moraleState.fast;
  step(f, { deaths: [{ entityId: 50, role: ROLE.CREW }] }); assert.ok(f.castle.moraleState.fast > before);
  f.state.tick = T.morale.deathWindowS * K.TICK_HZ;
  const fast = f.castle.moraleState.fast;
  step(f, { deaths: [{ entityId: 51, role: ROLE.CREW }] }); assert.ok(f.castle.moraleState.fast < fast - 1);
});

test('morale row: palace damaged -4 per projectile regardless of number of cells', () => {
  const f = fixture(); f.castle.morale = 50;
  const hit = { projectileId: 7, sourceSlot: 1, castle: 0, palaceDamaged: true, blocksDamaged: 20, blocksDestroyed: 10 };
  recordProjectileResult(f.api, hit); recordProjectileResult(f.api, hit); step(f);
  assert.ok(Math.abs(f.castle.moraleState.fast - expected(50 + T.morale.palaceHit, 50)) < 1e-9);
});
test('morale row: our damaging hit gives +2 once per projectile', () => checkImpulse({ ourHits: 1 }, T.morale.ourHit));
test('morale row: enemy blocks destroyed +0.5 each capped +3 per projectile', () => checkImpulse({ enemyBlocks: 99 }, T.morale.enemyBlockCap));
test('morale row: enemy weapon destroyed +5 each', () => checkImpulse({ enemyWeapons: 1 }, T.morale.enemyWeapon));
test('morale row: enemy NPC kills +0.5 each capped +3 per projectile', () => checkImpulse({ enemyNpcs: 99 }, T.morale.enemyNpcCap));
test('morale row: under fire -0.1 per second, expires after 10 seconds', () => {
  const f = fixture(); f.castle.morale = 50;
  recordNpcEvent(f.api, EV.IMPACT, { slot: 1, pos: [3, 1, 3], projectileId: 4 }); step(f);
  assert.ok(Math.abs(f.castle.moraleState.fast - expected(50 + T.morale.underFireS * K.DT, 50)) < 1e-9);
  f.state.tick = T.morale.underFireWindowS * K.TICK_HZ;
  const fast = f.castle.moraleState.fast; step(f); assert.ok(f.castle.moraleState.fast > fast);
});
test('morale row: palace integrity below half drains -0.2 per second', () => {
  const f = fixture(); f.castle.morale = 50; f.castle.palaceIntegrity = T.palace.moraleDrainBelow - 0.1; step(f);
  assert.ok(Math.abs(f.castle.moraleState.fast - expected(50 + T.morale.palaceLowS * K.DT, 50)) < 1e-9);
});
test('morale row: shelter bonus needs order and at least 80% of civilians sheltered', () => {
  const f = fixture(); f.castle.morale = 50; f.castle.shelter = true;
  f.state.npcs = Array.from({ length: 5 }, (_, i) => ({ ...person(i, ROLE.CIVILIAN), state: i < 4 ? NPC_STATE.SHELTER : NPC_STATE.IDLE }));
  step(f); assert.ok(Math.abs(f.castle.moraleState.fast - expected(50 + T.morale.shelterS * K.DT, 50)) < 1e-9);
  f.castle.shelter = false; const fast = f.castle.moraleState.fast, base = f.castle.moraleState.baseline; step(f);
  assert.ok(Math.abs(f.castle.moraleState.fast - expected(fast, base)) < 1e-9);
});
test('morale row: rally on first damaging hit after <30, only once per 60 seconds', () => {
  const f = checkImpulse({ ourHits: 1 }, T.morale.ourHit + T.morale.rally, 20);
  f.castle.moraleState.fast = 20; f.castle.moraleState.baseline = 20; f.castle.morale = 20;
  step(f, { ourHits: 1 }); assert.ok(f.castle.moraleState.fast < 23);
  f.state.tick = T.morale.rallyCooldownS * K.TICK_HZ;
  step(f, { ourHits: 1 }); assert.ok(f.castle.moraleState.fast > 35);
});

test('layers floor at 8, baseline moves no faster than 0.05/s, bands emit once per crossing', () => {
  const f = fixture(); f.castle.morale = 50; step(f, { palaceHits: 100 });
  assert.ok(f.castle.moraleState.fast >= T.morale.floor);
  assert.ok(50 - f.castle.moraleState.baseline <= T.morale.baselineRateS * K.DT + 1e-9);
  assert.ok(f.events.some(e => e.type === EV.MORALE_BAND));
  const n = f.events.filter(e => e.type === EV.MORALE_BAND).length; step(f);
  assert.equal(f.events.filter(e => e.type === EV.MORALE_BAND).length, n);
});

test('work bands, ruler leadership radius and cap follow tuning', () => {
  for (const [morale, speed] of T.morale.workBands) {
    const f = fixture(); f.castle.morale = morale; assert.equal(workSpeed(f.castle), speed);
    const npc = person(4, ROLE.CREW), ruler = { hp: 100, pos: { ...npc.pos } };
    assert.equal(workSpeed(f.castle, npc, ruler), Math.min(T.npc.workSpeedCap, speed + T.npc.leadershipBonus));
    ruler.pos.x += T.npc.leadershipM + 1; assert.equal(workSpeed(f.castle, npc, ruler), speed);
  }
});

test('surrender requires 45 continuous seconds at <=10, resets above threshold', () => {
  const f = fixture(); f.castle.morale = T.morale.floor;
  for (let i = 0; i < T.rules.surrenderS * K.TICK_HZ - 1; i++) step(f);
  assert.equal(f.castle.surrendered, undefined); step(f); assert.equal(f.castle.surrendered, true);
  const g = fixture(); g.castle.morale = T.morale.floor; step(g);
  g.castle.moraleState.fast = 50; g.castle.moraleState.baseline = 50; step(g);
  assert.equal(g.castle.moraleState.surrenderTicks, 0);
});
