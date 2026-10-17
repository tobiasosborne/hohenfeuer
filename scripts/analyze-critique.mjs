// owns: derived, reproducible summary tables and counterfactual surrender races for critique v2.
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
const dir='tests/evidence/critique-v2',load=n=>JSON.parse(readFileSync(`${dir}/${n}.json`,'utf8'));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const q=(a,p)=>{a=[...a].sort((a,b)=>a-b);if(!a.length)return null;const i=(a.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return a[lo]+(a[hi]-a[lo])*(i-lo);};
const dist=a=>({n:a.length,min:Math.min(...a),p10:q(a,.1),median:q(a,.5),p90:q(a,.9),max:Math.max(...a),mean:mean(a)});
const count=(a,key)=>Object.fromEntries([...new Set(a.map(key))].map(k=>[k,a.filter(x=>key(x)===k).length]));
function cohort(ms){
  const sides=ms.flatMap(m=>m.sides),lengths=ms.map(m=>m.seconds),first=ms.filter(m=>m.firstGunLoss&&!m.firstGunLoss.simultaneous&&m.winnerSlot!==null);
  const paths=ms.flatMap(m=>m.paths.sides), losers=ms.filter(m=>m.winnerSlot!==null).map(m=>m.paths.sides[1-m.winnerSlot]);
  const quiet=ms.map(m=>{
    if(m.winnerSlot===null)return null;const vs=m.paths.series.filter(s=>s.second>=120).map(s=>s.sides[1-m.winnerSlot].palace);
    let longest=0,start=0;for(let end=0;end<vs.length;end++){while(Math.max(...vs.slice(start,end+1))-Math.min(...vs.slice(start,end+1))>=.02)start++;longest=Math.max(longest,end-start);}return longest;
  }).filter(x=>x!==null);
  return {n:ms.length,independentSeeds:new Set(ms.map(m=>m.seed)).size,lengthS:dist(lengths),lengthSdS:Math.sqrt(mean(lengths.map(x=>(x-mean(lengths))**2))),
    lengthBins:count(ms,m=>m.seconds<480?'<8':m.seconds<720?'8-12':m.seconds<960?'12-16':m.winnerSlot===null?'censored20':'16-20'),in12to20:ms.filter(m=>m.winnerSlot!==null&&m.seconds>=720&&m.seconds<=1200).length,
    timeouts:ms.filter(m=>!m.outcome).length,draws:ms.filter(m=>m.outcome?.draw).length,slotWins:[0,1].map(s=>ms.filter(m=>m.winnerSlot===s).length),physicalWins:[0,1].map(s=>ms.filter(m=>m.winnerSlot!==null&&(m.winnerSlot^Number(m.swap))===s).length),
    highLevelWins:ms.filter(m=>m.winnerSlot!==null&&m.levels[m.winnerSlot]===Math.max(...m.levels)).length,
    reasons:count(ms,m=>m.eliminationReason??'timeout'),capMean:mean(sides.map(s=>s.goldAtCapShare)),nearCapMean:mean(sides.map(s=>s.goldNearCapShare)),nearZeroMean:mean(sides.map(s=>s.goldNearZeroShare)),
    capMax:Math.max(...sides.map(s=>s.goldAtCapShare)),goldMin:Math.min(...ms.map(m=>Math.min(...m.goldTrajectory.flatMap(r=>r.gold)))),
    firstGunComebacks:[first.filter(m=>m.winnerSlot===m.firstGunLoss.slot).length,first.length],noFireS:dist(sides.map(s=>s.longestNoFireS)),readyNoFireMax:Math.max(...sides.map(s=>s.longestReadyNoFireS)),
    jointPalaceStallMax:Math.max(...ms.map(m=>m.longestPalaceStallS)),loserQuiet2PctS:dist(quiet),loserQuietOver3min:quiet.filter(s=>s>180).length,
    moraleMin:dist(paths.map(s=>s.minMorale)),loserMoraleMin:dist(losers.map(s=>s.minMorale)),populationMin:dist(paths.map(s=>s.minPopulation)),
    rulerExposureS:paths.reduce((s,p)=>s+p.rulerExposedS,0),rulerExposureSides:paths.filter(p=>p.rulerExposedS>0).length,rulerExposureMax:Math.max(...paths.map(p=>p.longestExposureS)),rulerMinHp:Math.min(...paths.map(p=>p.rulerMinHp)),
    below40Sides:paths.filter(p=>p.below40S>0).length,loserBelow40:losers.filter(p=>p.below40S>0).length,fleeSampleSides:ms.flatMap(m=>[0,1].map(slot=>m.paths.series.some(r=>r.sides[slot].fleeing>0))).filter(Boolean).length};
}
const result={sweeps:{},novice:{},embodied:{},surrenderCounterfactuals:[],populationCounterfactuals:[],tuningProbes:{}};
for(const label of ['critique2','critique2-levels','critique2-unequal','critique2-desert','critique2-ice','critique2-volcano']){
  if(!existsSync(`${dir}/sweep-${label}.json`))continue;const data=load(`sweep-${label}`);result.sweeps[label]=cohort(data.matches);
  if(label==='critique2-levels')for(const level of [3,5,8])result.sweeps[`level-${level}`]=cohort(data.matches.filter(m=>m.levels[0]===level));
}
for(const [filename,destination] of [['novice',result.novice],['novice-embodied',result.embodied],['novice-default-aim',result.novice],['hiding-covered',result.novice]])if(existsSync(`${dir}/${filename}.json`)){
  const matches=load(filename).matches;
  for(const group of new Set(matches.map(m=>`${m.policy}-L${m.level}`))){
    const ms=matches.filter(m=>`${m.policy}-L${m.level}`===group),ws=ms.flatMap(m=>m.windows.filter(w=>w.endS-w.startS>=10));
    const key=filename==='novice-default-aim'?`${group}-charge119-4min`:filename==='novice'&&group==='ruler-hiding-L5'?'courtyard-retreat-L5':group;
    destination[key]={n:ms.length,wins:ms.filter(m=>m.winner===0).length,timeouts:ms.filter(m=>m.winner===null).length,reasons:count(ms,m=>m.reason),lengthS:dist(ms.map(m=>m.seconds)),
      firstHitS:dist(ms.map(m=>m.firstHitS).filter(x=>x!==null)),firstPalaceS:dist(ms.map(m=>m.firstPalaceS).filter(x=>x!==null)),noPalaceHit:ms.filter(m=>m.firstPalaceS===null).length,
      decisions:dist(ws.map(w=>w.types.length)),nonAim:dist(ws.map(w=>w.types.filter(t=>!['aim','fire'].includes(t)).length)),match1:dist(ws.map(w=>w.match1.length)),
      localDecisions:ws[0]?.localTypes?dist(ws.map(w=>w.localTypes.length)):null,localNonAim:ws[0]?.localTypes?dist(ws.map(w=>w.localTypes.filter(t=>!['aim','fire'].includes(t)).length)):null,
      executedNonAim:dist(ws.map(w=>w.executed.length)),twoNonAim:ws.filter(w=>w.types.filter(t=>!['aim','fire'].includes(t)).length>=2).length,
      typeWindows:count(ws.flatMap(w=>w.types),t=>t),purchases:ms.reduce((n,m)=>n+m.purchases.length,0),newGuns:ms.reduce((n,m)=>n+m.newGuns.length,0),remoteManualShots:ms.reduce((n,m)=>n+(m.remoteManualShots??0),0),
      rulerExposureS:ms.reduce((n,m)=>n+m.paths.sides[0].rulerExposedS,0),rulerMinHp:Math.min(...ms.map(m=>m.paths.sides[0].rulerMinHp))};
    destination[key].reachedHidingRoom=ms.filter(m=>m.hidingReached).length;
  }
}
for(const filename of ['ruler-tuning','joint-tuning'])if(existsSync(`${dir}/${filename}.json`)){
  const matches=load(filename).matches;
  for(const radius of new Set(matches.map(m=>m.radius)))result.tuningProbes[`${filename}-radius${radius}`]=cohort(matches.filter(m=>m.radius===radius));
}
if(existsSync(`${dir}/sweep-critique2.json`)){
  const ms=load('sweep-critique2').matches.filter(m=>!m.swap);
  for(const minTime of [0,600,720])for(const threshold of [10,40,45,48,50,52,54,55,56,58,60,62,64,65]){
    const endings=[];for(const m of ms){let runs=[0,0],hit=null;
      for(const r of m.paths.series){if(r.second<minTime)continue;for(let slot=0;slot<2;slot++){runs[slot]=r.sides[slot].morale<=threshold?runs[slot]+1:0;if(runs[slot]>=46&&!hit)hit={seed:m.seed,second:r.second,loser:slot};}if(hit)break;}
      if(hit&&hit.second<m.seconds)endings.push(hit);
    }result.surrenderCounterfactuals.push({minTime,threshold,n:ms.length,qualifies:endings.length,earliestS:Math.min(...endings.map(e=>e.second)),endings});
  }
  for(const threshold of [11,12,13,14,15,16,17,18,20]){
    const endings=[];for(const m of ms){const row=m.paths.series.find(r=>r.sides.some(s=>s.population<threshold));if(row&&row.second<m.seconds)endings.push({seed:m.seed,second:row.second});}
    result.populationCounterfactuals.push({threshold,n:ms.length,qualifies:endings.length,endings});
  }
  const before=JSON.parse(readFileSync('tests/evidence/sweep-after.json','utf8'));
  const now=load('sweep-critique2');result.wave1Reproduction={sameSixFileFingerprint:before.sourceSha256===now.sourceSha256,
    equalDurationWinnerHash:now.matches.filter(m=>{const b=before.matches.find(x=>x.seed===m.seed&&x.swap===m.swap);return b&&b.ticks===m.ticks&&b.winnerSlot===m.winnerSlot&&b.hash===m.hash;}).length,n:now.matches.length};
}
writeFileSync(`${dir}/analysis.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
