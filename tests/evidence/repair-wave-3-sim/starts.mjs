// owns: paid first-fire regression gates across all four offered duels and ten seeds.
import {writeFileSync} from 'node:fs';
import * as C from '../../../src/contracts.js';
import {registerCoreSim} from '../../../src/plugins/index.sim.js';
import {createSim} from '../../../src/sim/sim.js';
import {createSlotTable} from '../../../src/ai/slots.js';
C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();const matches=[];
for(const biome of ['forest','desert','ice','volcano'])for(let seed=1;seed<=10;seed++){
 const map=C.getMap(`${biome}-duel`),slots=createSlotTable(map,{aiLevel:5});let api;
 const sim=createSim({map,seed,slots,hooks:{onReady(a){api=a;}}}),first=[null,null];
 while(api.tick<90*30&&first.some(s=>s===null)&&!api.state.outcome){sim.tick();for(const e of sim.drainEvents())if(e.type===C.EV.SHOT_FIRED)first[e.payload.slot]??=api.tick/30;}
 const row={biome,seed,firstShotS:first,paid:api.state.castles.map(c=>c.stats.ammoCosts)};matches.push(row);console.log(JSON.stringify(row));
}
const pass=matches.every(r=>r.firstShotS.every(s=>s!==null&&s<=90)&&r.paid.every(g=>g>0));
writeFileSync(new URL('./starts.json',import.meta.url),JSON.stringify({pass,matches}));if(!pass)process.exitCode=1;
