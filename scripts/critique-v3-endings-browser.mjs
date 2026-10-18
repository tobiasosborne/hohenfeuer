// owns: actual first-person forest endings, pressure lines and ruler-decision screenshots; no HUD or state fixtures.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {startServer,launch,webglRenderer} from '../tests/lib.mjs';
const dir='tests/evidence/critique-v3',reference=JSON.parse(readFileSync('tests/evidence/repair-wave-2-sim/sweep-focal.json')).matches.filter(m=>!m.swap),report={captures:[],errors:[]};let browser,server;
try{let url;({server,url}=await startServer());browser=await launch();
 for(const seed of [1,4,6,9,16]){
  const page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:1});page.setDefaultTimeout(300000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${url}index.html?golden=1&screen=skirmish&profile=10&lang=en`);await page.waitForFunction(()=>window.__hohenfeuer?.ready&&window.__hohenfeuer.frontend);
  await page.evaluate(seed=>{const h=window.__hohenfeuer,s=h.menu.settings;s.map='forest-duel';s.seed=seed;s.slots=[{name:'West',controller:'ai',aiLevel:5,tactic:'general'},{name:'East',controller:'ai',aiLevel:5,tactic:'general'}];h.menu.show('skirmish');h.key('Enter');},seed);
  await page.waitForFunction(()=>window.__hohenfeuer?.ready&&!window.__hohenfeuer.frontend);report.renderer??=await webglRenderer(page);assert.match(report.renderer,/SwiftShader/);await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  const ref=reference.find(m=>m.seed===seed),end=ref.ticks;
  const points=seed===1?[['m00',0],['m02',3600],['m05',9000],['m10',18000],['end',end]]:[['before',end-90],['last',end-1],['end',end]];
  for(const [name,target]of points){let t=await page.evaluate(()=>window.__hohenfeuer.state.tick);while(t<target){const next=Math.min(target,t+900);t=await page.evaluate(n=>window.__hohenfeuer.stepTo(n),next);if(await page.evaluate(()=>!!window.__hohenfeuer.state.outcome))break;}
   const row=await page.evaluate(()=>{const h=window.__hohenfeuer;h.chunks.flush();h.frame();return{tick:h.state.tick,ruler:h.state.rulers[0],castles:h.state.castles.map(c=>({morale:c.morale,pop:c.population,pressure:c.pressure,surrender:c.surrender,palace:c.palaceIntegrity,reason:c.reason})),hud:{pressure:h.battleHud.pressure,palace:h.battleHud.palace,danger:h.battleHud.danger,texts:h.hud.frame.texts},outcome:h.state.outcome,account:h.menu?.result?.account};});
   const file=`ai-seed${seed}-${name}`;report.captures.push({seed,name,file,...row});await page.screenshot({path:`${dir}/shots/${file}.png`});writeFileSync(`${dir}/endings-browser.json`,JSON.stringify(report,null,2));console.log(file,row.tick,row.hud.pressure);
  }
  const actual=report.captures.at(-1);assert.equal(actual.tick,end);assert.equal(actual.castles.find(c=>c.reason)?.reason,ref.eliminationReason);await page.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.error=String(e.stack??e);process.exitCode=1;}
finally{await browser?.close();await server?.close();writeFileSync(`${dir}/endings-browser.json`,JSON.stringify(report,null,2));console.log(report.status,report.error??'');}
