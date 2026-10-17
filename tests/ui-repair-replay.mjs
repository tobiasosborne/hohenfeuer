// owns: actual novice seed-6 danger/loss replay and 1024x768 SwiftShader evidence for repair wave 2.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {registerCoreSim} from '../src/plugins/index.sim.js';
import {createSim} from '../src/sim/sim.js';
import {freezeRegistries,EV,getWeapon} from '../src/contracts.js';
import {createPolicy} from '../scripts/novice.mjs';
import {tb1Slots} from '../src/tb1-script.js';
import {createBattleFeedback,lossAccount} from '../src/ui/battle-feedback.js';
import {launch,startServer,webglRenderer} from './lib.mjs';
const dir='tests/evidence/repair-wave-2-ui';
registerCoreSim();freezeRegistries();
let api;const sim=createSim({map:'forest-duel',seed:6,slots:tb1Slots(5),hooks:{onReady(a){api=a;}}});
const policy=createPolicy(sim.state,'novice'),feedback=createBattleFeedback(0),trace=[],threats=[];
for(let tick=0;tick<20*60*30&&!api.state.outcome;tick++){
  const state=api.state,commands=policy.next(state,tick%30===0?policy.options(state):null);
  trace.push(...commands);sim.tick(commands);const events=sim.drainEvents();policy.observe(api.state,events);
  feedback.ingest(events,api.state);
  for(const event of events)if(event.type===EV.RULER_THREAT&&event.payload.castle===0)threats.push({tick:api.state.tick,...event.payload});
}
const end=sim.state;
const account=lossAccount(end,0,feedback,{lang:'en',nameOf:()=> 'Kunibert',weaponName:(id,defId)=>getWeapon(defId)?.name.en});
const report={seed:6,level:5,tick:end.tick,outcome:end.outcome,reason:end.castles[0].reason,hash:sim.hash(),threats,account,captures:[],errors:[]};
writeFileSync(`${dir}/replay-commands.json`,JSON.stringify(trace));
writeFileSync(`${dir}/replay.json`,JSON.stringify(report,null,2));
let browser,server;
try{
 let url;({server,url}=await startServer());browser=await launch();
 const page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:1});page.setDefaultTimeout(180000);
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`${url}index.html?golden=1&profile=0&seed=6&lang=en`);await page.waitForFunction(()=>window.__hohenfeuer?.ready);
 report.renderer=await webglRenderer(page);assert.match(report.renderer,/SwiftShader/);
 const incoming=threats.find(t=>t.projectileId===feedback.death?.projectileId)??threats[0];
 const times=incoming?[['actual-danger',incoming.tick+1],['actual-loss',end.tick]]:[['actual-loss',end.tick]];
 for(const [name,until]of times){
  const start=await page.evaluate(()=>window.__hohenfeuer.state.tick);
  const commands=trace.filter(c=>c.tick>=start&&c.tick<until);
  await page.evaluate(({commands,until})=>window.__hohenfeuer.replayCommands(commands,until),{commands,until});
  const data=await page.evaluate(()=>{const h=window.__hohenfeuer;return{tick:h.state.tick,hash:h.sim.hash(),danger:h.battleHud.danger,texts:h.hud.frame.texts,account:h.menu?.result.account,reason:h.state.castles[0].reason};});
  report.captures.push({name,...data});await page.screenshot({path:`${dir}/${name}.png`});
 }
 assert.equal(report.captures.at(-1).hash,report.hash,'browser and headless match hashes');
 if(end.castles[0].reason==='ruler'){
   assert.ok(incoming,'ruler death has a launch warning');assert.ok(report.captures[0].danger);
   assert.match(report.captures.at(-1).account.cause,/Kunibert.*Cannon/);
 }
 assert.deepEqual(report.errors,[]);
 // Enter rematches the same URL fixture (seed/profile) in one action.
 const restart=await page.evaluate(()=>window.__hohenfeuer.menu?.items[0].id);assert.equal(restart,'restart');
 await Promise.all([page.waitForEvent('load'),page.evaluate(()=>window.__hohenfeuer.menuKey('Enter'))]);
 await page.waitForFunction(()=>window.__hohenfeuer?.ready);assert.equal(await page.evaluate(()=>window.__hohenfeuer.state.seed),6);
 report.retry=true;
 await page.goto(`${url}index.html?golden=1&screen=skirmish&lang=en`);
 await page.waitForFunction(()=>window.__hohenfeuer?.ready&&window.__hohenfeuer.frontend);
 await page.evaluate(()=>{const h=window.__hohenfeuer,m=h.menu.maps.find(m=>m.slots.length>=3),s=h.menu.settings;s.map=m.id;s.slots=m.slots.map((_,i)=>({name:String(i+1),controller:i?'ai':'local',aiLevel:1,tactic:'general'}));h.menu.show('skirmish');h.key('Enter');});
 await page.waitForFunction(()=>window.__hohenfeuer?.ready&&!window.__hohenfeuer.frontend);
 const localLoss=await page.evaluate(()=>{const h=window.__hohenfeuer;h.issue({type:'surrender'});h.stepTo(2);return{outcome:h.state.outcome,screen:h.menu?.screen,account:h.menu?.result.account};});
 assert.equal(localLoss.outcome,null);assert.equal(localLoss.screen,'over');assert.match(localLoss.account.cause,/surrendered/);
 report.multicastleLocalLoss=localLoss;report.status='passed';
}catch(e){report.status='failed';report.error=String(e.stack??e);process.exitCode=1;}
finally{await browser?.close();await server?.close();writeFileSync(`${dir}/replay.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,threats:report.threats.length,captures:report.captures.map(c=>({name:c.name,tick:c.tick,danger:!!c.danger,reason:c.reason}))},null,2));}
