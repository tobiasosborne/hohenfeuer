// owns: actual 1024x768 SwiftShader match timelines and onboarding screenshots for critique v2.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { launch,startServer,webglRenderer } from '../tests/lib.mjs';
const dir='tests/evidence/critique-v2/shots', report={captures:[],errors:[],method:'golden clock; menu-configured AI5 vs AI5 and profile0 local vs AI2; actual outcomes'};
const promptsOnly=process.argv.includes('--prompts'),manifest=promptsOnly?'prompts-manifest.json':'manifest.json';
await mkdir(dir,{recursive:true});let browser,server;
async function boot(url,ai){
  const page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:1});page.setDefaultTimeout(180000);
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${url}index.html?golden=1&screen=skirmish&seed=1&lang=en&profile=${ai?10:0}`);
  await page.waitForFunction(()=>window.__hohenfeuer?.frontend&&window.__hohenfeuer.ready);
  await page.evaluate(ai=>{
    const h=window.__hohenfeuer;
    const focus=id=>{for(let i=0;i<80&&h.menu.focusId!==id;i++)h.key('ArrowDown');if(h.menu.focusId!==id)throw Error(id);};
    focus('map');for(let i=0;i<100&&h.menu.settings.map!=='forest-duel';i++)h.key('ArrowRight');
    if(h.menu.settings.map!=='forest-duel')throw Error('Forest map selection failed');
    if(ai){focus('slot0.ctrl');for(let i=0;i<5;i++)h.key('ArrowRight');}
    else{focus('slot1.ctrl');for(let i=0;i<3;i++)h.key('ArrowLeft');}
    focus('start');h.key('Enter');
  },ai);
  await page.waitForFunction(()=>window.__hohenfeuer?.ready&&window.__hohenfeuer.state);
  report.renderer??=await webglRenderer(page);if(!/SwiftShader/i.test(report.renderer))throw Error('Not SwiftShader');
  const slots=await page.evaluate(()=>window.__hohenfeuer.state.slots);
  const mapId=await page.evaluate(()=>window.__hohenfeuer.state.mapId);if(mapId!=='forest-duel')throw Error(mapId);
  report[ai?'aiSlots':'match1Slots']=slots;
  return page;
}
async function shot(page,name,extra={}){
  await page.evaluate(()=>{const h=window.__hohenfeuer;h.chunks.flush();h.frame();});
  const data=await page.evaluate(()=>{const h=window.__hohenfeuer;return {tick:h.state.tick,hash:h.sim.hash(),mode:h.mode,profile:h.profile,features:h.features,onboarding:h.onboarding,texts:h.hud.frame.texts,
    mapId:h.state.mapId,ruler:h.state.rulers[0],castles:h.state.castles.map(c=>({gold:c.gold,population:c.population,morale:c.morale,palace:c.palaceIntegrity,threshold:c.palaceDefeatThreshold,reason:c.reason})),outcome:h.state.outcome,menu:h.menu?.screen};});
  await page.screenshot({path:`${dir}/${name}.png`});report.captures.push({name,...data,...extra});
  await writeFile(`${dir}/${manifest}`,JSON.stringify(report,null,2));console.log(name,data.tick,data.outcome);
}
async function advance(page,target,commands=[]){
  let tick=await page.evaluate(()=>window.__hohenfeuer.state.tick);
  while(tick<target){
    const end=Math.min(tick+300,target),batch=commands.filter(c=>c.tick>=tick&&c.tick<end);
    const r=await page.evaluate(({end,batch})=>{const h=window.__hohenfeuer;
      for(const c of batch){h.stepTo(c.tick);h.issue(c);}
      h.stepTo(end);return {tick:h.state.tick,over:!!h.state.outcome};},{end,batch});
    tick=r.tick;if(r.over)break;
  }
}
try{
  let url;({server,url}=await startServer());browser=await launch();
  if(!promptsOnly){const ai=await boot(url,true);
  for(const minute of [0,2,5,10]){await advance(ai,minute*1800);await shot(ai,`ai-m${String(minute).padStart(2,'0')}`);}
  await advance(ai,36000);await shot(ai,'ai-end');await ai.close();
  const replay=JSON.parse(await readFile('tests/evidence/critique-v2/replay-match1.json','utf8')).matches[0];
  const page=await boot(url,false);
  for(const minute of [0,2,5,10]){await advance(page,minute*1800,replay.commandTrace);await shot(page,`match1-m${String(minute).padStart(2,'0')}`);if(await page.evaluate(()=>!!window.__hohenfeuer.state.outcome))break;}
  await advance(page,36000,replay.commandTrace);await shot(page,'match1-end',{headlessExpectedHash:replay.hash});await page.close();}
  // Supplementary actual input-path prompts; no outcome/health fixture injection.
  const prompt=await boot(url,false);await prompt.evaluate(()=>{
    const h=window.__hohenfeuer;h.runScript('tb1');
    for(let i=0;i<1000&&h.script().phase==='walk';i++)h.stepTo(h.state.tick+1);
    const r=h.state.rulers[0],w=h.state.weapons.filter(w=>w.slot===0)[1],dx=w.pos.x-r.pos.x,dz=w.pos.z-r.pos.z,dy=w.pos.y+.5-r.pos.y-1.6;
    h.setBuild({mode:'none'},{yaw:Math.atan2(dx,-dz),pitch:Math.atan2(dy,Math.hypot(dx,dz))});
  });await shot(prompt,'match1-man-prompt');
  await prompt.keyboard.press('KeyE');await prompt.evaluate(()=>{window.__hohenfeuer.playerStep();window.__hohenfeuer.playerStep();});await shot(prompt,'match1-fire-prompt');
  await prompt.evaluate(()=>{const h=window.__hohenfeuer;h.issue({type:'aim',weaponId:h.state.rulers[0].manning,az:900,range:1000});h.stepTo(h.state.tick+1);});
  await prompt.keyboard.press('Space');await prompt.evaluate(()=>{const h=window.__hohenfeuer;h.playerStep();h.stepTo(h.state.tick+95);});
  await prompt.keyboard.down('End');await prompt.evaluate(()=>{window.__hohenfeuer.playerStep();});await shot(prompt,'match1-impact');await prompt.keyboard.up('End');
  await prompt.evaluate(()=>{const h=window.__hohenfeuer;h.playerStep();});await shot(prompt,'match1-distant-hit');
  await prompt.close();report.status='passed';
}catch(e){report.status='failed';report.errors.push(String(e.stack??e));process.exitCode=1;}
finally{await browser?.close();await server?.close();await writeFile(`${dir}/${manifest}`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,errors:report.errors}));}
