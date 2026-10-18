// owns: actual SwiftShader population warnings before the fatal shot, three progression profiles, and a winning account.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {startServer,launch,webglRenderer} from '../tests/lib.mjs';
const dir=process.env.WAVE3_OUT??'tests/evidence/repair-wave-3-ui',refs=JSON.parse(readFileSync(`${dir}/ending-reference.json`)),report={captures:[],errors:[]};mkdirSync(`${dir}/shots`,{recursive:true});let browser,server;
try {let url;({server,url}=await startServer());browser=await launch();
 for(const seed of [6,9,1]){
  const page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:1});page.setDefaultTimeout(300000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${url}index.html?golden=1&screen=skirmish&profile=10&lang=en`);await page.waitForFunction(()=>window.__hohenfeuer?.ready&&window.__hohenfeuer.frontend);
  await page.evaluate(seed=>{const h=window.__hohenfeuer,s=h.menu.settings;s.map='forest-duel';s.seed=seed;s.slots=[{name:'West',controller:'ai',aiLevel:5,tactic:'general'},{name:'East',controller:'ai',aiLevel:5,tactic:'general'}];h.menu.show('skirmish');h.key('Enter');},seed);
  await page.waitForFunction(()=>window.__hohenfeuer?.ready&&!window.__hohenfeuer.frontend);report.renderer??=await webglRenderer(page);assert.match(report.renderer,/SwiftShader/);await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  const ref=refs.find(r=>r.seed===seed),points=ref?[['before-shot',ref.terminal.lastShot-1],['last',ref.tick-1],['end',ref.tick]]:[['win',36000]];
  for(const [name,target] of points){let tick=await page.evaluate(()=>window.__hohenfeuer.state.tick);while(tick<target){tick=await page.evaluate(n=>window.__hohenfeuer.stepTo(n),Math.min(target,tick+1800));if(await page.evaluate(()=>!!window.__hohenfeuer.state.outcome))break;}
   for(const profile of name==='before-shot'||name==='last'?[0,3,10]:[10]){
    const row=await page.evaluate(async profile=>{const h=window.__hohenfeuer;h.setProfile(profile);h.chunks.flush();h.frame();
     const {hash}=await import('/src/core/hash.js'),bytes=h.sim.serialize(),saved=JSON.parse(new TextDecoder('utf-16le').decode(bytes),(_k,v)=>v&&typeof v==='object'&&Object.keys(v).length===1&&Array.isArray(v.bytes)?new Uint8Array(v.bytes):v&&typeof v==='object'&&Object.keys(v).length===1&&Array.isArray(v.doubles)?new Float64Array(v.doubles):v);
     const rawHash=hash(saved);if(rawHash!==h.sim.hash())throw Error('Serialization hash mismatch');
     // The sweep gives slots colour 0; the frontend supplies its palette. Match only this metadata in a copy.
     saved.state.slots.forEach(s=>{s.color=0;});const sweepHash=hash(saved);
     return {tick:h.state.tick,hash:rawHash,sweepHash,profile,castles:h.state.castles.map(c=>({population:c.population,surrender:c.surrender,reason:c.reason,palace:c.palaceIntegrity})),populationWarning:h.battleHud.populationWarning,pressure:h.battleHud.pressure,texts:h.hud.frame.texts,outcome:h.state.outcome,result:h.menu?.result};},profile);
    if(name==='before-shot'||name==='last'){assert.equal(row.tick,target);assert.equal(row.outcome,null);assert.match(row.populationWarning,/Population (16|14), surrender below 14/);assert.ok(row.texts.includes(row.populationWarning));if(profile===0)assert.equal(row.pressure,null);}
    else if(ref){assert.equal(row.sweepHash,ref.hash);assert.equal(row.castles[0].reason,'surrender');}
    else {assert.equal(row.result.won,true);assert.match(row.result.account.cause,/East.*palace|East.*ruler|East.*surrender/i);}
    const file=`seed${seed}-${name}-profile${profile}.png`;report.captures.push({seed,name,file,...row});await page.screenshot({path:`${dir}/shots/${file}`});writeFileSync(`${dir}/endings-browser.json`,JSON.stringify(report,null,2));console.log(file,row.tick,row.populationWarning??row.result?.account?.cause);
   }
  }
  await page.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.error=String(e.stack??e);process.exitCode=1;}
finally{await browser?.close();await server?.close();writeFileSync(`${dir}/endings-browser.json`,JSON.stringify(report,null,2));console.log(report.status,report.error??'');}
