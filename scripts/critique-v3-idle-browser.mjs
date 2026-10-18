// owns: actual reticle diagnosis plus seven explicitly isolated saved-state idle fixtures, derived through the live sim and HUD.
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {startServer,launch,webglRenderer} from '../tests/lib.mjs';
const dir='tests/evidence/critique-v3',report={method:'Natural TB1 approach, then isolated save/restore fixtures; no HUD overrides. These are diagnostic fixtures, not outcome or strategy evidence.',cases:[],errors:[]};let browser,server;
try{let url;({server,url}=await startServer());browser=await launch();const page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:1});page.setDefaultTimeout(180000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`${url}index.html?golden=1&profile=10&lang=en`);await page.waitForFunction(()=>window.__hohenfeuer?.ready);report.renderer=await webglRenderer(page);assert.match(report.renderer,/SwiftShader/);await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});
 report.natural=await page.evaluate(()=>{const h=window.__hohenfeuer;h.setPose({script:'tb1',until:250});const r=h.state.rulers[0],w=h.state.weapons.find(w=>w.slot===0&&w.pos.x>100),dx=w.pos.x-r.pos.x,dz=w.pos.z-r.pos.z,dy=w.pos.y+.5-r.pos.y-1.6;h.setBuild({mode:'none'},{yaw:Math.atan2(dx,-dz),pitch:Math.atan2(dy,Math.hypot(dx,dz))});h.stepTo(251);window.idleSave=Array.from(h.sim.serialize());return{tick:h.state.tick,weapon:w,target:h.construction().target,prompt:h.battleHud.prompt};});
 await page.screenshot({path:`${dir}/shots/idle-natural.png`});
 const expected={'no-crew':'Missing crew','no-ammo':'No ammunition','no-gold':'Not enough gold',obstructed:'Firing lane blocked',damaged:'Gun damaged',reloading:null,ready:null};
 for(const reason of Object.keys(expected)){
  const row=await page.evaluate(async reason=>{const h=window.__hohenfeuer,C=await import('/src/contracts.js'),bytes=window.idleSave;let text='';for(let i=0;i<bytes.length;i+=2)text+=String.fromCharCode(bytes[i]|bytes[i+1]<<8);const saved=JSON.parse(text,(_k,v)=>v&&typeof v==='object'&&Object.keys(v).length===1&&Array.isArray(v.bytes)?new Uint8Array(v.bytes):v&&typeof v==='object'&&Object.keys(v).length===1&&Array.isArray(v.doubles)?new Float64Array(v.doubles):v),s=saved.state,w=s.weapons.find(w=>w.slot===0&&w.pos.x>100),r=s.rulers[0];
   s.slots[1].controller='local';s.pendingCommands=[];s.projectiles=[];r.manning=w.id;r.pos={x:w.pos.x-1,y:w.pos.y,z:w.pos.z};w.hp=36;w.ammo=2;w.reload=22;w.aim={az:900,range:1000};w.crewOrdered=false;s.castles[0].gold=1500;
   if(reason==='no-crew')r.manning=null;if(reason==='no-ammo')w.ammo=0;if(reason==='no-gold')s.castles[0].gold=0;if(reason==='reloading')w.reload=0;if(reason==='damaged')w.hp=0;
   if(reason==='obstructed'){const n=s.npcs.find(n=>(n.slot??n.castle)===0);n.pos={x:w.pos.x+1.5,y:w.pos.y,z:w.pos.z};n.path=[];n.target=null;}
   saved.state.tick=h.state.tick;h.sim._restore(saved);h.issue({type:C.CMD.MOVE,fwd:0,strafe:0,yaw:16384,pitch:0,sprint:0,jump:0});h.stepTo(s.tick+1);
   const rw=h.state.weapons.find(g=>g.id===w.id),rr=h.state.rulers[0],dx=rw.pos.x-rr.pos.x,dz=rw.pos.z-rr.pos.z,dy=rw.pos.y+.5-rr.pos.y-1.6;
   h.setBuild({mode:'none'},{yaw:Math.atan2(dx,-dz),pitch:Math.atan2(dy,Math.hypot(dx,dz))});h.chunks.flush();h.frame();
   return{requested:reason,actual:rw.idleReason,detail:rw.idleDetail,mode:h.mode,manning:rr.manning,target:h.construction().target,prompt:h.battleHud.prompt,guidance:h.battleHud.guidance,texts:h.hud.frame.texts};
  },reason);
  row.reasonMatches=row.actual===reason;row.hudMatches=expected[reason]===null?!row.prompt?.text?.includes('Wait for reload'):!!row.prompt?.text?.includes(expected[reason]);report.cases.push(row);await page.screenshot({path:`${dir}/shots/idle-live-${reason}.png`});console.log(reason,row.actual,row.prompt?.text,row.hudMatches);
 }
 assert.deepEqual(report.errors,[]);report.status='completed';
}catch(e){report.status='failed';report.error=String(e.stack??e);process.exitCode=1;}
finally{await browser?.close();await server?.close();writeFileSync(`${dir}/idle-browser.json`,JSON.stringify(report,null,2));console.log(report.status,report.error??'');}
