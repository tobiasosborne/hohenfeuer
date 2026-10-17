// tests/unit/sim-economy-wave.test.js - owns credited income and gold-bound repair work.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TUNING as T } from '../../src/tuning.js';
import { tickEconomy } from '../../src/sim/economy.js';
import { damageBlock } from '../../src/sim/damage.js';
import { BLOCK, ROLE, NPC_STATE, JOB } from '../../src/contracts.js';
import { emitJobs, claimJob, tickWork } from '../../src/npc/jobs.js';
import { fixture, person } from './npc-fixture.test.js';
test('income stats count credited gold and exclude overflow at the cap', () => {
  const castle = { gold:T.economy.goldCap-1,civiliansWorking:2,stats:{income:0} };
  tickEconomy({state:{castles:[castle]}},1);
  assert.equal(castle.gold,T.economy.goldCap); assert.equal(castle.stats.income,1);
  tickEconomy({state:{castles:[castle]}},1); assert.equal(castle.stats.income,1);
});
test('damage invalidates job scan after an unchanged tick; zero gold stops paid repair', () => {
  const f=fixture();f.castle.workSpots=[];f.put(3,1,2,BLOCK.STONE);emitJobs(f.api,f.castle);
  const i=3+f.plot.width*2+f.plot.width*f.plot.depth;
  damageBlock({getBlock:()=>T.blocks.stone},f.plot,i,31,1);emitJobs(f.api,f.castle);
  assert.equal(f.castle.jobs[0].kind,JOB.REPAIR);
  const n=person(4,ROLE.MASON,[2,1,2]);f.state.npcs.push(n);claimJob(f.api,f.castle,n);n.state=NPC_STATE.WORK;
  f.castle.gold=0;
  for(let i=0;i<30;i++){tickWork(f.api,f.castle,n);f.state.tick++;}
  assert.equal(f.plot.hp[i],9);
  f.castle.gold=1;tickWork(f.api,f.castle,n);assert.ok(f.plot.hp[i]>9);assert.ok(f.castle.gold<1);
});
test('map-only palace repairs consume materials rather than creating free keep health', () => {
  const f=fixture();f.castle.workSpots=[];f.put(3,1,2,BLOCK.PALACE,5);
  const n=person(4,ROLE.MASON,[2,1,2]);f.state.npcs.push(n);emitJobs(f.api,f.castle);claimJob(f.api,f.castle,n);n.state=NPC_STATE.WORK;
  const i=3+f.plot.width*2+f.plot.width*f.plot.depth;f.castle.gold=0;
  for(let j=0;j<30;j++){tickWork(f.api,f.castle,n);f.state.tick++;}
  assert.equal(f.plot.hp[i],5);
});
test('a destroyed cannon returns capped wreck materials once, while replacement still costs gold', async () => {
  const C=await import('../../src/contracts.js'),{registerCoreSim}=await import('../../src/plugins/index.sim.js'),{applyBlast}=await import('../../src/sim/damage.js');
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();const f=fixture();f.castle.gold=100;
  const gun={id:0,slot:0,defId:'cannon',hp:1,pos:{x:3.5,y:1,z:3.5}};f.state.weapons=[gun];
  const ctx={state:f.state,castleOf:f.api.castleOf,getBlock:C.getBlock,getWeapon:C.getWeapon,emit:f.api.emit};
  const blast={pos:gun.pos,hit:{weaponId:0},direct:2,splash:0,radius:0,sourceSlot:1};applyBlast(ctx,blast);
  assert.equal(f.castle.gold,475);applyBlast(ctx,blast);assert.equal(f.castle.gold,475);assert.ok(f.castle.gold<C.getWeapon('cannon').cost);
});
