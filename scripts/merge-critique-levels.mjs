// owns: strict assembly of disjoint worker batches into the requested 60-match level cohort.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {parseOptions,matchJobs,summarize,summaryTable} from './sweep.mjs';
const dir='tests/evidence/critique-v2',read=n=>JSON.parse(readFileSync(`${dir}/${n}.json`,'utf8'));
const prefix=read('sweep-critique2-levels-partial').filter(m=>m.seed<=5),tail=read('sweep-critique2-levels-tail'),forest=read('sweep-critique2');
assert.equal(prefix.length,30);assert.equal(tail.matches.length,30);assert.equal(tail.sourceSha256,forest.sourceSha256);
const options=parseOptions(['--matches','60','--ai-levels','3,5,8','--label','critique2-levels','--output-dir',dir]);
const matches=[...prefix,...tail.matches].map(m=>({...m,index:(m.seed-1)*6+[3,5,8].indexOf(m.levels[0])*2+Number(m.swap)})).sort((a,b)=>a.index-b.index);
assert.equal(new Set(matches.map(m=>m.index)).size,60);
for(const j of matchJobs(options)){const m=matches[j.index];for(const k of ['seed','swap','map','levels','maxMinutes'])assert.deepEqual(m[k],j[k]);}
const summary=summarize(matches);
writeFileSync(`${dir}/sweep-critique2-levels.json`,JSON.stringify({...tail,options,summary,table:summaryTable(summary),matches,
  provenance:'Seeds 1-5 from original 60-job run; seeds 6-10 from disjoint six-worker continuation. 60 job identities asserted; no paired result copied.'},null,2));
console.log(summaryTable(summary));
