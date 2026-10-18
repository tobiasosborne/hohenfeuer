// owns: exact headless hashes using the same palette and match options as the real frontend.
import {readFileSync,writeFileSync} from 'node:fs';
import {registerCoreSim} from '../src/plugins/index.sim.js';
import {freezeRegistries,getMap} from '../src/contracts.js';
import {createSim,restoreSim} from '../src/sim/sim.js';
import {defaultSettings,settingsToMatch} from '../src/ui/flow.js';
registerCoreSim();freezeRegistries();
const dir=process.env.WAVE3_OUT??'tests/evidence/repair-wave-3-ui',old=JSON.parse(readFileSync(`${dir}/ending-reference.json`)),results=[];
for(const seed of [6,9,1]){
 const map=getMap('forest-duel'),settings=defaultSettings([map]);settings.seed=seed;settings.slots=[{name:'West',controller:'ai',aiLevel:5,tactic:'general'},{name:'East',controller:'ai',aiLevel:5,tactic:'general'}];
 const options=settingsToMatch(settings,map);let api;const sim=createSim({...options,hooks:{onReady(a){api=a;}}}),ref=old.find(r=>r.seed===seed),checkpoints=[];
 while(api.state.tick<36000&&!api.state.outcome){sim.tick([]);sim.drainEvents();if(ref&&[ref.terminal.lastShot-1,ref.tick-1].includes(api.state.tick))checkpoints.push({tick:api.state.tick,hash:sim.hash()});}
 const hash=sim.hash(),restored=restoreSim(sim.serialize());
 const result={seed,hash,tick:api.state.tick,reason:api.state.castles.find(c=>c.eliminated)?.reason,winners:api.state.outcome?.winners,settings,slots:options.slots,checkpoints,restoredHash:restored.hash()};
 results.push(result);writeFileSync(`${dir}/ending-frontend-reference.json`,JSON.stringify(results,null,2));console.log(seed,result.tick,result.reason,hash,'restored',result.restoredHash);
}
