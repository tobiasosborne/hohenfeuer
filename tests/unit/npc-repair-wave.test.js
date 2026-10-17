// tests/unit/npc-repair-wave.test.js - owns emergency levy and ammunition access recovery.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLE, JOB, BLOCK } from '../../src/contracts.js';
import { npcTick } from '../../src/npc/brain.js';
import { emitJobs, claimJob } from '../../src/npc/jobs.js';
import { fixture, person } from './npc-fixture.test.js';
test('low-population levy fills a minimum gun crew before support quotas at five seconds', () => {
  const f = fixture(); f.castle.npcSpawned = true; f.castle.initialPopulation = 40;
  f.state.npcs = [person(4, ROLE.CIVILIAN), person(5, ROLE.CIVILIAN), person(6, ROLE.MASON)];
  f.state.weapons = [{ id: 0, slot: 0, hp: 36, defId: 'cannon', pos: { x: 8.5, y: 1, z: 3.5 }, ammo: 2, crewOrdered: true }];
  f.state.tick = 5 * 30; npcTick(f.api, f.castle);
  assert.equal(f.state.npcs[0].role, ROLE.CREW);
  f.state.tick = 10 * 30; npcTick(f.api, f.castle);
  assert.equal(f.state.npcs[1].role, ROLE.CREW);
});
test('haulers can deposit from a reachable side when the original operator cell is destroyed', () => {
  const f = fixture(); f.castle.npcSpawned = true; f.castle.workSpots = [];
  f.put(8, 1, 4, BLOCK.STONE); // N-facing operator cell has no headroom.
  const n = { ...person(4, ROLE.RUNNER, [7, 1, 3]), carrying: 2 };
  f.state.npcs.push(n); f.state.weapons.push({ id: 0, slot: 0, hp: 36, defId: 'cannon', facing: 0, pos: { x: 8.5, y: 1, z: 3.5 }, ammo: 0 });
  emitJobs(f.api, f.castle);
  assert.equal(claimJob(f.api, f.castle, n)?.kind, JOB.HAUL_AMMO);
});
test('automatic repair protects replacement funds when a gun is critically damaged; priority work can spend them', async () => {
  const { tickWork } = await import('../../src/npc/jobs.js');
  const f=fixture();f.castle.npcSpawned=true;f.castle.workSpots=[];f.castle.gold=750;
  f.state.weapons.push({ id:0,slot:0,hp:10,defId:'cannon',pos:{x:8.5,y:1,z:3.5},ammo:2 });
  f.put(3,1,2,BLOCK.STONE,10); const n=person(4,ROLE.MASON,[2,1,2]); f.state.npcs.push(n);
  emitJobs(f.api,f.castle);const j=claimJob(f.api,f.castle,n);n.state='work';
  for(let i=0;i<30;i++){tickWork(f.api,f.castle,n);f.state.tick++;}
  const idx=3+f.plot.width*2+f.plot.width*f.plot.depth;
  assert.equal(f.plot.hp[idx],10);assert.equal(f.castle.gold,750);
  j.priority=1;tickWork(f.api,f.castle,n);assert.ok(f.castle.gold<750);
});
test('an idle survivor clears a vacant mount so replacement is possible', () => {
  const f=fixture();f.castle.npcSpawned=true;f.castle.workSpots=[];
  f.castle.mountSpots=[[8,1,3,0]];f.castle.weapons=[{id:'cannon',at:[8,1,3]}];
  const n=person(4,ROLE.CREW,[8,1,3]);f.state.npcs.push(n);
  npcTick(f.api,f.castle);
  assert.ok(n.path.length>1);assert.notDeepEqual(n.path.at(-1),[8,1,3]);
});
test('workers fall onto surviving support after their floor is destroyed and can take jobs again', async () => {
  const { npcKinematics }=await import('../../src/npc/kinematics.js');
  const f=fixture();f.castle.npcSpawned=true;f.castle.workSpots=[];
  f.put(3,2,3,BLOCK.STONE);f.put(3,3,3,BLOCK.STONE);
  const n=person(4,ROLE.MASON,[3,4,3]);f.state.npcs.push(n);
  f.put(3,3,3,BLOCK.AIR);
  for(let i=0;i<60;i++){npcKinematics(f.api);f.state.tick++;}
  assert.equal(n.pos.y,3);assert.equal(n.hp,100);assert.equal(n.state,'idle');
});
test('a temporary ballista does not spend the savings for the missing blueprint cannon', async () => {
  const {tickWork}=await import('../../src/npc/jobs.js');const f=fixture();f.castle.workSpots=[];f.castle.gold=750;
  f.castle.weapons=[{id:'cannon'},{id:'cannon'}];
  f.state.weapons=[{id:0,slot:0,defId:'cannon',hp:36,pos:{x:8.5,y:1,z:3.5},ammo:2},{id:1,slot:0,defId:'ballista',hp:36,pos:{x:9.5,y:1,z:3.5},ammo:2}];
  f.put(3,1,2,BLOCK.STONE,10);const n=person(4,ROLE.MASON,[2,1,2]);f.state.npcs.push(n);emitJobs(f.api,f.castle);claimJob(f.api,f.castle,n);n.state='work';
  for(let i=0;i<30;i++){tickWork(f.api,f.castle,n);f.state.tick++;}assert.equal(f.castle.gold,750);
});
test('another castle population cannot shift this castle bravery draws', async () => {
  const {createStreams}=await import('../../src/core/rng.js'),{spawnPopulation}=await import('../../src/npc/brain.js');
  function run(population){const f=fixture({population}),g=fixture({population:40,id:1}),rng=createStreams(17);f.state.castles.push(g.castle);f.api.rng=name=>rng.get(name);spawnPopulation(f.api,f.castle);spawnPopulation(f.api,g.castle);return f.state.npcs.filter(n=>n.castle===1).map(n=>n.bravery);}
  assert.deepEqual(run(20),run(80));
});
test('urgent weapon construction preempts routine repairs without waiting for claim timeout', async () => {
  const {addJob,expireClaims}=await import('../../src/npc/jobs.js');const f=fixture();f.castle.workSpots=[];
  f.put(3,1,2,BLOCK.STONE,10);f.put(8,1,3,BLOCK.MOUNT);const n=person(4,ROLE.MASON,[2,1,2]);f.state.npcs.push(n);
  emitJobs(f.api,f.castle);claimJob(f.api,f.castle,n);n.state='work';
  addJob(f.api,f.castle,JOB.BUILD,{cell:[8,2,3]},{priority:2,weapon:'cannon'});
  expireClaims(f.api,f.castle);assert.equal(n.jobId,null);f.state.tick=30;assert.equal(claimJob(f.api,f.castle,n)?.weapon,'cannon');
});
test('four surviving crew fill two minimum batteries instead of leaving one gun at one crew', () => {
  const f=fixture();f.castle.workSpots=[];
  f.state.weapons=[2,8].map((x,id)=>({id,slot:0,defId:'cannon',hp:36,pos:{x:x+.5,y:1,z:3.5},ammo:2,crewOrdered:true}));
  f.state.npcs=[4,5,6,7].map(id=>person(id,ROLE.CREW,[id===7?7:1,1,3]));emitJobs(f.api,f.castle);
  const jobs=f.castle.jobs.filter(j=>j.kind===JOB.CREW);jobs[0].slots=3;jobs[0].claimedBy=[4,5,6];jobs[1].claimedBy=[7];
  for(const n of f.state.npcs){n.state='work';n.jobId=jobs[n.id===7?1:0].id;n.target={weaponId:n.id===7?1:0};}
  emitJobs(f.api,f.castle);assert.deepEqual(jobs.map(j=>j.slots),[2,2]);assert.equal(jobs[0].claimedBy.length,2);
  assert.equal(claimJob(f.api,f.castle,f.state.npcs[2])?.target.weaponId,1);
});
test('opposing default populations have mirrored role positions, not the same left-first spawn order', async () => {
  const C=await import('../../src/contracts.js'),{registerCoreSim}=await import('../../src/plugins/index.sim.js'),{createSim}=await import('../../src/sim/sim.js');
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();const sim=createSim({map:'forest-duel'});sim.tick([]);const s=sim.state;
  const left=s.npcs.filter(n=>n.slot===0),right=s.npcs.filter(n=>n.slot===1);
  for(let i=0;i<left.length;i++){
    assert.equal(left[i].role,right[i].role);
    assert.equal(left[i].pos.x-s.castles[0].plot.origin.x+right[i].pos.x-s.castles[1].plot.origin.x,48);
    assert.equal(left[i].pos.z,right[i].pos.z);
  }
});
test('levy restores full ordered crews when support roles and population allow it', () => {
  const f=fixture();f.castle.npcSpawned=true;f.castle.initialPopulation=40;f.castle.workSpots=[];
  const roles=[...Array(4).fill(ROLE.CREW),...Array(3).fill(ROLE.RUNNER),...Array(2).fill(ROLE.MASON),...Array(3).fill(ROLE.CIVILIAN)];
  f.state.npcs=roles.map((role,i)=>person(i+4,role));f.state.weapons=[8,9].map((x,id)=>({id,slot:0,defId:'cannon',hp:36,pos:{x:x+.5,y:1,z:3.5},ammo:2,crewOrdered:true}));
  f.state.tick=150;npcTick(f.api,f.castle);f.state.tick=300;npcTick(f.api,f.castle);
  assert.equal(f.state.npcs.filter(n=>n.role===ROLE.CREW).length,6);
  assert.equal(f.state.npcs.filter(n=>n.role===ROLE.RUNNER).length,3);
  assert.equal(f.state.npcs.filter(n=>n.role===ROLE.MASON).length,2);
});
test('a failed route for one mason does not block a mason on the reachable side', () => {
  const f=fixture({width:10,depth:1});f.castle.workSpots=[];f.put(3,1,0,BLOCK.STONE);f.put(3,2,0,BLOCK.STONE);f.put(3,3,0,BLOCK.STONE);f.put(6,1,0,BLOCK.STONE,5);
  const a=person(4,ROLE.MASON,[1,1,0]),b=person(5,ROLE.MASON,[8,1,0]);f.state.npcs.push(a,b);emitJobs(f.api,f.castle);
  assert.equal(claimJob(f.api,f.castle,a),null);assert.equal(claimJob(f.api,f.castle,b)?.target.cell[0],6);
});
test('NPCs climb a two-metre rubble ledge by lifting before crossing the solid face', async () => {
  const {findPathToAny}=await import('../../src/npc/path.js'),{npcKinematics}=await import('../../src/npc/kinematics.js');
  const f=fixture({width:4,depth:1});f.castle.npcSpawned=true;f.put(2,1,0,BLOCK.STONE);f.put(2,2,0,BLOCK.STONE);
  const path=findPathToAny(f.plot,[1,1,0],[[2,3,0]]);assert.ok(path);
  const n=person(4,ROLE.MASON,[1,1,0]);Object.assign(n,{state:'walk',path,pathIndex:1,pathNavVersion:f.plot.navVersion});f.state.npcs.push(n);
  for(let i=0;i<100;i++){npcKinematics(f.api);f.state.tick++;if(n.pos.x+.25>2)assert.ok(n.pos.y>=3-1e-9);}
  assert.deepEqual(n.pos,{x:2.5,y:3,z:.5});assert.equal(n.hp,100);
  f.put(1,3,0,BLOCK.STONE);assert.equal(findPathToAny(f.plot,[1,1,0],[[2,3,0]]),null);
});
test('a worker moves out of missing original wall cells instead of blocking their rebuild', async () => {
  const C=await import('../../src/contracts.js'),{registerCoreSim}=await import('../../src/plugins/index.sim.js');C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();
  const f=fixture({width:48,depth:48,height:24});f.castle.npcSpawned=true;f.castle.defId='default';f.castle.workSpots=[];
  for(let y=1;y<=4;y++)f.put(8,y,27,BLOCK.STONE);for(let y=1;y<=6;y++)f.put(7,y,27,BLOCK.STONE);
  const n=person(4,ROLE.MASON,[8,5,27]);f.state.npcs.push(n);npcTick(f.api,f.castle);
  assert.ok(n.path.length>1);assert.deepEqual(n.path.at(-1),[7,7,27]);
});
test('automatic wall repairs wait for a quiet interval; explicit priority and palace work remain available', async () => {
  const {fearAllows}=await import('../../src/npc/jobs.js');const f=fixture();f.put(6,1,3,BLOCK.STONE,5);emitJobs(f.api,f.castle);
  const job=f.castle.jobs.find(j=>j.kind===JOB.REPAIR);f.castle.enemyImpacts=[{tick:0,pos:{x:6.5,y:1,z:3.5}}];
  assert.equal(fearAllows(f.api,f.castle,job),false);f.state.tick=29*30;assert.equal(fearAllows(f.api,f.castle,job),false);
  job.priority=3;assert.equal(fearAllows(f.api,f.castle,job),true);job.priority=0;f.state.tick=31*30;assert.equal(fearAllows(f.api,f.castle,job),true);
});
test('crew destinations leave the muzzle lane clear',()=>{
  const f=fixture();f.castle.workSpots=[];const n=person(4,ROLE.CREW,[7,1,3]);f.state.npcs.push(n);
  f.state.weapons=[{id:0,slot:0,defId:'cannon',hp:36,pos:{x:5.5,y:1,z:3.5},facing:1,aim:{az:900,range:1000},crewOrdered:true,ammo:2}];
  emitJobs(f.api,f.castle);assert.equal(claimJob(f.api,f.castle,n)?.kind,JOB.CREW);assert.notDeepEqual(n.path.at(-1),[7,1,3]);
});
