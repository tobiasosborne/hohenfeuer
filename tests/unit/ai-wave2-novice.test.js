// Owns the legal novice proxy's response to the same launch warning available to a player.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim } from '../../src/sim/sim.js';
import { createPolicy } from '../../scripts/novice.mjs';
test('a warned novice leaves the gun and moves along its rampart before impact',()=>{
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();
  const sim=createSim({map:'forest-duel'}),policy=createPolicy(sim.state,'novice');
  for(let tick=0;tick<450&&sim.state.rulers[0].manning===null;tick++){sim.tick(policy.next(sim.state,null));sim.drainEvents();}
  const v=sim.state;assert.notEqual(v.rulers[0].manning,null);
  policy.next(v,null); // finish the E/crew bookkeeping
  policy.observe(v,[{type:C.EV.RULER_THREAT,payload:{castle:0,fromCastle:1,fromWeapon:2,projectileId:100,impactPos:[v.rulers[0].pos.x,v.rulers[0].pos.y,v.rulers[0].pos.z+4],etaTicks:90}}]);
  const commands=policy.next(v,null);
  assert.ok(commands.some(c=>c.type===C.CMD.LEAVE_WEAPON));
  assert.ok(commands.some(c=>c.type===C.CMD.MOVE&&c.fwd>0));
  const first=commands.find(c=>c.type===C.CMD.MOVE);assert.equal(first.yaw,0,'move north when the predicted impact is south of the ruler');
  v.rulers[0].manning=null;v.rulers[0].pos.z-=6;v.tick+=30;
  policy.observe(v,[{type:C.EV.RULER_THREAT,payload:{castle:0,etaTicks:90}}]);
  const repeated=policy.next(v,null).find(c=>c.type===C.CMD.MOVE);
  assert.ok(repeated.fwd>0,'a second shell aimed at the refuge needs a new escape, not a longer wait');
  assert.notEqual(repeated.yaw,first.yaw);
  C.resetRegistriesForTests();
});
