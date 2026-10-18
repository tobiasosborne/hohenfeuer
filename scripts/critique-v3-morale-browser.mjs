// owns: an actual morale-clock surrender replay, with population still above its surrender threshold.
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {startServer,launch,webglRenderer} from '../tests/lib.mjs';
const dir='tests/evidence/critique-v3',record=JSON.parse(readFileSync(`${dir}/novice.json`)).matches.find(m=>m.level===2&&m.seed===3),commands=JSON.parse(gunzipSync(readFileSync(`${dir}/traces/L2-seed3.json.gz`))),report={captures:[],errors:[]};let server,browser;
try{let url;({server,url}=await startServer());browser=await launch();const page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:1});page.setDefaultTimeout(300000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`${url}index.html?golden=1&screen=skirmish&profile=3&lang=en`);await page.waitForFunction(()=>window.__hohenfeuer?.ready&&window.__hohenfeuer.frontend);
 await page.evaluate(()=>{const h=window.__hohenfeuer,s=h.menu.settings;s.map='forest-duel';s.seed=3;s.slots=[{name:'West',controller:'local',aiLevel:2,tactic:'general'},{name:'East',controller:'ai',aiLevel:2,tactic:'general'}];h.menu.show('skirmish');h.key('Enter');});await page.waitForFunction(()=>window.__hohenfeuer?.ready&&!window.__hohenfeuer.frontend);report.renderer=await webglRenderer(page);assert.match(report.renderer,/SwiftShader/);await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});
 const end=Math.round(record.seconds*30);
 for(const [name,target]of [['hold-start',end-1320],['hold-30',end-450],['last',end-1],['end',end]]){
  let start=await page.evaluate(()=>window.__hohenfeuer.state.tick);while(start<target){const until=Math.min(target,start+900),batch=commands.filter(c=>c.tick>=start&&c.tick<until);start=await page.evaluate(({batch,until})=>window.__hohenfeuer.replayCommands(batch,until),{batch,until});}
  const row=await page.evaluate(async()=>{const h=window.__hohenfeuer,{walkPose,weaponPose}=await import('/src/player/camera.js'),{K}=await import('/src/contracts.js'),r=h.state.rulers[0],w=h.state.weapons.find(w=>w.id===r.manning),pose=w?weaponPose({pivot:[w.pos.x,w.pos.y,w.pos.z],azDeg:w.aim.az/10}):walkPose({pos:[r.pos.x,r.pos.y,r.pos.z],yaw:r.yaw/K.YAW_UNITS*Math.PI*2,pitch:r.pitch/K.PITCH_LIMIT*Math.PI/2});h.setPose({position:pose.pos,yaw:-pose.yaw,pitch:pose.pitch,fov:pose.fov});const c=h.state.castles[0];return{tick:h.state.tick,hash:h.sim.hash(),morale:c.morale,population:c.population,pressure:c.pressure,surrender:c.surrender,hud:h.battleHud.pressure,texts:h.hud.frame.texts,account:h.menu?.result?.account};});
  report.captures.push({name,...row});await page.screenshot({path:`${dir}/shots/morale-clock-${name}.png`});writeFileSync(`${dir}/morale-browser.json`,JSON.stringify(report,null,2));console.log(name,row.tick,row.hud);
 }
 assert.equal(report.captures.at(-1).hash,record.hash);assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.error=String(e.stack??e);process.exitCode=1;}
finally{await browser?.close();await server?.close();writeFileSync(`${dir}/morale-browser.json`,JSON.stringify(report,null,2));console.log(report.status,report.error??'');}
