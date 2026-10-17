// Owns escape from isolated repair ledges and reconstruction of broken gun ladders.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK } from '../../src/contracts.js';
import { fixture } from './npc-fixture.test.js';
import { findPath, neighbors } from '../../src/npc/path.js';
import * as C from '../../src/contracts.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim } from '../../src/sim/sim.js';
import { npcTick,spawnPopulation } from '../../src/npc/brain.js';
import { npcKinematics } from '../../src/npc/kinematics.js';
import { setCell } from '../../src/world/grid.js';
import { addJob,expireClaims,setPath,releaseClaim } from '../../src/npc/jobs.js';
import { person } from './npc-fixture.test.js';

test('workers can step clear and safely descend a three-metre repair ledge', () => {
  const f=fixture(); for(let y=1;y<=3;y++)f.put(3,y,3,BLOCK.STONE);
  const path=findPath(f.plot,[3,4,3],[4,1,3]);
  assert.ok(path,'a roof repair must not permanently strand every mason');
  assert.equal(findPath(f.plot,[3,4,3],[4,1,3],{clamber:false}),null);
  f.put(4,3,3,BLOCK.STONE);f.put(4,2,3,BLOCK.STONE);
  const blocked=findPath(f.plot,[3,4,3],[4,1,3]);assert.equal(blocked,null,'cannot descend through a wall');
});
test('ruler paths enter the lower stair face rather than walking into its one-metre side', () => {
  const f=fixture();f.put(3,1,3,BLOCK.STAIRS);
  assert.ok(!neighbors(f.plot,[2,1,3],false).some(e=>e.cell.join()==='3,1,3'));
  assert.ok(neighbors(f.plot,[3,1,4],false).some(e=>e.cell.join()==='3,1,3'));
});
test('workers above a broken ladder rung can descend to surviving rungs to clear access for repairs',()=>{
  const f=fixture();for(const y of [1,2,3,4,6])f.put(3,y,3,BLOCK.LADDER);
  assert.ok(findPath(f.plot,[3,6,3],[3,3,3]),'one missing rung must not strand the whole crew above it');
  assert.equal(findPath(f.plot,[3,6,3],[3,3,3],{clamber:false}),null);
  f.put(3,5,3,BLOCK.STONE);assert.equal(findPath(f.plot,[3,6,3],[3,3,3]),null);
});
test('population extras spawn in the accessible castle rather than sealed standable pockets',()=>{
  const f=fixture({population:40});f.castle.shelters=[];f.castle.rulerSpawn={x:3.5,y:1,z:3.5};f.castle.workSpots=[{...f.castle.rulerSpawn}];
  for(const [x,z] of [[4,3],[6,3],[5,2],[5,4]])for(const y of [1,2,3,4])f.put(x,y,z,BLOCK.STONE);
  spawnPopulation(f.api,f.castle);
  for(const n of f.state.npcs)assert.ok(findPath(f.plot,[3,1,3],[Math.floor(n.pos.x),Math.floor(n.pos.y),Math.floor(n.pos.z)]),`NPC ${n.id} spawned in a sealed pocket`);
});
test('even a one-cell descent clears the ledge before lowering the worker into the next column',()=>{
  const f=fixture();f.castle.npcSpawned=true;f.put(3,1,3,BLOCK.STONE);
  const n=person(4,C.ROLE.MASON,[3,2,3]);f.state.npcs.push(n);setPath(f.api,f.castle,n,[[3,2,3],[4,1,3]]);
  npcKinematics(f.api);f.state.tick++;releaseClaim(f.castle,n); // unrelated destruction cancels the route during the step
  for(let t=0;t<30;t++){npcKinematics(f.api);f.state.tick++;}
  assert.equal(n.falling??null,null);assert.ok(n.pos.y>=2,'the paused worker remains above its supporting ledge');
});
test('urgent access work preempts a decorative build as well as a routine repair', () => {
  const f=fixture(),n=person(4,C.ROLE.MASON);f.state.npcs.push(n);
  const roof=addJob(f.api,f.castle,C.JOB.BUILD,{cell:[6,1,3]},{block:C.BLOCK.ROOF,priority:1});
  n.jobId=roof.id;n.state=C.NPC_STATE.WORK;roof.claimedBy=[n.id];
  f.put(3,1,3,C.BLOCK.STONE);
  addJob(f.api,f.castle,C.JOB.BUILD,{cell:[3,2,3]},{block:C.BLOCK.LADDER,priority:2});
  expireClaims(f.api,f.castle);assert.equal(n.jobId,null);
});
test('a reserved replacement gun outranks automatic floor work while its mason can reach it',()=>{
  const f=fixture(),n=person(4,C.ROLE.MASON);f.state.npcs.push(n);
  const floor=addJob(f.api,f.castle,C.JOB.BUILD,{cell:[6,1,3]},{block:C.BLOCK.FLOOR,priority:2});
  n.jobId=floor.id;n.state=C.NPC_STATE.WORK;floor.claimedBy=[n.id];
  f.put(8,1,3,C.BLOCK.MOUNT);
  addJob(f.api,f.castle,C.JOB.BUILD,{cell:[8,2,3]},{weapon:'cannon',priority:3});
  expireClaims(f.api,f.castle);assert.equal(n.jobId,null);
});

test('a worker below a broken ladder clears its missing rung so it can be designated', () => {
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();
  const base=C.getMap('ice-duel'), map={...base,slots:base.slots.map(s=>({...s,castle:'orig-44'}))};
  let api;const sim=createSim({map,hooks:{onReady(a){api=a;}}});sim.tick();
  const c=api.state.castles[0],n=api.state.npcs.find(n=>n.slot===0&&n.role===C.ROLE.CREW);
  const spot=c.mountSpots.find(s=>s[1]>=5),dirs=[[0,-1],[1,0],[0,1],[-1,0]];
  const x=spot[0]-dirs[spot[3]][0],z=spot[2]-dirs[spot[3]][1],y=spot[1]-1;
  setCell(c.plot,x,y,z,C.BLOCK.AIR,0);
  n.pos={x:c.plot.origin.x+x+.5,y:y-1,z:c.plot.origin.z+z+.5};n.state=C.NPC_STATE.IDLE;n.jobId=null;n.path=[];n.pathIndex=0;n.nextPlanTick=0;
  npcTick(api,c);
  assert.ok(n.path.length>1,'must move its head out of the missing ladder cell');
  assert.ok(n.path.at(-1)[1]<=y-2);
  C.resetRegistriesForTests();
});
