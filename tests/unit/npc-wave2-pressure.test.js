// Owns sustained losing-castle morale collapse, pressure causes and surrender-clock recovery.
import test from 'node:test';
import assert from 'node:assert/strict';
import { moraleTick, PRESSURE_CAUSE } from '../../src/npc/morale.js';
import { checkRules } from '../../src/sim/rules.js';
import { fixture } from './npc-fixture.test.js';
import { TUNING as T } from '../../src/tuning.js';

test('sustained palace damage and casualties can break morale within a match; quiet recovery resets the hold', () => {
  const f=fixture({population:40}); f.state.slots=[]; f.castle.population=18; f.castle.palaceIntegrity=.6;
  f.state.weapons=[{slot:0,hp:36}];
  for(let tick=0;tick<900*T.sim.tickHz&&!f.castle.surrendered;tick++) {
    f.castle.lastEnemyImpactTick=f.state.tick; moraleTick(f.api,f.castle); f.state.tick++;
  }
  assert.equal(f.castle.surrendered,true,`${f.castle.morale}`);
  assert.ok(f.castle.pressure.some(p=>p.cause===PRESSURE_CAUSE.PALACE_DAMAGE&&p.weight<0));
  assert.ok(f.castle.pressure.some(p=>p.cause===PRESSURE_CAUSE.DEATHS&&p.weight<0));
  checkRules(f.api);
  assert.equal(f.castle.surrender.moraleThreshold,T.rules.surrenderMorale);
  assert.equal(f.castle.surrender.holdRequiredTicks,45*T.sim.tickHz);
  assert.equal(f.castle.surrender.population,18);
  f.castle.surrendered=false; f.castle.eliminated=false; f.castle.moraleState.fast=50; f.castle.moraleState.baseline=50;
  f.castle.morale=50; f.state.tick++; moraleTick(f.api,f.castle); checkRules(f.api);
  assert.equal(f.castle.surrender.holdTicks,0);
});
