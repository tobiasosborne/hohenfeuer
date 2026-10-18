// owns: contextual reload actions use real range, visibility, costs and feature gates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim } from '../../src/sim/sim.js';
import { tb1Slots } from '../../src/tb1-script.js';
import { freezeRegistries, getBlock, JOB } from '../../src/contracts.js';
import { localInterventions, interventionText } from '../../src/player/interventions.js';
import { profileForMatch, visibleFeatures } from '../../src/progression.js';
registerCoreSim();freezeRegistries();
function scene(){
  const s=createSim({map:'forest-duel',seed:1,slots:tb1Slots()}).state,c=s.castles[0],p=c.plot;
  const cell=[40,7,28],i=cell[0]+p.width*cell[2]+p.width*p.depth*cell[1];
  p.type[i]=1;p.hp[i]=10;
  s.rulers[0].pos={x:p.origin.x+38,y:p.origin.y+7,z:p.origin.z+28.5};s.rulers[0].manning=null;
  c.gold=1000;c.jobs=[];s.npcs=[{slot:0,hp:100,role:'mason',pos:{x:p.origin.x+20,y:1,z:p.origin.z+20}}];
  return {s,c,p,cell,i};
}
test('repair is visible, affordable and useful; an existing priority removes the prompt',()=>{
  const {s,c,cell}=scene(),f=visibleFeatures(profileForMatch(10));
  const a=localInterventions(s,0,{features:f}).find(a=>a.kind==='repair');
  assert.ok(a);assert.ok(a.cost>0);assert.match(interventionText(a,'en'),/gold.*cover/);
  c.jobs.push({kind:JOB.REPAIR,target:{cell},priority:3});
  assert.ok(!localInterventions(s,0,{features:f}).some(a=>a.cell?.every((n,i)=>n===cell[i])));
  c.jobs=[];c.gold=0;
  assert.ok(!localInterventions(s,0,{features:f}).some(a=>a.kind==='repair'));
});
test('match one never advertises R, Q or G; safe, undamaged reloads create no chores',()=>{
  const {s,c,cell}=scene(),f=visibleFeatures(profileForMatch(0));
  assert.ok(localInterventions(s,0,{features:f}).every(a=>!['repair','crew','replacement'].includes(a.kind)));
  assert.ok(localInterventions(s,0,{features:f,blueprint:[{block:1,cell}]}).some(a=>a.kind==='build'),'first damaged stone offers a legal reinforcement');
  const clean=createSim({map:'forest-duel',seed:1,slots:tb1Slots()}).state;
  clean.weapons.forEach(w=>w.crewOrdered=true);
  assert.deepEqual(localInterventions(clean,0,{features:f}),[]);
});
test('only two candidates, no remote repairs, no orders through an occluding wall',()=>{
  const {s,p}=scene(),f=visibleFeatures(profileForMatch(10));
  assert.ok(localInterventions(s,0,{features:f}).length<=2);
  const wall=39+p.width*28+p.width*p.depth*8;p.type[wall]=1;p.hp[wall]=getBlock(1).hp;
  assert.ok(!localInterventions(s,0,{features:f}).some(a=>a.kind==='repair'),'healthy foreground wall occludes damaged block');
  s.rulers[0].pos.x-=100;
  assert.ok(!localInterventions(s,0,{features:f}).some(a=>a.kind==='repair'));
});
test('camera visibility cannot hide a reachable repair; direction and distance follow the camera',()=>{
  const {s,cell}=scene(),f=visibleFeatures(profileForMatch(10));
  const a=localInterventions(s,0,{features:f,visible:()=>false}).find(a=>a.kind==='repair');
  assert.ok(a);assert.deepEqual(a.cell,cell);
  const text=interventionText(a,'en',true,{heading:270,origin:s.rulers[0].pos});
  assert.match(text,/behind, 3 m/);
});
test('two independently damaged sites can be offered; an already working mason makes priority redundant',()=>{
  const {s,c,p}=scene(),f=visibleFeatures(profileForMatch(3));
  const other=[40,7,31],i=other[0]+p.width*other[2]+p.width*p.depth*other[1];p.type[i]=1;p.hp[i]=14;
  const repairs=localInterventions(s,0,{features:f}).filter(a=>a.kind==='repair');assert.equal(repairs.length,2);
  c.jobs=[{kind:JOB.REPAIR,target:{cell:repairs[0].cell},claimedBy:[1],priority:0,progress:.3}];
  assert.ok(!localInterventions(s,0,{features:f}).some(a=>a.cell?.join()===repairs[0].cell.join()));
});
test('palace consequences outrank cheaper masonry and imminent safety outranks both',()=>{
  const {s,p}=scene(),f=visibleFeatures(profileForMatch(3));
  const cell=[40,7,31],i=cell[0]+p.width*cell[2]+p.width*p.depth*cell[1];p.type[i]=11;p.hp[i]=getBlock(11).hp-10;
  const choices=localInterventions(s,0,{features:f});assert.deepEqual(choices[0].cell,cell);
  assert.equal(localInterventions(s,0,{features:f,threatened:true})[0].kind,'cover');
});
