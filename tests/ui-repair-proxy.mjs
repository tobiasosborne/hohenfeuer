// owns: a small, explicitly unchanged novice-policy decision-density comparison; no claim of human discovery.
import {runNovice} from '../scripts/novice.mjs';
import {writeFileSync,readFileSync} from 'node:fs';
const baseline=JSON.parse(readFileSync('tests/evidence/critique-v2/novice-embodied.json')).matches;
const report={policy:'scripts/novice.mjs unchanged; UI is not observed by this proxy',matches:[]};
for(const level of [2,5,8]) {
  const r=runNovice({seed:1,level,policy:'novice',maxMinutes:20});
  const b=baseline.find(b=>b.seed===1&&b.level===level&&b.policy==='novice');
  const local=r.windows.filter(w=>w.endS-w.startS>=10);
  report.matches.push({level,seed:1,seconds:r.seconds,reason:r.reason,winner:r.winner,hash:r.hash,
    decisionSummary:r.decisionSummary,meanLocalTypes:local.length?local.reduce((s,w)=>s+w.localTypes.length,0)/local.length:null,
    baseline:b?{seconds:b.seconds,reason:b.reason,decisionSummary:b.decisionSummary}:null});
  writeFileSync('tests/evidence/repair-wave-2-ui/novice-proxy.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report.matches.at(-1)));
}
