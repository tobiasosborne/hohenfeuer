// owns: isolated causal test of the warned novice forgetting its gun when danger interrupts a repair.
import {registerHooks} from 'node:module';
import {writeFileSync} from 'node:fs';
const url=new URL('./novice.mjs',import.meta.url).href;
registerHooks({load(u,c,next){const r=next(u,c);if(u!==url)return r;const before='if(!evasion)evasion={origin:{...r.pos},safe,weaponId:r.manning};',after='if(!evasion)evasion={origin:{...r.pos},safe,weaponId:r.manning ?? pendingOrder?.weaponId};';let s=String(r.source);if(!s.includes(before))throw Error('Policy source changed');return {...r,source:s.replace(before,after)};}});
const {runNovice}=await import('./novice.mjs');const actions=[];
const result=runNovice({seed:6,level:5,policy:'novice',compact:true,onCommands(s,cs){if(s.tick>=160*30)for(const c of cs)if(['man-weapon','fire'].includes(c.type))actions.push({second:s.tick/30,type:c.type,weaponId:c.weaponId,previousManning:s.rulers[0].manning,pos:s.rulers[0].pos});}});
writeFileSync('tests/evidence/critique-v3/policy-gun-memory-control.json',JSON.stringify({change:'evasion.weaponId = ruler.manning ?? pendingOrder?.weaponId; source transformed in memory only; no source or scored-cohort replacement',result,actions},null,2));console.log(result.seconds,result.reason,result.winner,result.shots,result.hash);
