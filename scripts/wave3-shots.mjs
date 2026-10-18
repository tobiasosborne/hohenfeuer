// owns: wind-on 60-shot browser readout audit and real idle-state comparisons at 1024x768 on SwiftShader.
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {startServer,launch,webglRenderer} from '../tests/lib.mjs';
const dir=process.env.WAVE3_OUT??'tests/evidence/repair-wave-3-ui',report=process.argv.includes('--resume')?JSON.parse(readFileSync(`${dir}/impact-browser.json`)):{shots:[],idle:[],errors:[]};delete report.status;delete report.error;mkdirSync(`${dir}/shots`,{recursive:true});
let browser,server;
try{let url;({server,url}=await startServer());browser=await launch();
 for(const kind of ['cannon','catapult','ballista']){
  if(report.shots.filter(s=>s.kind===kind).length===20)continue;
  const page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:1});page.setDefaultTimeout(180000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${url}index.html?golden=1&screen=skirmish&profile=10&lang=en&seed=13`);await page.waitForFunction(()=>window.__hohenfeuer?.ready&&window.__hohenfeuer.frontend);
  await page.evaluate(()=>{const h=window.__hohenfeuer,s=h.menu.settings;s.map='forest-duel';s.seed=13;s.windStrength=2;s.windChange=2;s.slots=[{name:'West',controller:'local',aiLevel:5,tactic:'general'},{name:'East',controller:'local',aiLevel:5,tactic:'general'}];h.menu.show('skirmish');h.key('Enter');});
  await page.waitForFunction(()=>window.__hohenfeuer?.ready&&!window.__hohenfeuer.frontend);report.renderer??=await webglRenderer(page);assert.match(report.renderer,/SwiftShader/);await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  const setup=await page.evaluate(async kind=>{
   const h=window.__hohenfeuer,C=await import('/src/contracts.js'),{canDesignate}=await import('/src/npc/index.js');
   window.auditC=C;window.auditIdle=[];
   h.setBuild({mode:'none'});h.stepTo(2);
   if(kind==='cannon')return {id:h.state.weapons.find(w=>w.slot===0&&w.pos.x>100).id,built:false};
   const c=h.state.castles[0],def=C.getWeapon(kind),candidates=[];
   if(kind==='ballista'){
    const cell=[40,7,26];
    const support=[cell[0],cell[1]-1,cell[2]],idx=support[0]+48*support[2]+2304*support[1];
    h.issue({type:C.CMD.DEMOLISH,cell:support});h.stepTo(h.state.tick+1);
    for(let t=0;t<120&&h.state.castles[0].plot.type[idx]!==0;t++)h.stepTo(h.state.tick+30);
    h.issue({type:C.CMD.DESIGNATE,cell:support,block:C.BLOCK.MOUNT,facing:0});h.stepTo(h.state.tick+1);
    for(let t=0;t<120&&h.state.castles[0].plot.type[idx]!==C.BLOCK.MOUNT;t++)h.stepTo(h.state.tick+30);candidates.push(cell);
   }else for(let x=29;x<=35;x++)for(let z=27;z>=24;z--)candidates.push([x,1,z]);
   const cell=candidates.find(cell=>canDesignate(h.state.castles[0],{type:C.CMD.DESIGNATE_WEAPON,weapon:kind,cell},h.state));
   if(!cell)throw Error('No paid placement '+kind);
   const before=h.state.castles[0].gold;h.issue({type:C.CMD.DESIGNATE_WEAPON,weapon:kind,cell,facing:1});h.stepTo(h.state.tick+2);
   for(let t=0;t<120&&!h.state.weapons.some(w=>w.slot===0&&w.defId===kind&&w.hp>0);t++)h.stepTo(h.state.tick+30);
   const w=h.state.weapons.find(w=>w.slot===0&&w.defId===kind&&w.hp>0);if(!w)throw Error('Construction failed '+kind);
   return {id:w.id,built:true,cell,goldBefore:before,goldAfter:h.state.castles[0].gold};
  },kind);
  report[kind]={setup,setups:[...(report[kind]?.setups??(report[kind]?.setup?[report[kind].setup]:[])),setup]};
  for(let n=report.shots.filter(s=>s.kind===kind).length;n<20;n++){
   const row=await page.evaluate(async ({kind,n,id})=>{
    const h=window.__hohenfeuer,C=window.auditC,{idleDiagnosis,impactText}=await import('/src/ui/battle-feedback.js');
    const idle=()=>{const w=h.state.weapons.find(w=>w.id===id);window.auditIdle.push({tick:h.state.tick,kind,reason:w.idleReason,detail:w.idleDetail,diagnosis:idleDiagnosis(w,{lang:'en',features:h.features,manned:false,distance:2})});return w;};
    idle();h.issue({type:C.CMD.ORDER_CREW,weaponId:id,on:1});h.stepTo(h.state.tick+1);
    let w=idle(),startTick=h.state.tick;const ready=s=>{const w=s.weapons.find(w=>w.id===id);return w.reload>=C.getWeapon(kind).reloadS&&w.crewPresent>=Math.ceil(.6*C.getWeapon(kind).crewSlots)&&w.ammo>=1&&s.castles[0].gold>=C.getWeapon(kind).fireCost;};h.stepTo(startTick+4500,s=>(s.tick-startTick)%30===0&&ready(s));w=idle();if(!ready(h.state))throw Error('Cannot load '+kind+' '+w.idleReason);
    // Five eastward bearings (85 to 95 degrees); ordinary paid shots, wind stays on.
    const az=[900,850,950,880,920][n%5],charge=kind==='cannon'?1000+(n%4-1)*40:kind==='catapult'?700+(n%4)*80:850+(n%4)*60;
    h.issue({type:C.CMD.AIM,weaponId:id,az,range:charge});h.issue({type:C.CMD.FIRE,weaponId:id});h.stepTo(h.state.tick+1);
    const fired=h.state.tick,ref=h.feedback.reference(id);if(!ref||ref.tick!==fired)throw Error('No new shot '+kind);
    // Change aim during flight: offsets must continue using the captured launch reference.
    h.issue({type:C.CMD.AIM,weaponId:id,az:(az+200)%3600,range:charge+20});h.stepTo(h.state.tick+1);
    h.stepTo(h.state.tick+1100,s=>!!h.feedback.impact(id,s.tick));let impact=h.feedback.impact(id,h.state.tick),removedTick=null;
    if(!impact)return{kind,n,fired,tick:h.state.tick,wind:h.state.wind.speed,origin:ref.origin,aimPoint:ref.aimPoint,capturedAim:ref.aim,currentAim:h.state.weapons.find(w=>w.id===id).aim,projectileId:ref.projectileId,stillFlying:h.state.projectiles.some(p=>p.id===ref.projectileId),expected:null,actual:null,pass:null,text:null,hud:h.battleHud.impactFeedback,missingImpact:true};
    removedTick=impact.missingSince??impact.until-60;
    if(impact.kind==='lost'){h.chunks.flush();h.frame();return{kind,n,fired,tick:h.state.tick,removedTick,latencyTicks:h.state.tick-removedTick,wind:h.state.wind.speed,terminal:'lost',reason:impact.reason,hasLanding:!!impact.impact,hasOffset:!!impact.offset,reference:h.feedback.reference(id),capturedAim:impact.aim,currentAim:h.state.weapons.find(w=>w.id===id).aim,pass:!impact.impact&&!impact.offset,text:impactText(impact,'en'),hud:h.battleHud.impactFeedback};}
    const o=impact.origin,a=impact.aimPoint,p=impact.impact,theta=Math.atan2(a[0]-o[0],-(a[2]-o[2]));
    const along=(p[0]-a[0])*Math.sin(theta)-(p[2]-a[2])*Math.cos(theta),right=(p[0]-a[0])*Math.cos(theta)+(p[2]-a[2])*Math.sin(theta);
    const expected={range:Math.round(along),lateral:Math.round(right)},actual=impact.offset;
    h.chunks.flush();h.frame();idle();
    return {kind,n,fired,tick:h.state.tick,removedTick,latencyTicks:h.state.tick-removedTick,terminal:'impact',wind:h.state.wind.speed,origin:o,aimPoint:a,impact:p,capturedAim:impact.aim,currentAim:h.state.weapons.find(w=>w.id===id).aim,expected,actual,pass:expected.range===actual.range&&expected.lateral===actual.lateral,text:impactText(impact,'en'),hud:h.battleHud.impactFeedback};
   },{kind,n,id:setup.id});
   report.shots.push(row);if(!row.missingImpact)assert.ok(row.pass);assert.ok(row.wind>0);await page.screenshot({path:`${dir}/shots/impact-${kind}-${n+1}.png`});
   assert.ok(row.text,'Every shot captioned');assert.equal(row.hud,row.text);assert.ok(row.latencyTicks<=60);
   // Preserve the v3 sampling schedule, including its full wait for the seven lost shots.
   const baseline=JSON.parse(readFileSync('/home/tobias/Projects/castle-game/tests/evidence/critique-v3/impact-browser.json')).shots.find(s=>s.kind===kind&&s.n===n);
   row.previouslyMissing=!!baseline.missingImpact;await page.evaluate(t=>window.__hohenfeuer.stepTo(t),row.fired+baseline.tick-baseline.fired);
   writeFileSync(`${dir}/impact-browser.json`,JSON.stringify(report,null,2));console.log(kind,n+1,row.text);
  }
  report.idle.push(...await page.evaluate(()=>window.auditIdle));await page.close();
 }
 assert.equal(report.shots.length,60);assert.deepEqual(report.errors,[]);report.missing=report.shots.filter(s=>s.missingImpact).length;report.signMatches=report.shots.filter(s=>s.pass).length;report.replicatedMissing=report.shots.filter(s=>s.previouslyMissing).map(s=>({n:s.n,text:s.text,terminal:s.terminal}));assert.equal(report.replicatedMissing.length,7);assert.equal(report.missing,0);report.status='passed';
}catch(e){report.status='failed';report.error=String(e.stack??e);process.exitCode=1;}
finally{await browser?.close();await server?.close();writeFileSync(`${dir}/impact-browser.json`,JSON.stringify(report,null,2));console.log(report.status,report.error??'');}
