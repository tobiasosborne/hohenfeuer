// owns: real damaged-block -> reticle -> R -> paid repair progress and actual impact browser evidence.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {startServer,launch,webglRenderer} from './lib.mjs';
const dir='tests/evidence/repair-wave-2-ui',report={checks:[],errors:[],captures:[]};
let server,browser;
try {
 let url;({server,url}=await startServer());browser=await launch();
 const page=await browser.newPage({viewport:{width:1024,height:768}});page.setDefaultTimeout(180000);
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`${url}index.html?golden=1&profile=10&lang=en`);await page.waitForFunction(()=>window.__hohenfeuer?.ready);
 report.renderer=await webglRenderer(page);
 await page.evaluate(()=>{const h=window.__hohenfeuer;h.setPose({script:'tb1',until:250});h.setBuild({mode:'none'});h.setProfile(2);h.enemyShot([41,7,20]);h.stepTo(280);
  const p=h.state.castles[0].plot,r=h.state.rulers[0],cell=[41,7,20],pos=[p.origin.x+41.5,p.origin.y+7.5,p.origin.z+20.5];
  const dx=pos[0]-r.pos.x,dz=pos[2]-r.pos.z,dy=pos[1]-r.pos.y-1.6;
  h.setProfile(2);h.setBuild({mode:'none'},{yaw:Math.atan2(dx,-dz),pitch:Math.atan2(dy,Math.hypot(dx,dz))});
 });
 const before=await page.evaluate(()=>{const h=window.__hohenfeuer,p=h.state.castles[0].plot,i=41+p.width*20+p.width*p.depth*7;return{tick:h.state.tick,hp:p.hp[i],gold:h.state.castles[0].gold,target:h.construction().target,guidance:h.battleHud.guidance,texts:h.hud.frame.texts};});
 report.before=before;assert.equal(before.target.kind,'block');assert.deepEqual(before.target.cell,[41,7,20]);assert.ok(before.hp<40&&before.hp>0);
 assert.ok(before.guidance?.lines.some(s=>s.startsWith('R:')),'first damage offers one reachable repair');
 await page.screenshot({path:`${dir}/actual-repair-before.png`});
 await page.keyboard.press('KeyR');await page.evaluate(()=>{window.__hohenfeuer.playerStep();window.__hohenfeuer.playerStep();});
 const ordered=await page.evaluate(()=>{const h=window.__hohenfeuer;return h.state.castles[0].jobs.filter(j=>j.kind==='repair'&&j.target.cell?.join()==='41,7,20');});
 assert.equal(ordered[0]?.priority,3);report.checks.push('real-reticle-R-priority');
 let mid=null;report.repairSamples=[];
 for(let i=0;i<60;i++){
   await page.evaluate(()=>{const h=window.__hohenfeuer;h.stepTo(h.state.tick+30);});
   const data=await page.evaluate(()=>{const h=window.__hohenfeuer,p=h.state.castles[0].plot;return{tick:h.state.tick,hp:p.hp[41+p.width*20+p.width*p.depth*7],gold:h.state.castles[0].gold,work:h.battleHud.work,texts:h.hud.frame.texts};});
   report.repairSamples.push(data);
   if(data.hp>before.hp&&data.hp<40){mid=data;await page.screenshot({path:`${dir}/actual-repair-progress.png`});break;}
 }
 assert.ok(mid,'repair health visibly increases');assert.ok(mid.work.some(w=>w.kind==='repair'&&w.active));
 await page.evaluate(()=>{const h=window.__hohenfeuer;h.stepTo(h.state.tick+300);});
 const after=await page.evaluate(()=>{const h=window.__hohenfeuer,p=h.state.castles[0].plot;return{tick:h.state.tick,hp:p.hp[41+p.width*20+p.width*p.depth*7],gold:h.state.castles[0].gold};});
 assert.equal(after.hp,40);report.repair={before,mid,after,materialCost:(40-before.hp)/40*4*.8};
 report.checks.push('visible-paid-repair-completes');await page.screenshot({path:`${dir}/actual-repair-after.png`});
 await page.goto(`${url}index.html?golden=1&profile=0&lang=en`);await page.waitForFunction(()=>window.__hohenfeuer?.ready);
 await page.evaluate(()=>window.__hohenfeuer.setPose({script:'tb1',until:355,followCam:true}));
 const impact=await page.evaluate(()=>{const h=window.__hohenfeuer;return {tick:h.state.tick,feedback:h.battleHud.impactFeedback,ref:h.feedback.reference(h.state.rulers[0].manning),texts:h.hud.frame.texts};});
 assert.match(impact.feedback,/Wall hit|Palace damaged/);assert.match(impact.feedback,/short|long|on mark/);
 await page.screenshot({path:`${dir}/actual-impact.png`});report.impact=impact;
 await page.evaluate(()=>window.__hohenfeuer.stepTo(415));
 assert.equal(await page.evaluate(()=>window.__hohenfeuer.battleHud.impactFeedback),null);
 assert.ok(await page.evaluate(()=>window.__hohenfeuer.battleHud.aimReference));
 report.checks.push('actual-shot-offset-expires-reference-retained');
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.error=String(e.stack??e);process.exitCode=1;}
finally{await browser?.close();await server?.close();writeFileSync(`${dir}/actions.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
