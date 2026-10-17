// Owns intentional ruler targeting after continuous public line-of-sight exposure.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim } from '../../src/sim/sim.js';
import { createAiController } from '../../src/ai/controller.js';
import { TUNING as T } from '../../src/tuning.js';
import { aimNoise } from '../../src/ai/aim.js';
import { pow } from '../../src/core/fmath.js';

test('trained low-level crews retain misses without a six-metre permanent range floor', () => {
  assert.ok(aimNoise(3,30).rangeFrac<=.012);
  assert.ok(aimNoise(3,30).azDeg<=.30);
  assert.equal(aimNoise(5,30).rangeFrac,.000008*6**4);
  assert.ok(aimNoise(3,0).rangeFrac>aimNoise(5,0).rangeFrac);
});
test('the low-level trained floor leaves all level-five-and-higher aim distributions exact',()=>{
  for(let level=5;level<=10;level++)for(let observations=0;observations<=64;observations++){
    const f=11-level,decay=pow(T.ai.shrink,observations);
    assert.deepEqual(aimNoise(level,observations),{
      azDeg:observations===0?T.ai.sAz0PerLevelDeg*f:Math.max(T.ai.sAz0PerLevelDeg*f*decay,T.ai.sMinCoefDeg*f*f),
      rangeFrac:observations===0?T.ai.sR0PerLevel*f:Math.max(T.ai.sR0PerLevel*f*decay,T.ai.sMinRangeCoef*f**T.ai.sMinRangeExponent)
    });
  }
});

test('breach policy intentionally chooses a ruler only after the exposure window, and resets on lost sight', () => {
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();
  const v=createSim({map:'forest-duel'}).state; v.slots[0].controller=C.CONTROLLER.AI;
  v.weapons=v.weapons.filter(w=>w.id===1); v.npcs=[];
  const p=v.castles[1].plot;p.type.fill(0,2304);p.hp.fill(0,2304);
  v.rulers[1].pos={x:p.origin.x+24,y:1,z:p.origin.z+24};
  const ai=createAiController();const start=130*30;
  v.tick=start;ai.think(v,v.slots[0],()=>.5);
  assert.notEqual(ai.snapshot().slots[0].weapons[0].target?.kind,'ruler');
  for(v.tick=start+15;v.tick<=start+T.ai.rulerExposureS*30+15;v.tick+=15)ai.think(v,v.slots[0],()=>.5);
  assert.equal(ai.snapshot().slots[0].weapons[0].target?.kind,'ruler');
  // A closed public wall invalidates the opportunity immediately.
  for(let y=1;y<15;y++)for(let z=0;z<48;z++)p.type[48*z+2304*y]=C.BLOCK.STONE;
  ai.think(v,v.slots[0],()=>.5);
  assert.notEqual(ai.snapshot().slots[0].weapons[0].target?.kind,'ruler');
  C.resetRegistriesForTests();
});

test('a losing ruler can lead its front crew using ordinary reachable movement', () => {
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();
  const v=createSim({map:'forest-duel'}).state;v.slots[0].controller=C.CONTROLLER.AI;
  const c=v.castles[0];c.morale=40;c.population=20;c.initialPopulation=40;
  for(const w of v.weapons)if(w.slot===0)w.crewOrdered=true;
  c.enemyImpacts=[{tick:0,pos:{...v.rulers[0].pos}}];
  const ai=createAiController(),commands=ai.think(v,v.slots[0],()=>.5);
  assert.ok(commands.some(c=>c.type===C.CMD.MOVE&&c.fwd>0));
  assert.equal(ai.snapshot().slots[0].rulerDuty.weaponId,1,'the front gun needs leadership');
  C.resetRegistriesForTests();
});

test('the leadership route physically climbs the front stairs and mans the cannon', () => {
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();
  const map=C.getMap('forest-duel');
  const slots=map.slots.map((s,id)=>({id,castleId:s.castle,team:id,color:0,controller:id?C.CONTROLLER.LOCAL:C.CONTROLLER.AI,aiLevel:5,aiTactic:C.TACTIC.GENERAL}));
  const sim=createSim({map,slots,hooks:{npcTick(_api,c){c.population=20;c.initialPopulation=40;},moraleTick(_api,c){c.morale=40;}}});
  let reached=false;
  for(let tick=0;tick<90*30&&!reached;tick++){
    sim.tick();if(tick%30===0){sim.drainEvents();const r=sim.state.rulers[0];reached=r.manning===1;}
  }
  assert.ok(reached,'normal movement must reach the battery rather than stick beside a stair');
  C.resetRegistriesForTests();
});
