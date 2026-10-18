// owns: byte-for-byte state equivalence of the frozen cohort engine and final collision-only metadata.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const roots=['/tmp/castle-wave3-final',process.cwd()],engines=[];
for(const root of roots){
 const C=await import(pathToFileURL(`${root}/src/contracts.js`).href),{registerCoreSim}=await import(pathToFileURL(`${root}/src/plugins/index.sim.js`).href),{createSim}=await import(pathToFileURL(`${root}/src/sim/sim.js`).href);
 C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();engines.push({C,createSim});
}
const rows=[];
for(const kind of ['out-of-map','below-ground','expired','two-palace','piercing-exit'])for(const seed of [1,6,12,14,24]){
 const runs=engines.map(({C,createSim})=>{let api;const sim=createSim({map:'forest-duel',seed,hooks:{onReady(a){api=a;},npcTick(){},moraleTick(){},npcKinematics(){}}}),p=api.state.castles[1].plot,o=p.origin;
 const launch=(pos,vel,payload={})=>api.spawnProjectile({pos,vel,k:0,payload,sourceSlot:0,weaponId:1,radius:.1});
 if(kind==='two-palace'){
  const pos={x:o.x+3.5,y:1.5,z:o.z+3.5};api.setBlock(pos,C.BLOCK.PALACE);
  for(let n=0;n<2;n++)launch({...pos,y:3},{x:0,y:-180,z:0},{direct:200,splash:0,splashRadius:0});
 }else if(kind==='piercing-exit'){
  const r=api.state.rulers[1];r.pos={x:383.8,y:80,z:80};r.fallPeak=80;
  launch({x:383.1,y:80.9,z:80},{x:300,y:0,z:0},{pierce:3,direct:0,splash:0,splashRadius:0});
 }else{
  if(kind==='below-ground')for(const name of ['heights','baseHeights'])api.state.terrain[name]?.fill(-200);
  launch(kind==='out-of-map'?{x:383.99,y:80,z:80}:kind==='below-ground'?{x:190,y:-49.999,z:20}:{x:190,y:80,z:20},kind==='out-of-map'?{x:30,y:0,z:0}:kind==='below-ground'?{x:0,y:-30,z:0}:{x:0,y:0,z:0});
  if(kind==='expired')api.state.projectiles.at(-1).age=120;
 }
 sim.drainEvents();return {sim,api,events:[]};});
 const checkpoints=[];
 for(let tick=0;tick<5;tick++){
  for(const r of runs){r.sim.tick();r.events.push(...r.sim.drainEvents());}
  assert.equal(runs[0].sim.hash(),runs[1].sim.hash(),`${kind}/${seed}/${tick}`);
  assert.deepEqual(runs[0].sim.serialize(),runs[1].sim.serialize(),`${kind}/${seed}/${tick}: bytes`);
  if(tick===0||tick===4)checkpoints.push({tick:runs[0].api.tick,hash:runs[0].sim.hash()});
 }
 rows.push({kind,seed,ticksCompared:5,checkpoints,impactKinds:runs.map(r=>r.events.filter(e=>e.type==='impact').map(e=>e.payload.hitKind)),lossReasons:runs.map(r=>r.events.filter(e=>e.type==='projectile-lost').map(e=>e.payload.reason))});
}
writeFileSync(new URL('./event-state-proof.json',import.meta.url),JSON.stringify({roots,allHashesAndSerializedBytesEqual:true,cases:rows}));console.log('25 cases x5 ticks: identical hashes and save bytes; only collision captions change.');
