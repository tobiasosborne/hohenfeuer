// owns: three difficulty-level browser replays validating every sampled reload against the headless production-camera audit.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {startServer,launch,webglRenderer} from '../tests/lib.mjs';
const dir='tests/evidence/critique-v3',report={method:'Exact command replay; camera set to the audited production rig/feel pose, with no HUD or sim-state override. Profile 3.',matches:[],errors:[]};let browser,server;
const read=()=>JSON.parse(readFileSync(`${dir}/screen-partial.json`));
try{let url;({server,url}=await startServer());browser=await launch();
 for(const level of [2,5,8]){let data;while(!data){try{data=read().find(m=>m.level===level);}catch{}if(!data)await new Promise(r=>setTimeout(r,10000));}
  const commands=JSON.parse(gunzipSync(readFileSync(`${dir}/${data.commandFile}`))),page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:1});page.setDefaultTimeout(300000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${url}index.html?golden=1&screen=skirmish&profile=3&lang=en`);await page.waitForFunction(()=>window.__hohenfeuer?.ready&&window.__hohenfeuer.frontend);
  await page.evaluate(({level,seed})=>{const h=window.__hohenfeuer,s=h.menu.settings;s.map='forest-duel';s.seed=seed;s.slots=[{name:'West',controller:'local',aiLevel:level,tactic:'general'},{name:'East',controller:'ai',aiLevel:level,tactic:'general'}];h.menu.show('skirmish');h.key('Enter');},{level,seed:data.seed});
  await page.waitForFunction(()=>window.__hohenfeuer?.ready&&!window.__hohenfeuer.frontend);report.renderer??=await webglRenderer(page);assert.match(report.renderer,/SwiftShader/);await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  const rec={level,seed:data.seed,expectedHash:data.hash,windows:[]};report.matches.push(rec);
  for(const w of data.windows){const until=Math.round(w.sampleS*30),start=await page.evaluate(()=>window.__hohenfeuer.state.tick),batch=commands.filter(c=>c.tick>=start&&c.tick<until);
   await page.evaluate(({batch,until,pose})=>{const h=window.__hohenfeuer;h.replayCommands(batch,until);h.setProfile(2);h.setPose({position:pose.pos,yaw:-pose.yaw,pitch:pose.pitch,fov:pose.fov});h.setProfile(3);h.chunks.flush();h.frame();},{batch,until,pose:w.pose});
   const actual=await page.evaluate(()=>{const h=window.__hohenfeuer;return{tick:h.state.tick,hash:h.sim.hash(),lines:h.battleHud.guidance?.lines??[],prompt:h.battleHud.prompt,mode:h.mode,texts:h.hud.frame.texts,camera:h.camera.position.toArray()};});
   const row={sampleS:w.sampleS,predicted:w.lines,...actual,linesMatch:JSON.stringify(w.lines)===JSON.stringify(actual.lines),stateMatches:w.stateHash?actual.hash===w.stateHash:null};rec.windows.push(row);
   if(rec.windows.length===1||actual.lines.length||rec.windows.length%5===0)await page.screenshot({path:`${dir}/shots/proxy-L${level}-seed${data.seed}-${until}.png`});writeFileSync(`${dir}/proxy-browser.json`,JSON.stringify(report,null,2));console.log(level,data.seed,until,row.linesMatch,actual.lines);
  }
  const start=await page.evaluate(()=>window.__hohenfeuer.state.tick),until=Math.round(data.seconds*30),batch=commands.filter(c=>c.tick>=start&&c.tick<until);await page.evaluate(({batch,until})=>window.__hohenfeuer.replayCommands(batch,until),{batch,until});rec.finalHash=await page.evaluate(()=>window.__hohenfeuer.sim.hash());assert.equal(rec.finalHash,data.hash);await page.screenshot({path:`${dir}/shots/proxy-L${level}-seed${data.seed}-end.png`});await page.close();
 }
 report.windowCount=report.matches.reduce((n,m)=>n+m.windows.length,0);report.matchesCount=report.matches.flatMap(m=>m.windows).filter(w=>w.linesMatch).length;assert.deepEqual(report.errors,[]);report.status='completed';
}catch(e){report.status='failed';report.error=String(e.stack??e);process.exitCode=1;}
finally{await browser?.close();await server?.close();writeFileSync(`${dir}/proxy-browser.json`,JSON.stringify(report,null,2));console.log(report.status,report.error??'');}
