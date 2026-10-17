// tests/evidence/45-tb3-video-headless.mjs - owns pure-sim verification of the planned video timeline with the live AI slot.
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createSim } from '../../src/sim/sim.js';
import { createTb3Script } from '../../src/tb3-script.js';
import { tb1Slots } from '../../src/tb1-script.js';
import { TUNING as T } from '../../src/tuning.js';
registerCoreSim(); C.freezeRegistries();
let api; const sim = createSim({map:'forest-duel',seed:1,slots:tb1Slots(),hooks:{onReady(a){api=a;}}}), script=createTb3Script();
const cell=[41,7,29],i=41+48*29+2304*7,timeline=[];
for(let tick=0;tick<1460;tick++){
  if(tick===800){
    const o=sim.state.castles[0].plot.origin,def=C.getWeapon('cannon');
    api.spawnProjectile({pos:{x:o.x+cell[0]+6,y:o.y+cell[1]+.75,z:o.z+cell[2]+.5},vel:{x:-30,y:0,z:0},radius:def.shot.radius,k:def.k,payload:{...def.shot,splash:0,splashRadius:0},sourceSlot:1,weaponId:2});
  }
  const commands=script.next(sim.state);
  if(tick===820)commands.push({type:C.CMD.REPAIR_PRIORITY,slot:0,tick,seq:commands.length,cell});
  sim.tick(commands);sim.drainEvents();
  if([279,281,754,760,800,818,820,1000,1459].includes(tick)){
    const s=sim.state,p=s.castles[0].plot;
    timeline.push({tick:s.tick,hp:p.hp[i],built:[25,27,29,31,33].map(z=>p.type[41+48*z+2304*7]),outcome:s.outcome});
  }
}
assert.deepEqual(timeline.find(s=>s.tick===761).built,[1,1,1,1,1]);
assert.ok(timeline.find(s=>s.tick===819).hp<T.blocks.stone.hp);
assert.equal(timeline.at(-1).hp,T.blocks.stone.hp);
assert.equal(timeline.at(-1).outcome,null);
console.log(JSON.stringify({hash:sim.hash(),timeline},null,2));
