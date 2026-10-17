// Owns counterbalanced classic/modern frame timing on the same paused scene and geometry, SwiftShader only.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {cpus,loadavg} from 'node:os';
import {launch,startServer,webglRenderer} from './lib.mjs';
await mkdir('assets-ripped/look-loop/modern',{recursive:true});
const poses=JSON.parse(await readFile('tests/goldens/poses.json','utf8'));
const names=['rampart-north','weapon-view-cannon','courtyard-palace','impact-dust'];
const {server,url}=await startServer();await server.watcher.close();const browser=await launch();
const report={renderer:null,cpu:cpus()[0].model,logicalCpus:cpus().length,loadStart:loadavg(),method:'ABBA batches, 5 warm frames then 15 readback-completed frames per batch; 30 samples per style and pose; same paused scene',poses:{},errors:[]};
try {
  for(const name of names) {
    const pose=poses[name], page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:1});page.setDefaultTimeout(120000);
    page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    await page.goto(new URL(pose.page,url).href);await page.waitForFunction(()=>window.__hohenfeuer?.ready);
    report.renderer??=await webglRenderer(page);assert.match(report.renderer,/SwiftShader/);
    await page.evaluate(p=>window.__hohenfeuer.setPose(p),pose);
    report.poses[name]=await page.evaluate(()=>{
      const h=window.__hohenfeuer, results={classic:{samples:[]},modern:{samples:[]}};
      const geometries=h.chunks.group.children.map(m=>m.geometry);
      for(const style of ['classic','modern','modern','classic']) {
        h.setStyle(style);h.timeFrames(5);
        const result=results[style];
        for(let i=0;i<15;i++)result.samples.push(h.timeFrames(1).avgMs);
        Object.assign(result,h.info());
      }
      for(const r of Object.values(results)) {
        r.samples.sort((a,b)=>a-b);r.medianMs=(r.samples[14]+r.samples[15])/2;r.minMs=r.samples[0];r.maxMs=r.samples[29];
      }
      results.geometryUnchanged=h.chunks.group.children.every((m,i)=>m.geometry===geometries[i]);return results;
    });
    assert.ok(report.poses[name].geometryUnchanged);
    for(const style of ['classic','modern']) {const p=report.poses[name][style];assert.ok(p.calls<=250&&p.triangles<=300000&&!p.gpuExtras);}
    console.log(name,JSON.stringify(report.poses[name]));await page.close();
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
} catch(e){report.status='failed';report.failure=e.stack;console.error(e);process.exitCode=1;}
finally{report.loadEnd=loadavg();await writeFile('assets-ripped/look-loop/modern/performance.json',JSON.stringify(report,null,2)+'\n');await writeFile('tests/evidence/14-modern-performance.json',JSON.stringify(report,null,2)+'\n');await browser.close();await server.close();}
