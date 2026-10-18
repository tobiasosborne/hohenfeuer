// owns: one extra paid ballista out-of-bounds shot, illustrating the missing readout without altering the scored 60 shots.
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {startServer,launch,webglRenderer} from '../tests/lib.mjs';
const dir='tests/evidence/critique-v3',report={errors:[]};let browser,server;
try{let url;({server,url}=await startServer());browser=await launch();const page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:1});page.setDefaultTimeout(180000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`${url}index.html?golden=1&profile=10&lang=en&seed=13`);await page.waitForFunction(()=>window.__hohenfeuer?.ready);report.renderer=await webglRenderer(page);assert.match(report.renderer,/SwiftShader/);await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});
 report.shot=await page.evaluate(async()=>{const h=window.__hohenfeuer,C=await import('/src/contracts.js');h.setBuild({mode:'none'});const cell=[40,7,26],support=[40,6,26],i=40+48*26+2304*6;
  h.issue({type:C.CMD.DEMOLISH,cell:support});h.stepTo(1);for(let t=0;t<120&&h.state.castles[0].plot.type[i];t++)h.stepTo(h.state.tick+30);
  h.issue({type:C.CMD.DESIGNATE,cell:support,block:C.BLOCK.MOUNT,facing:0});h.stepTo(h.state.tick+1);for(let t=0;t<120&&h.state.castles[0].plot.type[i]!==C.BLOCK.MOUNT;t++)h.stepTo(h.state.tick+30);
  h.issue({type:C.CMD.DESIGNATE_WEAPON,cell,weapon:'ballista',facing:1});h.stepTo(h.state.tick+1);for(let t=0;t<120&&!h.state.weapons.some(w=>w.defId==='ballista');t++)h.stepTo(h.state.tick+30);
  const w=h.state.weapons.find(w=>w.defId==='ballista');if(!w)throw Error('No paid ballista');const muzzleCell=[41,7,26],muzzleIndex=41+48*26+2304*7;h.issue({type:C.CMD.DEMOLISH,cell:muzzleCell});h.stepTo(h.state.tick+1);for(let t=0;t<120&&h.state.castles[0].plot.type[muzzleIndex];t++)h.stepTo(h.state.tick+30);h.issue({type:C.CMD.ORDER_CREW,weaponId:w.id,on:1});h.stepTo(h.state.tick+1);for(let t=0;t<120&&h.state.weapons.find(g=>g.id===w.id).crewPresent<2;t++)h.stepTo(h.state.tick+30);
  h.issue({type:C.CMD.AIM,weaponId:w.id,az:900,range:2550});h.issue({type:C.CMD.FIRE,weaponId:w.id});h.stepTo(h.state.tick+1);const fired=h.state.tick,ref=h.feedback.reference(w.id);if(!ref)throw Error('No paid shot');
  for(let t=0;t<100&&h.state.projectiles.some(p=>p.id===ref.projectileId);t++)h.stepTo(h.state.tick+10);h.chunks.flush();h.frame();return{fired,tick:h.state.tick,wind:h.state.wind.speed,reference:h.feedback.reference(w.id),stillFlying:h.state.projectiles.some(p=>p.id===ref.projectileId),impact:h.feedback.impact(w.id,h.state.tick),hud:h.battleHud.impactFeedback,texts:h.hud.frame.texts};
 });
 await page.screenshot({path:`${dir}/shots/ballista-long-miss.png`});report.status='completed';
}catch(e){report.status='failed';report.error=String(e.stack??e);process.exitCode=1;}
finally{await browser?.close();await server?.close();writeFileSync(`${dir}/long-miss.json`,JSON.stringify(report,null,2));console.log(report.status,report.error??'',report.shot);}
