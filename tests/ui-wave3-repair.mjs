// owns: an incoming-projectile palace wound and ordinary paid repair shown on the existing palace bar.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {startServer,launch,webglRenderer} from './lib.mjs';
const dir=process.env.WAVE3_OUT??'tests/evidence/repair-wave-3-ui',report={errors:[],samples:[]};mkdirSync(`${dir}/shots`,{recursive:true});let browser,server;
try{let url;({server,url}=await startServer());browser=await launch();const page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:1});page.setDefaultTimeout(300000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`${url}index.html?golden=1&profile=3&lang=en`);await page.waitForFunction(()=>window.__hohenfeuer?.ready);report.renderer=await webglRenderer(page);assert.match(report.renderer,/SwiftShader/);await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});
 report.setup=await page.evaluate(()=>{const h=window.__hohenfeuer;h.setBuild({mode:'none'});const cell=[25,1,22];let shots=0,damaged=[];
  while(shots++<20&&!damaged.length){h.enemyShot(cell);h.stepTo(h.state.tick+12);const c=h.state.castles[0];damaged=c.palaceCells.filter(i=>c.plot.type[i]===11&&c.plot.hp[i]>0&&c.plot.hp[i]<96);}
  if(!damaged.length)throw Error('No recoverable palace wound');const c=h.state.castles[0],p=c.plot,i=damaged[0],target=[i%p.width,Math.floor(i/(p.width*p.depth)),Math.floor(i/p.width)%p.depth];
  return{incomingShots:shots-1,cell:target,index:i,tick:h.state.tick,hp:p.hp[i],gold:c.gold,palace:c.palaceIntegrity,bar:h.battleHud.palace};
 });
 await page.screenshot({path:`${dir}/shots/palace-repair-before.png`});
 await page.evaluate(cell=>{const h=window.__hohenfeuer;h.issue({type:'repair-priority',cell});h.stepTo(h.state.tick+1);},report.setup.cell);
 const mid=await page.evaluate(({index,hp})=>{const h=window.__hohenfeuer;h.stepTo(h.state.tick+1800,s=>s.castles[0].plot.hp[index]>hp&&!!h.battleHud.palace?.repair);return{tick:h.state.tick,hp:h.state.castles[0].plot.hp[index],bar:h.battleHud.palace,texts:h.hud.frame.texts,gold:h.state.castles[0].gold};},report.setup);
 report.mid=mid;assert.ok(mid.hp>report.setup.hp&&mid.hp<96);assert.ok(mid.bar.repair);assert.ok(mid.texts.some(t=>t.startsWith('Repair ')));report.mid=mid;await page.screenshot({path:`${dir}/shots/palace-repair-progress.png`});
 report.after=await page.evaluate(index=>{const h=window.__hohenfeuer;h.stepTo(h.state.tick+1800,s=>s.castles[0].plot.hp[index]===96);return{tick:h.state.tick,hp:h.state.castles[0].plot.hp[index],bar:h.battleHud.palace,gold:h.state.castles[0].gold};},report.setup.index);
 assert.equal(report.after.hp,96);assert.equal(report.after.bar?.repair,undefined);await page.screenshot({path:`${dir}/shots/palace-repair-after.png`});assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.error=String(e.stack??e);process.exitCode=1;}
finally{await browser?.close();await server?.close();writeFileSync(`${dir}/palace-repair.json`,JSON.stringify(report,null,2));console.log(report.status,report.error??'');}
