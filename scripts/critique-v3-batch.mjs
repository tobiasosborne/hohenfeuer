// owns: sequential existing acceptance gates or compact reproduction cohorts with bounded worker concurrency.
import {spawn} from 'node:child_process';
import {openSync,writeFileSync,existsSync} from 'node:fs';
const dir='tests/evidence/critique-v3',type=process.argv[2],results=[];
function run(label,args){return new Promise(res=>{const fd=openSync(`${dir}/${label}.log`,'w'),p=spawn(process.execPath,args,{stdio:['ignore',fd,fd]});p.on('exit',code=>{results.push({label,code});writeFileSync(`${dir}/${type}-batch.json`,JSON.stringify(results));console.log(label,code);res();});});}
if(type==='gates')for(const gate of ['browser','flow','onboarding','actions','palace','goldens'])await run(gate,['scripts/critique-v3-gates.mjs',gate]);
if(type==='sweeps'){
 while(!existsSync(`${dir}/sweep-focal.json`)||!existsSync(`${dir}/sweep-matrix.json`))await new Promise(r=>setTimeout(r,10000));
 await run('unequal',['scripts/sweep.mjs','--seeds','10','--levels','3,8','--both-assignments','--compact','--workers','4','--label','unequal','--output-dir',dir]);
 for(const map of ['desert','ice','volcano'])await run(map,['scripts/sweep.mjs','--seeds','10','--no-swap-slot','--map',map+'-duel','--compact','--workers','4','--label',map,'--output-dir',dir]);
}
if(type==='ending-screens'){
 while(!existsSync(`${dir}/impact-browser.json`)||JSON.parse((await import('node:fs')).readFileSync(`${dir}/impact-browser.json`)).status===undefined)await new Promise(r=>setTimeout(r,10000));
 await run('endings-browser',['scripts/critique-v3-endings-browser.mjs']);
}
if(type==='mirror'){
 while(!existsSync(`${dir}/environment.json`))await new Promise(r=>setTimeout(r,10000));
 await run('mirror',['scripts/critique-v3-run.mjs','--mode','environment','--seeds','20','--conditions','mirror','--workers','3','--label','mirror']);
}
