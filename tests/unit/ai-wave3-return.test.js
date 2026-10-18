// owns: physically executed leadership returns through authored stairs and lower-floor shelter.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import {registerCoreSim} from '../../src/plugins/index.sim.js';
import {createSim} from '../../src/sim/sim.js';
import {shelterCells} from '../../src/npc/brain.js';

test('an abandoning leader reaches its ground-floor shelter within thirty seconds using normal stairs',()=>{
 C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();let api;
 const map=C.getMap('forest-duel'),slots=map.slots.map((s,id)=>({id,castleId:s.castle,team:id,color:0,controller:id?C.CONTROLLER.LOCAL:C.CONTROLLER.AI,aiLevel:5,aiTactic:C.TACTIC.GENERAL}));
 const sim=createSim({map,slots,hooks:{onReady(a){api=a;},npcTick(_a,c){c.population=20;c.initialPopulation=40;},moraleTick(_a,c){c.morale=40;}}});
 let start;for(let t=0;t<90*30;t++){sim.tick();sim.drainEvents();if(api.state.rulers[0].manning===1){start=api.tick;break;}}
 assert.ok(start,'leader physically reaches the front gun first');
 const r=api.state.rulers[0],c=api.state.castles[0],origin={...r.pos};
 c.enemyImpacts=[{tick:api.tick,pos:{...r.pos}}];
 let reached=false,visitedStairs=false,abandoned=false;
 for(let t=0;t<30*30&&!reached;t++){
  sim.tick();sim.drainEvents();abandoned ||=r.manning===null;
  const cell=[Math.floor(r.pos.x-c.plot.origin.x),Math.floor(r.pos.y-c.plot.origin.y),Math.floor(r.pos.z-c.plot.origin.z)];
  visitedStairs ||=c.plot.type[cell[0]+48*cell[2]+2304*cell[1]]===C.BLOCK.STAIRS;
  reached=shelterCells(c).some(s=>Math.hypot(s[0]+.5+c.plot.origin.x-r.pos.x,s[1]+c.plot.origin.y-r.pos.y,s[2]+.5+c.plot.origin.z-r.pos.z)<.75);
 }
 assert.ok(abandoned);assert.ok(reached,`return failed at ${JSON.stringify(r.pos)} from ${JSON.stringify(origin)}`);
 assert.ok(visitedStairs,'return must execute the authored descending stair route');assert.equal(r.hp,100);assert.equal(r.manning,null);
 C.resetRegistriesForTests();
});

test('the return repair preserves an ordinary ground-floor retreat before leadership',async()=>{
 const {createAiController}=await import('../../src/ai/controller.js');
 C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();
 const v=createSim({map:'forest-duel'}).state;v.slots[0].controller=C.CONTROLLER.AI;
 v.castles[0].enemyImpacts=[{tick:0,pos:{...v.rulers[0].pos}}];
 const ai=createAiController();ai.think(v,v.slots[0],()=>.5);const m=ai.snapshot().slots[0];
 assert.equal(m.leadershipDone,undefined);assert.deepEqual(m.rulerPath.at(-1),[39,1,11]);
 C.resetRegistriesForTests();
});
