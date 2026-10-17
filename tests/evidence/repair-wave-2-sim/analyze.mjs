// Owns acceptance aggregation of independently seeded final cohorts, keeping paired orders explicit.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {summarize} from '../../../scripts/sweep.mjs';
const root=new URL('./',import.meta.url);
const get=name=>JSON.parse(readFileSync(new URL(name,root),'utf8'));
const load=name=>existsSync(new URL(name,root))?get(name):null;
const cohort=name=>load(`sweep-${name}.json`);
const focal=cohort('focal'),matrixBefore=cohort('matrix'),trained=cohort('matrix3-final'),unequal=cohort('unequal');
const matrix=trained&&matrixBefore?{...trained,matches:[...trained.matches,...matrixBefore.matches.filter(m=>m.levels[0]===8)],inputs:[trained.sourceSha256,matrixBefore.sourceSha256]}:matrixBefore;
const audit=cohort('lowmotion-audit'),parity=load('upper-level-parity.json');
if(audit&&focal){
 if(audit.matches.length!==20)throw Error('Incomplete low-motion replay audit');
 for(const a of audit.matches){
  const normal=focal.matches.find(m=>m.seed===a.seed&&!m.swap);
  for(const k of ['hash','ticks','winnerSlot','eliminationReason','sides','shotEvents','minuteCurve','rulerIntent','firstGunLoss'])if(JSON.stringify(a[k])!==JSON.stringify(normal[k]))throw Error(`Audit replay mismatch ${a.seed}/${k}`);
  for(const m of focal.matches.filter(m=>m.seed===a.seed)){
   if(m.seconds!==a.seconds||(m.swap?1-m.winnerSlot:m.winnerSlot)!==a.winnerSlot)throw Error('Physical pairing mismatch');
   for(let t=0;t<m.minuteCurve.length;t++)for(let i=0;i<2;i++)if(m.minuteCurve[t].sides[i].palace!==a.minuteCurve[t].sides[m.swap?1-i:i].palace)throw Error('Paired palace trajectory mismatch');
   m.lowMotion=m.swap?[...a.lowMotion].reverse():a.lowMotion;m.lowMotionAudited=true;
  }
 }
}

