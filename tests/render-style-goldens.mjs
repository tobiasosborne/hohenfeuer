// Owns exact two-run style goldens, SwiftShader budgets and reference-only modern comparison sheets.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {PNG} from 'pngjs';
import {launch,startServer,webglRenderer} from './lib.mjs';
import {TUNING} from '../src/tuning.js';
const update=process.argv.includes('--update-modern'), modernOnly=process.argv.includes('--modern-only'), paired=process.argv.includes('--paired');
const dest='assets-ripped/look-loop/modern';await mkdir(dest,{recursive:true});
const poses=JSON.parse(await readFile('tests/goldens/poses.json','utf8'));
const sourcePaths=(await readdir('src',{recursive:true})).filter(p=>p.endsWith('.js')).map(p=>`src/${p}`);
const assets=(await readdir('assets/kit-v1',{recursive:true})).filter(p=>/\.(png|glb|json)$/.test(p)).map(p=>`assets/kit-v1/${p}`);
const sha=async paths=>Object.fromEntries(await Promise.all(paths.sort().map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const sources=await sha([...sourcePaths,...assets,...(modernOnly?[]:['tests/goldens/poses.json'])]);
const selectedPoses=Object.fromEntries(Object.entries(poses).filter(([name])=>!modernOnly||name.startsWith('modern-')));
if(paired)for(const name of Object.keys(selectedPoses)){const base=name.replace(/^modern-/,'');selectedPoses[base]=poses[base];const a={...poses[name]},b={...poses[base]};delete a.page;delete b.page;assert.deepEqual(a,b,`${name}: same classic camera/tick`);}
const report={renderer:null,sources,poseDefinitions:selectedPoses,poses:{},errors:[],baselineMismatches:[]};
const pairs={'rampart-north':'049-cannon-default-aim.png','weapon-view-cannon':'049-cannon-default-aim.png','courtyard-palace':'074-forest-overview-south.png','impact-dust':'170-no-rebuild-first-strike.png'};
const {server,url}=await startServer();await server.watcher.close();const browser=await launch();
const decodedDiff=(a,b)=>{assert.equal(a.width,b.width);assert.equal(a.height,b.height);let n=0;for(let i=0;i<a.data.length;i+=4)if(a.data[i]!==b.data[i]||a.data[i+1]!==b.data[i+1]||a.data[i+2]!==b.data[i+2]||a.data[i+3]!==b.data[i+3])n++;return n;};
try {
  for(let run=1;run<=2;run++)for(const [name,pose] of Object.entries(poses)) {
    if(modernOnly && !name.startsWith('modern-'))continue;
    if(process.argv.includes('--pairs-only') && !pairs[name.replace(/^modern-/, '')])continue;
    const page=await browser.newPage({viewport:{width:pose.width,height:pose.height},deviceScaleFactor:1});page.setDefaultTimeout(120000);
    page.on('pageerror',e=>report.errors.push(`${name}: ${e.message}`));page.on('console',m=>{if(m.type()==='error')report.errors.push(`${name}: ${m.text()}`);});
    await page.goto(new URL(pose.page||'index.html',url).href);await page.waitForFunction(()=>window.__hohenfeuer?.ready===true);
    report.renderer??=await webglRenderer(page);assert.match(report.renderer,/SwiftShader/);
    await page.evaluate(p=>window.__hohenfeuer.setPose(p),pose);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const shot=await page.screenshot();const path=`tests/goldens/${name}.png`;
    if(run===1 && update && name.startsWith('modern-'))await writeFile(path,shot);
    assert.ok(existsSync(path),`${name}: missing baseline; --update-modern only creates modern goldens`);
    const diff=decodedDiff(PNG.sync.read(await readFile(path)),PNG.sync.read(shot));
    const entry=report.poses[name]??={};entry[`run${run}DiffPx`]=diff;
    if(diff){await writeFile(`test-results/${name}.modern-check.actual.png`,shot);report.baselineMismatches.push({run,name,diff});}
    if(run===2 && pairs[name.replace(/^modern-/, '')])assert.equal(decodedDiff(PNG.sync.read(await readFile(`${dest}/${name}.png`)),PNG.sync.read(shot)),0,`${name}: repeat determinism`);
    const base=name.replace(/^modern-/,'');
    if(pairs[base] && run===1) {
      await writeFile(`${dest}/${name}.png`,shot);
      if(!process.argv.includes('--no-perf')) {
      // Five warm frames followed by 21 synchronous completion/readback samples.
      await page.evaluate(()=>window.__hohenfeuer.timeFrames(5));
      entry.perf=await page.evaluate(()=>window.__hohenfeuer.timeFrames(21));
      assert.ok(entry.perf.calls<=TUNING.render.maxDrawCalls,`${name}: draw budget`);
      assert.ok(entry.perf.triangles<=TUNING.render.maxTris,`${name}: triangle budget`);
      assert.equal(entry.perf.gpuExtras,false);
      }
      entry.camera=await page.evaluate(()=>{const h=window.__hohenfeuer;return {position:h.camera.position.toArray(),rotation:h.camera.rotation.toArray(),tick:h.state?.tick??h.tick};});
    }
    console.log(`run ${run}: ${name}: ${diff} exact pixels${entry.perf?`; ${entry.perf.calls} calls; ${entry.perf.triangles} triangles; median ${entry.perf.medianMs.toFixed(2)} ms`:''}`);
    if(paired && name.startsWith('modern-')) {
      await page.evaluate(()=>window.__hohenfeuer.setStyle('classic'));
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const classic=await page.screenshot(), baseline=PNG.sync.read(await readFile(`tests/goldens/${base}.png`));
      const difference=decodedDiff(baseline,PNG.sync.read(classic));
      const ce=report.poses[base]??={};ce[`run${run}DiffPx`]=difference;
      if(difference)report.baselineMismatches.push({run,name:base,diff:difference});
      if(run===1)await writeFile(`${dest}/${base}.png`,classic);
      else {ce.repeatDiffPx=decodedDiff(PNG.sync.read(await readFile(`${dest}/${base}.png`)),PNG.sync.read(classic));assert.equal(ce.repeatDiffPx,0,`${base}: paired repeat determinism`);}
      console.log(`run ${run}: paired ${base}: ${difference} baseline pixels`);
    }
    await page.close();
  }
  assert.deepEqual(report.errors,[],'no shader/page errors');
  assert.deepEqual(await sha(Object.keys(sources)),sources,'source and assets unchanged during capture');
  const currentPoses=JSON.parse(await readFile('tests/goldens/poses.json','utf8'));
  for(const [name,pose] of Object.entries(selectedPoses))assert.deepEqual(currentPoses[name],pose,`${name}: pose unchanged during capture`);report.status=report.baselineMismatches.length?'baseline-drift':'passed';
} catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;console.error(e);}
finally{await writeFile(`${dest}/capture.json`,JSON.stringify(report,null,2)+'\n');await writeFile('tests/evidence/14-modern-goldens.json',JSON.stringify(report,null,2)+'\n');await browser.close();await server.close();}
if(report.status==='failed')process.exit(1);
if(report.baselineMismatches.length)process.exitCode=1;
// Image analysis executes trusted inline code only, never anything from assets-ripped.
const python=String.raw`
import json,sys,hashlib
from pathlib import Path
from PIL import Image,ImageFilter,ImageDraw
import numpy as np
o=json.loads(sys.stdin.read());root=Path(o['dest']);refs=Path('assets-ripped/goldens-original');result={'blur_radius_px':8,'poses':{}}
sheet=Image.new('RGB',(1536,4*414),(24,28,33));draw=ImageDraw.Draw(sheet)
for row,(name,ref) in enumerate(o['pairs'].items()):
    paths=[root/(name+'.png'),root/('modern-'+name+'.png'),refs/ref]
    ims=[Image.open(p).convert('RGB') for p in paths]
    assert all(im.size==(1024,768) for im in ims)
    blurred=[np.asarray(im.filter(ImageFilter.GaussianBlur(8)),dtype=np.float64) for im in ims]
    result['poses'][name]={'reference':ref,'reference_sha256':hashlib.sha256(paths[2].read_bytes()).hexdigest(),'classic':round(float(np.abs(blurred[0]-blurred[2]).mean()),3),'modern':round(float(np.abs(blurred[1]-blurred[2]).mean()),3)}
    for col,(im,label) in enumerate(zip(ims,['classic','modern','original'])):
        sheet.paste(im.resize((512,384)),(col*512,row*414+30));draw.text((col*512+8,row*414+8),label+' | '+(ref if col==2 else name),fill='white')
    single=Image.new('RGB',(3072,798),(24,28,33));d=ImageDraw.Draw(single)
    for col,(im,label) in enumerate(zip(ims,['classic','modern','original'])):
        single.paste(im,(col*1024,30));d.text((col*1024+12,8),label+' | '+name,fill='white')
    single.save(root/(name+'-sheet.png'))
result['mean_mae']={style:round(float(np.mean([v[style] for v in result['poses'].values()])),3) for style in ['classic','modern']}
(root/'metrics.json').write_text(json.dumps(result,indent=2)+'\n');sheet.save(root/'comparison-sheet.png');print(json.dumps(result,indent=2))
`;
const metric=spawnSync('python3',['-I','-c',python],{input:JSON.stringify({dest,pairs}),encoding:'utf8'});
if(metric.status)throw Error(metric.stderr);console.log(metric.stdout);
