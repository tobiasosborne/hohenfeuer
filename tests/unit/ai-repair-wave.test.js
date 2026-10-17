// tests/unit/ai-repair-wave.test.js - owns breach focus and recovery from casualties.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim } from '../../src/sim/sim.js';
import { selectTarget } from '../../src/ai/targets.js';
import { operatorCell } from '../../src/npc/model.js';
import { TUNING as T } from '../../src/tuning.js';

test('opposite attackers choose mirrored palace aim points and stick to the breach', () => {
  C.resetRegistriesForTests(); registerCoreSim(); C.freezeRegistries();
  const sim = createSim({ map: 'forest-duel', seed: 1 }), v = sim.state;
  v.weapons.forEach(w => { if ((w.slot === 0 && w.id === 0) || (w.slot === 1 && w.id === 3)) w.hp = 0; });
  const left = selectTarget(v, v.slots[0], v.weapons[1], { ballistic: true, breach: true });
  const right = selectTarget(v, v.slots[1], v.weapons[2], { ballistic: true, breach: true });
  const lp = v.castles[1].plot, rp = v.castles[0].plot;
  assert.equal(left.kind, 'shieldWall'); assert.equal(right.kind, 'shieldWall');
  assert.equal(left.pos.x - lp.origin.x + right.pos.x - rp.origin.x, T.world.plotW);
  assert.equal(left.pos.z - lp.origin.z, right.pos.z - rp.origin.z);
});
test('initial guns preserve facing: operator cells never alias another slot instance', () => {
  C.resetRegistriesForTests(); registerCoreSim(); C.freezeRegistries();
  const sim = createSim({ map: 'forest-duel', seed: 1 }), v = sim.state;
  for (const w of v.weapons) {
    assert.ok(Number.isInteger(w.facing));
    assert.deepEqual(operatorCell(w, v.castles[w.slot]), [w.pos.x - v.castles[w.slot].plot.origin.x - .5 + (w.facing === 1 ? -1 : 1), 7, 23]);
  }
});
test('AI prepares paid flank batteries and replaces a lost front gun away from the breach', async () => {
  const { withRecoveryMounts, captureBlueprint, planWeaponReplacement } = await import('../../src/ai/build.js');
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();
  const v=createSim({map:'forest-duel'}).state,c=v.castles[0], original=captureBlueprint(c,c.weapons);
  const bp=withRecoveryMounts(c,original,1,v);
  assert.equal(bp.recoveryMounts.length,2);
  assert.equal(original.mountSpots.length,2);
  assert.equal(bp.cells.filter(p=>p.recoveryMount).length,4);
  for(const cell of bp.cells.filter(p=>p.recoveryMount)){c.plot.type[cell.index]=C.BLOCK.MOUNT;c.plot.hp[cell.index]=T.blocks.mount.hp;}
  const guns=v.weapons.filter(w=>w.slot===0&&w.id!==1);
  const plan=planWeaponReplacement(c,bp,C.TACTIC.GENERAL,guns,{view:v});
  assert.equal(plan.length,1);assert.equal(plan[0].cell[1],8);assert.notEqual(plan[0].cell[2],23);
  const clear=planWeaponReplacement(c,bp,C.TACTIC.GENERAL,guns,{view:v,acceptSpot:spot=>spot[2]!==31});
  assert.equal(clear[0].cell[2],15,'skip a replacement battery whose lane is blocked');
});
test('a threatened AI ruler walks to cover through normal next-tick movement commands', async () => {
  const {createAiController}=await import('../../src/ai/controller.js');
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();
  const v=createSim({map:'forest-duel'}).state;v.slots[0].controller=C.CONTROLLER.AI;
  v.castles[0].enemyImpacts=[{tick:0,pos:{...v.rulers[0].pos}}];
  const before=structuredClone(v), commands=createAiController().think(v,v.slots[0],()=>.5);
  const move=commands.find(c=>c.type===C.CMD.MOVE);
  assert.ok(move?.fwd>0);assert.equal(move.tick,1);assert.deepEqual(v,before);
});
test('a ruler responds again when later impacts expose its previous shelter', async () => {
  const {createAiController}=await import('../../src/ai/controller.js');
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();const v=createSim({map:'forest-duel'}).state;v.slots[0].controller=C.CONTROLLER.AI;
  v.castles[0].enemyImpacts=[{tick:0,pos:{...v.rulers[0].pos}}];const ai=createAiController();ai.think(v,v.slots[0],()=>.5);
  const saved=ai.snapshot();saved.slots[0].rulerPath=null;saved.slots[0].rulerRetreated=true;saved.slots[0].lastRulerRetreatTick=0;
  v.tick=1800;v.castles[0].enemyImpacts[0].tick=v.tick;
  assert.ok(createAiController(saved).think(v,v.slots[0],()=>.5).some(c=>c.type===C.CMD.MOVE&&c.fwd>0));
});
test('ruler shelter search includes covered buildings away from the palace firing lane', async () => {
  const {createAiController}=await import('../../src/ai/controller.js');C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();
  const v=createSim({map:'forest-duel'}).state;v.slots[0].controller=C.CONTROLLER.AI;v.castles[0].enemyImpacts=[{tick:0,pos:{...v.rulers[0].pos}}];
  const ai=createAiController();ai.think(v,v.slots[0],()=>.5);const goal=ai.snapshot().slots[0].rulerPath.at(-1);assert.ok((goal[0]-24)**2+(goal[2]-21)**2>=T.ai.rulerDangerM**2);
});
test('a protected palace is breached at the wall base instead of repeatedly aiming behind it',()=>{
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();const v=createSim({map:'forest-duel'}).state;
  const w=v.weapons[1],t=selectTarget(v,v.slots[0],w,{ballistic:true,breach:true}),p=v.castles[t.slot].plot;
  assert.equal(t.kind,'shieldWall');assert.ok(Math.abs(t.pos.x-(p.origin.x+t.cell[0]+.5))<1);assert.ok(t.pos.y<=p.origin.y+3.5);
});
test('a living but inaccessible battery can be replaced by a paid reachable spare', async()=>{
  const {captureBlueprint,withRecoveryMounts,planWeaponReplacement}=await import('../../src/ai/build.js');
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();
  const v=createSim({map:'forest-duel'}).state,c=v.castles[0],bp=withRecoveryMounts(c,captureBlueprint(c,c.weapons),1,v);
  for(const b of bp.cells.filter(b=>b.recoveryMount)){c.plot.type[b.index]=b.block;c.plot.hp[b.index]=60;}
  const own=v.weapons.filter(w=>w.slot===0);
  assert.equal(planWeaponReplacement(c,bp,C.TACTIC.GENERAL,own,{view:v,unusableIds:[1]}).length,1);
});
