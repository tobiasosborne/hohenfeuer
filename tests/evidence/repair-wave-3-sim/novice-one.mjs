// owns: bounded novice command/position/idle diagnostics without per-second trajectory files.
import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';
const args=process.argv.slice(2),get=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const root=get('--root',process.cwd()),seed=Number(get('--seed','1')),level=Number(get('--level','2'));
const {runNovice}=await import(pathToFileURL(`${root}/scripts/novice.mjs`).href),samples=[];
const result=runNovice({seed,level,policy:'novice',compact:true,onCommands(s,cmds){if(s.tick%900===0){const row={second:s.tick/30,ruler:{pos:s.rulers[0].pos,manning:s.rulers[0].manning},commands:cmds,weapon:s.weapons.filter(w=>w.slot===0).map(w=>({id:w.id,hp:w.hp,pos:w.pos,idle:w.idleReason,crew:w.crewPresent,ammo:w.ammo})),target:s.castles[1].palaceIntegrity};samples.push(structuredClone(row));console.log(JSON.stringify(row));}}});
writeFileSync(new URL(`./novice-one-L${level}-s${seed}.json`,import.meta.url),JSON.stringify({root,result,samples}));console.log(result.seconds,result.reason,result.hash);
