// tests/unit/ai-weapon-aim.test.js - owns per-weapon fixed-pitch/thrust aim and feasible target choices.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { geometryAim } from '../../src/ai/aim.js';
import { selectTarget } from '../../src/ai/targets.js';
import { fixedElevation, traceFlight, buildRangeTable } from '../../src/sim/ballistics.js';
import { content, IDS } from '../evidence/tb4-weapon-fixture.mjs';

for (const id of IDS) test(`${id}: solves charge at its fixed pitch for both target heights in wind`, () => {
  content(); const def = C.getWeapon(id); assert.ok(def,id);
  for(const y of [-4,4]) {
    const from = {x:0,y:8,z:0}, to = {x:192,y:8+y,z:0}, wind = {x:2,z:3};
    const aim = geometryAim(from,to,def,wind);
    assert.equal(aim.elevation,fixedElevation(def)); assert.equal(aim.reachable,true);
    const flight = traceFlight({...def,charge:aim.dial,elevation:aim.elevation,azimuth:aim.azDeg,wind,pos:from,landingY:to.y});
    assert.ok(Math.hypot(flight.pos.x-to.x,flight.pos.z-to.z)<0.2,JSON.stringify({id,aim,flight}));
  }
});

test('per-weapon target choice filters unreachable enemies and lobbed guns retain covered targets', () => {
  content();
  const slot = {id:0,team:0,aiLevel:10,aiTactic:C.TACTIC.GENERAL};
  const makePlot = x => ({origin:{x,y:0,z:0},width:4,depth:4,height:4,type:new Uint8Array(64),hp:new Uint8Array(64)});
  const view = {tick:0,slots:[slot,{id:1,team:1},{id:2,team:2}],castles:[{slot:0},{slot:1,plot:makePlot(100)},{slot:2,plot:makePlot(500)}],weapons:[],npcs:[],rulers:[]};
  for(const c of view.castles.slice(1)) c.plot.type[0+4*1+16*1]=C.BLOCK.PALACE;
  for(const id of ['cannon','catapult']) {
    const weapon = {id:0,slot:0,defId:id,pos:{x:0,y:1,z:1.5}};
    assert.equal(selectTarget(view,slot,weapon)?.slot,1);
    view.castles[1].eliminated=true;
    const selected=selectTarget(view,slot,weapon);
    if(buildRangeTable(C.getWeapon(id)).at(-1).range < 500) assert.equal(selected,null);
    view.castles[1].eliminated=false;
  }
});

test('weapon choice uses each gun\'s range and loaded state; placeholders have no aim solution', async () => {
  content(); const {selectWeaponForTarget}=await import('../../src/ai/targets.js');
  const slot={id:0,team:0},target={pos:{x:600,y:2.5,z:0}};
  const gun=(id,defId)=>({id,defId,slot:0,hp:36,reload:100,pos:{x:0,y:2,z:0}});
  const cannon=gun(0,'cannon'),bolt=gun(1,'ballista'),view={wind:{x:0,z:0},weapons:[cannon,bolt]};
  assert.equal(selectWeaponForTarget(view,slot,target).id,bolt.id);
  target.pos.x=100;
  assert.equal(selectWeaponForTarget(view,slot,target).id,bolt.id,'cheapest feasible loaded gun');
  bolt.reload=0;assert.equal(selectWeaponForTarget(view,slot,target).id,cannon.id);
  const stub=C.getWeapon('zeppelin'), stubRange=buildRangeTable(stub).at(-1).range;
  assert.equal(geometryAim([0,0,0],[stubRange/2,0,0],stub).reachable,false);
  assert.equal(geometryAim([0,0,0],[100,10000,0],C.getWeapon('catapult')).reachable,false);
});

test('lobbed ballistic selection can reach an enemy gun behind a low sight-line wall',()=>{
  content();const slot={id:0,team:0,aiLevel:10,aiTactic:C.TACTIC.GENERAL};
  const p={origin:{x:0,y:0,z:0},width:220,depth:4,height:12,type:new Uint8Array(220*4*12)};
  for(let y=1;y<=6;y++)p.type[90+220*1+220*4*y]=C.BLOCK.STONE;
  const enemy={id:1,slot:1,defId:'cannon',hp:36,pos:{x:192,y:1,z:1.5}};
  const view={tick:0,slots:[slot,{id:1,team:1}],castles:[{slot:0},{slot:1,plot:p}],wind:{x:0,z:0},weapons:[enemy],npcs:[],rulers:[]};
  const own={id:0,slot:0,hp:60,pos:{x:0,y:1,z:1.5}};
  assert.equal(selectTarget(view,slot,{...own,defId:'cannon'},{ballistic:true})?.kind,'shieldWall'); // research/16 P4: pressure upper cover when a gun is masked
  assert.equal(selectTarget(view,slot,{...own,defId:'catapult'},{ballistic:true})?.key,'weapon:1');
});
