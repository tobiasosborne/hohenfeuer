// owns: cause-sentence coverage for every loss in the existing 30-match critique-v2 novice cohort; not a new simulation sweep.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {lossAccount} from '../src/ui/battle-feedback.js';
const data=JSON.parse(readFileSync('tests/evidence/critique-v2/novice-embodied.json'));
const matches=data.matches.filter(m=>m.policy==='novice');assert.equal(matches.length,30);
const losses=matches.filter(m=>m.winner===1).map(m=>{
  const state={tick:m.outcome.tick,outcome:m.outcome,castles:[{reason:m.reason}]};
  const captions=Object.fromEntries(['de','en'].map(lang=>[lang,lossAccount(state,0,null,{lang}).cause]));
  for(const text of Object.values(captions)){assert.ok(text.endsWith('.'));assert.ok(!text.includes('{'));assert.ok(text.length<140);}
  assert.match(captions.en,m.reason==='ruler'?/ruler died/:/palace/);
  return{level:m.level,seed:m.seed,reason:m.reason,captions};
});
const report={source:'tests/evidence/critique-v2/novice-embodied.json',matches:matches.length,losses,
  limitation:'Legacy summary data has no killer event; these are honest cause fallbacks. Exact killer attribution is checked separately by ui-repair-replay.mjs.'};
writeFileSync('tests/evidence/repair-wave-2-ui/cohort-loss-captions.json',JSON.stringify(report,null,2));console.log(`${losses.length}/${losses.length} losses have cause sentences in both languages across ${matches.length} legacy matches.`);
