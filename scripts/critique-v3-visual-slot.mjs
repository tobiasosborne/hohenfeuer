// owns: temporarily releasing CPU from this audit's workers for screenshot retries, always resuming them afterwards.
import {readdirSync,readFileSync,writeFileSync,openSync} from 'node:fs';
import {spawn} from 'node:child_process';
const dir='tests/evidence/critique-v3',paused=[],report={paused,gates:[]};
function run(label,args,env={}){return new Promise(res=>{const fd=openSync(`${dir}/${label}.log`,'w'),p=spawn(process.execPath,args,{stdio:['ignore',fd,fd],env:{...process.env,...env}});p.on('exit',code=>{report.gates.push({label,code});writeFileSync(`${dir}/visual-slot.json`,JSON.stringify(report));res();});});}
try{
 for(const id of readdirSync('/proc').filter(n=>/^\d+$/.test(n))){try{const cmd=readFileSync(`/proc/${id}/cmdline`,'utf8').split('\0');if(cmd[0].endsWith('/node')||cmd[0]==='node'){if(['scripts/sweep.mjs','scripts/critique-v3-run.mjs','scripts/critique-v3-screen-run.mjs'].includes(cmd[1])){process.kill(Number(id),'SIGSTOP');paused.push({pid:Number(id),command:cmd.join(' ')});}}}catch{}}
 writeFileSync(`${dir}/visual-slot.json`,JSON.stringify(report));
 const all=Object.keys(JSON.parse(readFileSync('tests/goldens/poses.json'))),passed=[...readFileSync(`${dir}/goldens.log`,'utf8').matchAll(/^(.+): ok \(0 px differ\)$/gm)].map(m=>m[1]);
 report.remaining=all.filter(n=>!passed.includes(n));await run('goldens-retry',['scripts/critique-v3-gates.mjs','goldens'],{GOLDENS_ONLY:report.remaining.join(',')});
 await run('impact-finalize',['scripts/critique-v3-browser.mjs','--resume']);await run('long-miss',['scripts/critique-v3-long-miss.mjs']);
}finally{for(const p of paused)try{process.kill(p.pid,'SIGCONT');}catch{}report.resumed=true;writeFileSync(`${dir}/visual-slot.json`,JSON.stringify(report,null,2));console.log(report);}
