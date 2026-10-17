// owns: real-simulation acceptance of the newcomer reticle -> E auto-crew -> paid fire path, without browser IO.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { registerCoreSim } from '../../../src/plugins/index.sim.js';
import { freezeRegistries, getMap, EV } from '../../../src/contracts.js';
import { createSim } from '../../../src/sim/sim.js';
import { createTb1Script, tb1Slots } from '../../../src/tb1-script.js';
import { emptySample, buildCommands, ACTION } from '../../../src/player/commands.js';
import { pick } from '../../../src/player/interact.js';
import { freshProfile, visibleFeatures, contextualPrompt } from '../../../src/progression.js';
import { TUNING as T } from '../../../src/tuning.js';
registerCoreSim(); freezeRegistries();
const sim = createSim({ map: getMap('forest-duel'), seed: 1, slots: tb1Slots(2) });
const route = createTb1Script();
while (route.phase === 'walk' && sim.state.tick < 1000) { sim.tick(route.next(sim.state)); sim.drainEvents(); }
assert.equal(route.phase, 'man');
const state = sim.state, r = state.rulers[0], gun = state.weapons.filter(w => w.slot === 0)[1];
const dx = gun.pos.x-r.pos.x, dz = gun.pos.z-r.pos.z;
const look = { yaw: Math.atan2(dx,-dz), pitch: Math.atan2(gun.pos.y+0.5-r.pos.y-T.ruler.eye,Math.hypot(dx,dz)) };
const target = pick({ eye:[r.pos.x,r.pos.y+T.ruler.eye,r.pos.z], ...look, slot:0,
  plots:state.castles.map(c => ({ plot:c.plot,slot:c.slot })),
  weapons:state.weapons.filter(w=>w.hp>0).map(w=>({ id:w.id, defId:w.defId, slot:w.slot, crewOrdered:w.crewOrdered,
    min:[w.pos.x-0.5,w.pos.y,w.pos.z-0.5],max:[w.pos.x+0.5,w.pos.y+1,w.pos.z+0.5] })) });
assert.equal(target.weaponId,gun.id,'real cannon reachable under the reticle');
const profile = freshProfile(), features = visibleFeatures(profile);
assert.equal(contextualPrompt(profile,{mode:'walk',target})?.id,'man');
const e = { ...emptySample(), features, look, target, actions:[ACTION.INTERACT] };
const commands = buildCommands(e,state.tick);
sim.tick(commands); const after = sim.state;
assert.equal(after.rulers[0].manning,gun.id);
assert.equal(after.weapons.find(w=>w.id===gun.id).crewOrdered,true);
const w=after.weapons.find(w=>w.id===gun.id);
assert.equal(contextualPrompt(profile,{mode:'weapon',loaded:true,affordable:true,hasAmmo:true})?.id,'fire');
const fire = { ...emptySample(), features, mode:'weapon',weapon:{id:w.id,defId:w.defId,az:w.aim.az,range:w.aim.range},actions:[ACTION.FIRE] };
sim.tick(buildCommands(fire,after.tick));
assert.ok(sim.drainEvents().some(e=>e.type===EV.SHOT_FIRED && e.payload.slot===0));
assert.equal(sim.state.castles[0].stats.shots,1);
const report={status:'passed',tick:sim.state.tick,target,commands,crewOrdered:true,shots:1,hash:sim.hash()};
await writeFile('tests/evidence/onboarding/headless.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
