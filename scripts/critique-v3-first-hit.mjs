// owns: first damaging hostile impact, measured independently of first-gun loss for 20 focal worlds.
import {writeFileSync} from 'node:fs';
import * as C from '../src/contracts.js';
import {registerCoreSim} from '../src/plugins/index.sim.js';
import {createSim} from '../src/sim/sim.js';
import {createSlotTable} from '../src/ai/slots.js';
registerCoreSim();C.freezeRegistries();const map=C.getMap('forest-duel'),rows=[];
for(let seed=1;seed<=20;seed++){
 let api;const sim=createSim({map,seed,slots:createSlotTable(map,{aiLevel:5}),hooks:{onReady(a){api=a;}}});let hit=null;
 for(let t=0;t<3600&&!hit;t++){
  sim.tick([]);const events=sim.drainEvents();
  for(let i=0;i<events.length;i++)if(events[i].type===C.EV.IMPACT){const p=events[i].payload;let end=events.findIndex((e,j)=>j>i&&e.type===C.EV.IMPACT);if(end<0)end=events.length;const damage=events.slice(i+1,end).find(e=>[C.EV.BLOCK_DAMAGED,C.EV.BLOCK_DESTROYED,C.EV.NPC_DIED,C.EV.WEAPON_DESTROYED].includes(e.type)&&(e.payload.plot??e.payload.castle??e.payload.slot)===1-p.slot);if(damage){hit={second:api.tick/30,attacker:p.slot,victim:1-p.slot,kind:p.hit};break;}}
 }
 rows.push({seed,hit});
}
writeFileSync('tests/evidence/critique-v3/first-hit.json',JSON.stringify(rows,null,2));console.log(rows);
