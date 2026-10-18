// owns: wind-on 60-shot browser readout audit and real idle-state comparisons at 1024x768 on SwiftShader.
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {startServer,launch,webglRenderer} from '../tests/lib.mjs';
const dir='tests/evidence/critique-v3',report=process.argv.includes('--resume')?JSON.parse(readFileSync('tests/evidence/critique-v3/impact-browser.json')):{shots:[],idle:[],errors:[]};delete report.status;delete report.error;mkdirSync(`${dir}/shots`,{recursive:true});
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
    let w=idle(),guard=0;while((w.reload<C.getWeapon(kind).reloadS||w.crewPresent<Math.ceil(.6*C.getWeapon(kind).crewSlots)||w.ammo<1||h.state.castles[0].gold<C.getWeapon(kind).fireCost)&&guard++<150){h.stepTo(h.state.tick+30);w=idle();}
    if(guard>=150)throw Error('Cannot load '+kind+' '+w.idleReason);
    // Five eastward bearings (85 to 95 degrees); ordinary paid shots, wind stays on.
    const az=[900,850,950,880,920][n%5],charge=kind==='cannon'?1000+(n%4-1)*40:kind==='catapult'?700+(n%4)*80:850+(n%4)*60;
    h.issue({type:C.CMD.AIM,weaponId:id,az,range:charge});h.issue({type:C.CMD.FIRE,weaponId:id});h.stepTo(h.state.tick+1);
    const fired=h.state.tick,ref=h.feedback.reference(id);if(!ref||ref.tick!==fired)throw Error('No new shot '+kind);
    // Change aim during flight: offsets must continue using the captured launch reference.
    h.issue({type:C.CMD.AIM,weaponId:id,az:(az+200)%3600,range:charge+20});h.stepTo(h.state.tick+1);
    let impact=null;for(let t=0;t<100&&!impact;t++){h.stepTo(h.state.tick+10);impact=h.feedback.impact(id,h.state.tick);}
    if(!impact)return{kind,n,fired,tick:h.state.tick,wind:h.state.wind.speed,origin:ref.origin,aimPoint:ref.aimPoint,capturedAim:ref.aim,currentAim:h.state.weapons.find(w=>w.id===id).aim,projectileId:ref.projectileId,stillFlying:h.state.projectiles.some(p=>p.id===ref.projectileId),expected:null,actual:null,pass:null,text:null,hud:h.battleHud.impactFeedback,missingImpact:true};
    const o=impact.origin,a=impact.aimPoint,p=impact.impact,theta=Math.atan2(a[0]-o[0],-(a[2]-o[2]));
    const along=(p[0]-a[0])*Math.sin(theta)-(p[2]-a[2])*Math.cos(theta),right=(p[0]-a[0])*Math.cos(theta)+(p[2]-a[2])*Math.sin(theta);
    const expected={range:Math.round(along),lateral:Math.round(right)},actual=impact.offset;
    h.chunks.flush();h.frame();idle();
    return {kind,n,fired,tick:h.state.tick,wind:h.state.wind.speed,origin:o,aimPoint:a,impact:p,capturedAim:impact.aim,currentAim:h.state.weapons.find(w=>w.id===id).aim,expected,actual,pass:expected.range===actual.range&&expected.lateral===actual.lateral,text:impactText(impact,'en'),hud:h.battleHud.impactFeedback};
   },{kind,n,id:setup.id});
   report.shots.push(row);if(!row.missingImpact)assert.ok(row.pass);assert.ok(row.wind>0);if(n===0||n===19)await page.screenshot({path:`${dir}/shots/impact-${kind}-${n+1}.png`});
   writeFileSync(`${dir}/impact-browser.json`,JSON.stringify(report,null,2));console.log(kind,n+1,row.text);
  }
  report.idle.push(...await page.evaluate(()=>window.auditIdle));await page.close();
 }
 assert.equal(report.shots.length,60);assert.deepEqual(report.errors,[]);report.missing=report.shots.filter(s=>s.missingImpact).length;report.signMatches=report.shots.filter(s=>s.pass).length;report.status=report.missing?'completed-with-missing-readouts':'passed';
}catch(e){report.status='failed';report.error=String(e.stack??e);process.exitCode=1;}
finally{await browser?.close();await server?.close();writeFileSync(`${dir}/impact-browser.json`,JSON.stringify(report,null,2));console.log(report.status,report.error??'');}
