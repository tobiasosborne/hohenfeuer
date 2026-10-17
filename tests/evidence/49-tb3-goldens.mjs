// tests/evidence/49-tb3-goldens.mjs - owns exact two-run golden stability and explicitly selected baseline updates.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { PNG } from 'pngjs';
import { launch, startServer, webglRenderer } from '../lib.mjs';
const poses=JSON.parse(await readFile('tests/goldens/poses.json','utf8'));
const updates=new Set((process.argv.find(a=>a.startsWith('--update='))??'').slice(9).split(',').filter(Boolean));
const results=[], changed=[];
await mkdir('test-results',{recursive:true});
const { server,url }=await startServer(),browser=await launch();
function diff(a,b){
  const p=PNG.sync.read(a),q=PNG.sync.read(b);assert.equal(p.width,q.width);assert.equal(p.height,q.height);
  let n=0;for(let i=0;i<p.data.length;i+=4)if(p.data[i]!==q.data[i]||p.data[i+1]!==q.data[i+1]||p.data[i+2]!==q.data[i+2]||p.data[i+3]!==q.data[i+3])n++;
  return n;
}
try{
  for(const [name,pose]of Object.entries(poses)){
    const captures=[];
    for(let run=0;run<2;run++){
      const page=await browser.newPage({viewport:{width:pose.width,height:pose.height},deviceScaleFactor:1});
      page.setDefaultTimeout(120000);
      const errors=[];page.on('pageerror',e=>errors.push(String(e)));
      await page.goto(new URL(pose.page??'index.html?golden=1',url).href);
      await page.waitForFunction(()=>window.__hohenfeuer?.ready);
      assert.match(await webglRenderer(page),/SwiftShader/);
      await page.evaluate(p=>window.__hohenfeuer.setPose(p),pose);
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      captures.push(await page.screenshot());assert.deepEqual(errors,[]);await page.close();
    }
    const repeatPx=diff(...captures);assert.equal(repeatPx,0,`${name}: two-run pixel drift`);
    const path=`tests/goldens/${name}.png`,baselinePx=existsSync(path)?diff(await readFile(path),captures[0]):null;
    if(baselinePx===null||updates.has(name)){
      await writeFile(path,captures[0]);changed.push(name);
    }else if(baselinePx!==0){
      await writeFile(`test-results/${name}.tb3-actual.png`,captures[0]);
      throw new Error(`${name}: ${baselinePx} baseline pixels differ; inspect before --update=${name}`);
    }
    results.push({name,repeatPx,baselinePx,updated:changed.includes(name)});console.log(JSON.stringify(results.at(-1)));
  }
  await writeFile('tests/evidence/49-tb3-goldens.json',JSON.stringify({results,changed},null,2));
  console.log(`Changed baselines: ${changed.join(', ')||'none'}`);
}finally{await browser.close();await server.close();}