const biomes=Object.fromEntries(['desert','ice','volcano'].map(b=>[b,cohort(b)]));
const novice=load('novice-final.json');
const measure=matches=>{
 const summary=summarize(matches),sides=matches.flatMap(m=>m.sides);
 const first=matches.filter(m=>m.firstGunLoss&&!m.firstGunLoss.simultaneous&&m.winnerSlot!==null);
 const worlds=first.filter(m=>!m.swap);
 return {...summary,independentSeeds:new Set(matches.map(m=>m.seed)).size,
   physicalWins:[0,1].map(i=>matches.filter(m=>m.winnerSlot!==null&&(m.swap?1-m.winnerSlot:m.winnerSlot)===i).length),
   firstShotsPass:sides.filter(s=>s.firstShotS!==null&&s.firstShotS<=90).length,sideCount:sides.length,
   firstShotMaxS:Math.max(...sides.map(s=>s.firstShotS??Infinity)),
   endingsBefore7:matches.filter(m=>m.winnerSlot!==null&&m.seconds<420).length,
   lowMotionOver3Min:matches.filter(m=>m.winnerSlot!==null&&m.lowMotion?.[1-m.winnerSlot]>180).length,
   lowMotionMaxS:Math.max(...matches.flatMap(m=>m.lowMotion??[0])),
   actualLongGaps:matches.flatMap(m=>(m.fireGaps??[]).filter(g=>g.seconds>120).map(g=>({seed:m.seed,swap:m.swap,...g}))),
   readyLongSides:matches.flatMap(m=>m.sides.flatMap((s,slot)=>s.longestReadyNoFireS>90?[{seed:m.seed,swap:m.swap,slot,seconds:s.longestReadyNoFireS,idleSeconds:s.idleSeconds,gaps:m.fireGaps}]:[])),
   rulerIntent:matches.flatMap(m=>(m.rulerIntent??[]).map(r=>({seed:m.seed,swap:m.swap,...r}))),
   moraleClockFinishes:matches.filter(m=>m.eliminationReason==='surrender'&&m.finalSurrender?.some(s=>s.holdTicks>=s.holdRequiredTicks)).length,
   moraleCrossings:matches.flatMap(m=>(m.surrenderCrossings??[]).map(c=>({seed:m.seed,swap:m.swap,...c}))),
   independentFirstGunCases:worlds.length,independentFirstGunComebacks:worlds.filter(m=>m.winnerSlot===m.firstGunLoss.slot).length};
};
const results={};
if(focal){
 if(focal.matches.length!==40||new Set(focal.matches.map(m=>m.seed)).size!==20)throw Error('Incomplete focal cohort');
 for(const seed of new Set(focal.matches.map(m=>m.seed)))if(focal.matches.filter(m=>m.seed===seed).length!==2)throw Error('Focal pairing');
 results.focal=measure(focal.matches);
}
if(focal&&matrix){const all=[...focal.matches.filter(m=>m.seed<=10),...matrix.matches];
 if(all.length!==60)throw Error('Incomplete matrix');
 for(const seed of Array.from({length:10},(_,i)=>i+1))for(const level of [3,5,8]){
  const group=all.filter(m=>m.seed===seed&&m.levels.every(l=>l===level));if(group.length!==2||!group.some(m=>m.swap)||!group.some(m=>!m.swap))throw Error('Matrix job identity');
 }
 results.matrix=measure(all);results.matrixBeforeTrainedCap=measure([...focal.matches.filter(m=>m.seed<=10),...matrixBefore.matches]);results.matrixByLevel=Object.fromEntries([3,5,8].map(l=>[l,measure(all.filter(m=>m.levels[0]===l))]));
}
if(unequal){if(unequal.matches.length!==40)throw Error('Incomplete unequal cohort');
 for(let seed=1;seed<=10;seed++)for(const levels of ['3,8','8,3']){
  const g=unequal.matches.filter(m=>m.seed===seed&&String(m.physicalLevels)===levels);if(g.length!==2||!g.some(m=>m.swap)||!g.some(m=>!m.swap))throw Error('Unequal physical identity');
 }
 results.unequal=measure(unequal.matches);results.unequalByPhysicalAssignment=Object.fromEntries(['3,8','8,3'].map(p=>[p,measure(unequal.matches.filter(m=>String(m.physicalLevels)===p))]));
}
results.biomes={};if(focal)results.biomes.forest=measure(focal.matches.filter(m=>!m.swap&&m.seed<=10));
for(const [b,c]of Object.entries(biomes))if(c){if(c.matches.length!==10||new Set(c.matches.map(m=>m.seed)).size!==10)throw Error(`Incomplete ${b}`);results.biomes[b]=measure(c.matches);}
if(novice){const a=novice.matches;results.novice={matches:a.length,wins:a.filter(m=>m.winner===0).length,timeouts:a.filter(m=>!m.outcome).length,pacingPass:a.filter(m=>m.outcome&&m.seconds>=720&&m.seconds<=1200).length,minimumS:Math.min(...a.map(m=>m.seconds)),maximumS:Math.max(...a.map(m=>m.seconds)),earlyRulerDeaths:a.filter(m=>m.reason==='ruler'&&m.seconds<420),remoteManualShots:a.reduce((n,m)=>n+m.remoteManualShots,0),reasons:Object.fromEntries([...new Set(a.map(m=>m.reason))].map(r=>[r,a.filter(m=>m.reason===r).length]))};}
const pace=rows=>({matches:rows.length,pacingPass:rows.filter(r=>r.finished&&r.seconds>=720&&r.seconds<=1200).length,timeouts:rows.filter(r=>!r.finished).length});
const ai5=[...(focal?.matches??[]),...Object.values(biomes).flatMap(c=>c?.matches??[])];
const extras=matrix?.matches??[],unequalRows=unequal?.matches??[];
const aiRows=[...ai5,...extras,...unequalRows].map(m=>({seconds:m.seconds,finished:m.winnerSlot!==null}));
const noviceRows=(novice?.matches??[]).map(m=>({seconds:m.seconds,finished:Boolean(m.outcome)}));
results.requestedAI=pace(aiRows);results.defaultAI5IncludingNovice=pace([...ai5.map(m=>({seconds:m.seconds,finished:m.winnerSlot!==null})),...noviceRows]);results.allIncludingNovice=pace([...aiRows,...noviceRows]);
results.metricAudit={complete:Boolean(audit),normalOrderExactReplays:audit?.matches.length??0,pairedPalaceMinuteCurvesChecked:audit?40:0,exclusionStartsAtS:120,rangeStrictlyBelow:.02};
results.upperLevelParity=parity;results.matrixSources=matrix?.inputs??[matrix?.sourceSha256];
results.sourceFingerprints=Object.fromEntries([['focal',focal],['matrix',matrix],['unequal',unequal],...Object.entries(biomes)].filter(([,c])=>c).map(([n,c])=>[n,c.sourceSha256]));
writeFileSync(new URL('acceptance.json',root),JSON.stringify(results,null,2));
for(const [name,s]of Object.entries({...results,biomes:undefined,matrixByLevel:undefined,unequalByPhysicalAssignment:undefined}))if(s)console.log(name,JSON.stringify(s,(k,v)=>['actualLongGaps','readyLongSides','rulerIntent','moraleCrossings'].includes(k)?Array.isArray(v)?v.length:v:v));
for(const [name,s]of Object.entries(results.biomes))console.log(name,`${s.matches} matches; pacing ${s.pacingPass}; first shots ${s.firstShotsPass}/${s.sideCount}; max silence ${s.maxNoFireS}; endings ${JSON.stringify(s.reasons)}`);
