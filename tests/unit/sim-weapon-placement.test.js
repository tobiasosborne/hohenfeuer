// tests/unit/sim-weapon-placement.test.js - owns every weapon id through castle loading and designation commands.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';
import { content, fixture, IDS } from '../evidence/tb4-weapon-fixture.mjs';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim } from '../../src/sim/sim.js';
import { canDesignate, buildSiteReady } from '../../src/npc/designations.js';
import { planWeaponReplacement, captureBlueprint } from '../../src/ai/build.js';

for(const id of IDS) test(`${id}: castle loader and paid designation accept its id and mount`,()=>{
  C.resetRegistriesForTests();registerCoreSim();
  const base=C.getCastle('default');
  C.registerCastle({...base,id:'weapon-fixture',weapons:[{...base.weapons[0],id}]});
  const map={...C.getMap('forest-duel'),slots:C.getMap('forest-duel').slots.map(s=>({...s,castle:'weapon-fixture'}))};
  C.freezeRegistries();
  assert.equal(createSim({map,seed:1}).state.weapons[0].defId,id);
  const {sim,api}=fixture(id),castle=api.state.castles[0],def=C.getWeapon(id);
  const cell=[30,1,30];
  if(def.mount===C.MOUNT.WALL) api.setBlock({x:castle.plot.origin.x+30.5,y:1,z:castle.plot.origin.z+30.5},C.BLOCK.MOUNT);
  if(def.mount===C.MOUNT.WALL) cell[1]=2;
  const command={type:C.CMD.DESIGNATE_WEAPON,slot:0,seq:0,tick:0,cell,weapon:id,facing:0};
  assert.equal(canDesignate(castle,command,api.state),true);
  const before=castle.gold;sim.tick([command]);
  assert.equal(castle.npcDesignations[0].weapon,id);assert.equal(castle.gold,before-def.cost+T.economy.palaceIncomeS/T.sim.tickHz);
  assert.equal(buildSiteReady(castle,cell,api.state,id),true);
  const blueprint={cells:[],palace:[],mountSpots:[[...cell,0]],weapons:[{defId:id,at:cell,facing:0}]};
  castle.gold=2000;castle.npcDesignations=[];
  castle.plot.meta[cell[0]+48*cell[2]+2304*cell[1]]=0;
  assert.equal(planWeaponReplacement(castle,blueprint,C.TACTIC.GENERAL,[],{view:api.state})[0]?.weapon,id);
});

test('ground designation checks all nine supports, full 3x3x2 space and unavailable ids',()=>{
  content();const {api}=fixture('catapult'),castle=api.state.castles[0],p=castle.plot,cell=[30,1,30];
  const cmd={type:C.CMD.DESIGNATE_WEAPON,cell,weapon:'catapult'};
  assert.equal(canDesignate(castle,cmd,api.state),true);
  const i=31+48*31;p.type[i]=0;
  assert.equal(canDesignate(castle,cmd,api.state),false);p.type[i]=C.BLOCK.FOUNDATION;
  api.setBlock({x:p.origin.x+31.5,y:2,z:p.origin.z+31.5},C.BLOCK.STONE);
  assert.equal(canDesignate(castle,cmd,api.state),false);
  for(const id of ['zeppelin','bomb']) assert.equal(canDesignate(castle,{...cmd,weapon:id},api.state),false);
});

test('ground weapon mason stays outside its footprint and builds for the ground duration', async()=>{
  content();
  const {fixture: npcFixture,person}=await import('./npc-fixture.test.js');
  const {npcCommand}=await import('../../src/npc/index.js');
  const {emitJobs,claimJob,tickWork}=await import('../../src/npc/jobs.js');
  const {TUNING:T}=await import('../../src/tuning.js');
  const f=npcFixture(),cell=[5,1,3];f.castle.morale=50;
  assert.ok(npcCommand(f.api,{type:C.CMD.DESIGNATE_WEAPON,slot:0,cell,weapon:'catapult',facing:0}));
  assert.equal(npcCommand(f.api,{type:C.CMD.DESIGNATE,slot:0,cell:[6,1,4],block:C.BLOCK.STONE}),false,'pending footprint is reserved');
  const npc=person(4,C.ROLE.MASON,[5,1,0]);f.state.npcs.push(npc);
  emitJobs(f.api,f.castle);assert.ok(claimJob(f.api,f.castle,npc));
  const end=npc.path.at(-1);
  assert.ok(Math.abs(end[0]-cell[0])>=2 || Math.abs(end[2]-cell[2])>=2,'work goal is outside full footprint');
  npc.pos={x:end[0]+0.5,y:end[1],z:end[2]+0.5};npc.state=C.NPC_STATE.WORK;
  let placed;f.api.placeWeapon=(slot,id,at)=>{placed={id,at};return 7;};
  for(let t=0;t<T.weaponRules.buildWallS*30;t++){tickWork(f.api,f.castle,npc);f.state.tick++;}
  assert.equal(placed,undefined,'ground weapon must not complete at wall duration');
  for(let t=T.weaponRules.buildWallS*30;t<T.weaponRules.buildGroundS*30;t++){tickWork(f.api,f.castle,npc);f.state.tick++;}
  assert.equal(placed.id,'catapult');assert.deepEqual(placed.at,cell);
});
