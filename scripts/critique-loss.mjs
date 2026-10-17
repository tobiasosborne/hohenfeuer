// owns: a real short novice ruler-loss replay and screenshots, without fabricated end-screen data.
import {writeFileSync} from 'node:fs';
import {runNovice} from './novice.mjs';
import {launch,startServer,webglRenderer} from '../tests/lib.mjs';
const dir='tests/evidence/critique-v2', replay=runNovice({seed:6,level:5,policy:'novice',trace:true});
writeFileSync(`${dir}/early-loss.json`,JSON.stringify(replay,null,2));
let browser,server;const report={captures:[]};
try{let url;({server,url}=await startServer());browser=await launch();
const page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:1});page.setDefaultTimeout(180000);
await page.goto(`${url}index.html?golden=1&play=1&profile=0&seed=6&lang=en`);
await page.waitForFunction(()=>window.__hohenfeuer?.ready);
report.renderer=await webglRenderer(page);
for(const [name,end] of [['novice-L5-seed6-before-death',Math.floor((replay.seconds-3)*30)],['novice-L5-seed6-loss',Math.ceil(replay.seconds*30)+1]]){
 const tick=await page.evaluate(()=>window.__hohenfeuer.state.tick),batch=replay.commandTrace.filter(c=>c.tick>=tick&&c.tick<end);
 await page.evaluate(({end,batch})=>{const h=window.__hohenfeuer;for(const c of batch){h.stepTo(c.tick);h.issue(c);}h.stepTo(end);h.chunks.flush();h.frame();},{end,batch});
 report.captures.push(await page.evaluate(name=>{const h=window.__hohenfeuer;return{name,tick:h.state.tick,hash:h.sim.hash(),outcome:h.state.outcome,reasons:h.state.castles.map(c=>c.reason),texts:h.hud.frame.texts,menu:h.menu?.screen};},name));
 await page.screenshot({path:`${dir}/shots/${name}.png`});
}
report.expectedHash=replay.hash;report.hashMatches=report.captures.at(-1).hash===replay.hash;report.status='passed';
}catch(e){report.status='failed';report.error=String(e.stack??e);process.exitCode=1;}
finally{await browser?.close();await server?.close();writeFileSync(`${dir}/shots/loss-manifest.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
