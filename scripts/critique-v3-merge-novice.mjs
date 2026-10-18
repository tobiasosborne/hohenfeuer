// owns: assembling disjoint novice difficulty batches and stopping redundant jobs only after all ten AI2 worlds finish.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const d='tests/evidence/critique-v3',get=p=>JSON.parse(readFileSync(p)),pause=()=>new Promise(r=>setTimeout(r,10000));
let lower;
while(true){try{lower=get(`${d}/novice-partial.json`).filter(m=>m.level===2);if(lower.length===10)break;}catch{}await pause();}
const stop=Number(process.argv[process.argv.indexOf('--stop-pid')+1]);if(process.argv.includes('--stop-pid')&&stop>0)try{const args=readFileSync(`/proc/${stop}/cmdline`,'utf8');if(args.includes('critique-v3-run.mjs')&&args.includes('novice'))process.kill(stop,'SIGTERM');}catch{}
writeFileSync(`${d}/novice-lower.json`,JSON.stringify({matches:lower}));
while(!existsSync(`${d}/novice-upper.json`))await pause();
const matches=[...lower,...get(`${d}/novice-upper.json`).matches].sort((a,b)=>a.level-b.level||a.seed-b.seed);
if(matches.length!==30||new Set(matches.map(m=>m.level+'/'+m.seed)).size!==30)throw Error('Incomplete or duplicate novice cohort');
writeFileSync(`${d}/novice.json`,JSON.stringify({method:'scripts/critique-v3-run.mjs; disjoint AI2 and AI5/8 batches',matches}));console.log('Merged 30 novice worlds');
