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

test('a warning interrupting an unmanned repair remembers and re-mans the pending gun',()=>{
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();
  const sim=createSim({map:'forest-duel'}),policy=createPolicy(sim.state,'novice');
  for(let tick=0;tick<450&&sim.state.rulers[0].manning===null;tick++){sim.tick(policy.next(sim.state,null));sim.drainEvents();}
  const v=sim.state;policy.next(v,null);const id=v.rulers[0].manning;
  v.tick=450;v.weapons.find(w=>w.id===id).reload=0;
  const leave=policy.next(v,{localDamaged:[{cell:[41,7,23]}],localSites:[]});
  assert.ok(leave.some(c=>c.type===C.CMD.LEAVE_WEAPON));v.rulers[0].manning=null;
  policy.observe(v,[{type:C.EV.RULER_THREAT,payload:{castle:0,impactPos:[v.rulers[0].pos.x,v.rulers[0].pos.y,v.rulers[0].pos.z+4],etaTicks:90}}]);
  policy.next(v,null);v.tick+=151;
  const returned=policy.next(v,null);
  assert.ok(returned.some(c=>c.type===C.CMD.MAN_WEAPON&&c.weaponId===id));
  C.resetRegistriesForTests();
});

test('a novice whose front gun is lost walks to a surviving battery and resumes paid fire',()=>{
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();let api;
  const sim=createSim({map:'forest-duel',hooks:{onReady(a){api=a;}}}),policy=createPolicy(sim.state,'novice');
  for(let tick=0;tick<450&&api.state.rulers[0].manning===null;tick++){sim.tick(policy.next(api.state,null));sim.drainEvents();}
  policy.next(api.state,null);const lost=api.state.rulers[0].manning;
  api.state.weapons.find(w=>w.id===lost).hp=0;
  let manned=false,fired=false;
  for(let tick=0;tick<60*30&&!fired;tick++){
    const s=api.state,commands=policy.next(s,s.tick%30===0?policy.options(s):null);sim.tick(commands);
    manned ||=api.state.rulers[0].manning===0;
    const events=sim.drainEvents();policy.observe(api.state,events);fired ||=events.some(e=>e.type===C.EV.SHOT_FIRED&&e.payload.slot===0&&e.payload.weaponId===0);
  }
  assert.ok(manned,`ruler stopped at ${JSON.stringify(api.state.rulers[0].pos)}`);assert.ok(fired,'the survivor remains a real paid, manned gun');
  C.resetRegistriesForTests();
});

test('a novice can re-man a visible nearby gun from a damaged ledge without an operator-cell route',()=>{
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();let api;
  const sim=createSim({map:'forest-duel',hooks:{onReady(a){api=a;}}}),policy=createPolicy(sim.state,'novice');
  for(let t=0;t<450&&api.state.rulers[0].manning===null;t++){sim.tick(policy.next(api.state,null));sim.drainEvents();}
  policy.next(api.state,null);const r=api.state.rulers[0],id=r.manning;
  sim.tick([{type:C.CMD.LEAVE_WEAPON,slot:0,tick:api.tick,seq:0}]);
  for(const dx of [-r.radius,r.radius])for(const dz of [-r.radius,r.radius])api.setBlock({x:r.pos.x+dx,y:6,z:r.pos.z+dz},C.BLOCK.AIR);
  for(let t=0;t<30;t++){sim.tick();sim.drainEvents();}
  assert.equal(r.pos.y,6,'the body physically drops onto the surviving lower ledge');
  const commands=policy.next(api.state,null);
  assert.ok(commands.some(c=>c.type===C.CMD.MAN_WEAPON&&c.weaponId===id),'legal E range and sight do not require standing on the authored operator cell');
  sim.tick(commands);assert.equal(r.manning,id);
  C.resetRegistriesForTests();
});

test('a ground miss inside the enemy plot corrects charge; a wall interception keeps it',()=>{
 for(const [hitKind,y,expected] of [['ground',1,1020],['enemy-wall',5,1000],['palace',2.5,1000]]){
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();
  const sim=createSim({map:'forest-duel'}),policy=createPolicy(sim.state,'novice');
  for(let t=0;t<450&&sim.state.rulers[0].manning===null;t++){sim.tick(policy.next(sim.state,null));sim.drainEvents();}
  const v=sim.state;v.tick=Math.ceil(v.tick/30)*30;const id=v.rulers[0].manning;
  const before=policy.next(v,null).find(c=>c.type===C.CMD.AIM&&c.weaponId===id);assert.equal(before.range,1000);
  const o=v.castles[1].plot.origin;
  policy.observe(v,[{type:C.EV.IMPACT,payload:{slot:0,weaponId:id,projectileId:999,pos:[o.x+1,y,o.z+21],hit:'block',hitKind}}]);
  const after=policy.next(v,null).find(c=>c.type===C.CMD.AIM&&c.weaponId===id);
  assert.equal(after.range,expected,hitKind);
 }
 C.resetRegistriesForTests();
});
