// owns: real-clock palace threshold evidence at 9:59, 10:01, 12:30 and 15:01, with no HUD or sim-state overrides.
import assert from 'node:assert/strict';
import{writeFileSync}from'node:fs';
import{startServer,launch,webglRenderer}from'./lib.mjs';
const dir='tests/evidence/repair-wave-2-ui',report={captures:[],errors:[]};let server,browser;
try{
 let url;({server,url}=await startServer());browser=await launch();const page=await browser.newPage({viewport:{width:1024,height:768}});page.setDefaultTimeout(300000);
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`${url}index.html?golden=1&screen=skirmish&profile=10&lang=en`);await page.waitForFunction(()=>window.__hohenfeuer?.ready&&window.__hohenfeuer.frontend);
 await page.evaluate(()=>{const h=window.__hohenfeuer,s=h.menu.settings;s.map='forest-duel';s.seed=1;s.slots=[{name:'West',controller:'ai',aiLevel:1,tactic:'general'},{name:'East',controller:'ai',aiLevel:1,tactic:'general'}];h.menu.show('skirmish');h.key('Enter');});
 await page.waitForFunction(()=>window.__hohenfeuer?.ready&&!window.__hohenfeuer.frontend);report.renderer=await webglRenderer(page);
 for(const [name,seconds]of [['actual-palace-0959',599],['actual-palace-1001',601],['actual-palace-1230',750],['actual-palace-1501',901]]) {
  // Short batches leave the browser responsive while real simulation time advances.
  let tick=await page.evaluate(()=>window.__hohenfeuer.state.tick);
  while(tick<seconds*30){const next=Math.min(seconds*30,tick+1800);const reached=await page.evaluate(t=>window.__hohenfeuer.stepTo(t),next);if(reached===tick)break;tick=reached;}
  await page.evaluate(()=>window.__hohenfeuer.setPose({position:[95.5,9.6,144],yaw:0,pitch:-.3,fov:60}));
  const data=await page.evaluate(()=>{const h=window.__hohenfeuer,c=h.state.castles[0];return{tick:h.state.tick,integrity:c.palaceIntegrity,threshold:c.palaceDefeatThreshold,bar:h.battleHud.palace,toast:h.battleHud.toast,menu:h.menu?.screen,texts:h.hud.frame.texts,hash:h.sim.hash()};});
  report.captures.push({name,seconds,...data});await page.screenshot({path:`${dir}/${name}.png`});
  assert.equal(data.tick,seconds*30);assert.ok(data.bar);assert.equal(data.menu,undefined);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.error=String(e.stack??e);process.exitCode=1;}
finally{await browser?.close();await server?.close();writeFileSync(`${dir}/palace-timeline.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
