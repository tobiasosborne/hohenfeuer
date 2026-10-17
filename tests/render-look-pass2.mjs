// Owns pass-2 fixed-pose captures, reference-only sheets and isolated Python blur/mask metrics.
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { launch, startServer, webglRenderer } from './lib.mjs';

const iteration = process.argv[2];
if (!/^\d+$/.test(iteration ?? '')) throw Error('Usage: node tests/render-look-pass2.mjs <iteration> [--archived]');
const root = 'assets-ripped/look-loop/pass2', dest = `${root}/iteration-${iteration}`;
const originals = 'assets-ripped/goldens-original';
const pairs = {
  'tb1-spawn': '119-forest-towers-close.png',
  'tb1-first-shot': '055-cannon-projectile.png',
  'rampart-north': '049-cannon-default-aim.png',
  'weapon-view-cannon': '049-cannon-default-aim.png',
  'courtyard-palace': '074-forest-overview-south.png',
  'crew-at-cannon': '119-forest-towers-close.png',
  'cannon-sight': '049-cannon-default-aim.png',
  'muzzle-flash': '054-cannon-muzzle-smoke.png',
  'smoke-trail': '055-cannon-projectile.png',
  'impact-dust': '170-no-rebuild-first-strike.png',
};
// Conservative manually marked reference stone, visually audited before material measurements.
// Fixed across iterations; unregistered current geometry may cross these coordinates.
const stoneRects = {
  'tb1-spawn': [[24,370,185,535]],
  'courtyard-palace': [[220,350,300,405],[325,380,365,430]],
  'crew-at-cannon': [[30,390,230,525]],
  'impact-dust': [[375,300,460,335]],
  'tb1-first-shot': [[600,480,638,530]],
  'muzzle-flash': [[600,480,638,530]],
  'smoke-trail': [[600,480,638,530]],
};
for (const name of Object.keys(pairs)) stoneRects[name] ??= [[24,490,160,540],[675,490,780,540]];
await mkdir(dest, {recursive:true});
if (!process.argv.includes('--archived')) {
  const poses = JSON.parse(await readFile('tests/goldens/poses.json','utf8'));
  // Supplemental lifetime evidence stays out of the fixed ten-pose aggregate.
  for (const [name,tick] of [['impact-settle',376],['impact-clear',451]]) poses[name] = {...poses['impact-dust'],until:tick};
  const sourcePaths = (await readdir('src',{recursive:true})).filter(p=>p.endsWith('.js')).sort();
  const hashFiles = async paths => Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
  const sourceSha256 = await hashFiles(sourcePaths.map(p=>`src/${p}`));
  const assetSha256 = await hashFiles(['assets/kit-v1/cannon.glb','assets/kit-v1/atlas.png']);
  const {server,url} = await startServer();
  await server.watcher.close();
  const browser = await launch(), capture = {renderer:null,sourceSha256,assetSha256,poses:{},errors:[]};
  try {
    for (const [name,pose] of Object.entries(poses)) {
      if (!pairs[name] && !name.startsWith('impact-')) continue;
      const page = await browser.newPage({viewport:{width:pose.width,height:pose.height},deviceScaleFactor:1});
      page.setDefaultTimeout(120000);
      page.on('pageerror',e=>capture.errors.push(`${name}: ${e.message}`));
      await page.goto(new URL(pose.page||'index.html',url).href);
      await page.waitForFunction(()=>window.__hohenfeuer?.ready===true);
      capture.renderer ??= await webglRenderer(page);
      await page.evaluate(p=>window.__hohenfeuer.setPose(p),pose);
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      await page.screenshot({path:`${dest}/${name}.png`});
      capture.poses[name] = await page.evaluate(()=>{const h=window.__hohenfeuer;return {...h.info?.(),camera:{pos:h.camera.position.toArray(),pitch:h.camera.rotation.x,yaw:h.camera.rotation.y,fov:h.camera.fov}};});
      console.log(`captured ${name}`); await page.close();
    }
    capture.sourceChanged = JSON.stringify(sourceSha256)!==JSON.stringify(await hashFiles(sourcePaths.map(p=>`src/${p}`)));
    capture.assetsChanged = JSON.stringify(assetSha256)!==JSON.stringify(await hashFiles(Object.keys(assetSha256)));
    if(capture.errors.length || capture.sourceChanged || capture.assetsChanged) throw Error('Capture changed or has page errors; see capture.json');
  } finally {
    await writeFile(`${dest}/capture.json`,JSON.stringify(capture,null,2)+'\n');
    await writeFile(`${dest}/poses.json`,JSON.stringify(poses,null,2)+'\n');
    await browser.close();await server.close();
  }
}
const python = String.raw`
import json,sys,hashlib
from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter,ImageDraw
o=json.loads(sys.stdin.read()); dest=Path(o['dest']); original=Path(o['originals'])
bands={'whole':[0,0,1024,768],'sky':[270,112,800,280],'ground':[16,360,990,548]}
result={'iteration':o['iteration'],'blur_radius_px':8,'bands_xyxy':bands,'stone_rects_xyxy':o['stoneRects'],'poses':{}}
for pose,ref in o['pairs'].items():
    images=[Image.open(p).convert('RGB') for p in [dest/(pose+'.png'),original/ref]]
    assert all(im.size==(1024,768) for im in images)
    a,b=[np.asarray(im.filter(ImageFilter.GaussianBlur(8)),dtype=np.float64) for im in images]
    masks={}
    for band,rect in bands.items():
        mask=np.zeros((768,1024),dtype=bool);x0,y0,x1,y1=rect;mask[y0:y1,x0:x1]=True;masks[band]=mask
    mask=np.zeros((768,1024),dtype=bool)
    for x0,y0,x1,y1 in o['stoneRects'][pose]:mask[y0:y1,x0:x1]=True
    masks['stone-mask']=mask
    entry={'reference':ref,'reference_sha256':hashlib.sha256((original/ref).read_bytes()).hexdigest()}
    for band,mask in masks.items():
        entry[band]={'mae':round(float(np.abs(a[mask]-b[mask]).mean()),3),'pixels':int(mask.sum()),'ours_rgb':np.round(a[mask].mean(axis=0),3).tolist(),'original_rgb':np.round(b[mask].mean(axis=0),3).tolist()}
    result['poses'][pose]=entry
    for j,im in enumerate(images):
        overlay=Image.new('RGBA',im.size);d=ImageDraw.Draw(overlay)
        for x0,y0,x1,y1 in o['stoneRects'][pose]:d.rectangle([x0,y0,x1-1,y1-1],fill=(255,0,255,75),outline=(255,0,255,255),width=2)
        Image.alpha_composite(im.convert('RGBA'),overlay).save(dest/(pose+['-mask-ours.png','-mask-original.png'][j]))
result['mean_mae']={band:round(float(np.mean([v[band]['mae'] for v in result['poses'].values()])),3) for band in [*bands,'stone-mask']}
(dest/'metrics.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result['mean_mae']))
`;
const metric=spawnSync('python3',['-I','-c',python],{input:JSON.stringify({dest,originals,pairs,stoneRects,iteration:Number(iteration)}),encoding:'utf8'});
if(metric.status)throw Error(metric.stderr);console.log(metric.stdout.trim());
const groups={weapons:['weapon-view-cannon','cannon-sight','tb1-first-shot'],environment:['rampart-north','courtyard-palace','crew-at-cannon','tb1-spawn'],effects:['muzzle-flash','smoke-trail','impact-dust']};
for(const [group,names] of Object.entries(groups)){
  const inputs=names.flatMap(n=>['-label',pairs[n],`${originals}/${pairs[n]}`,'-label',`iteration ${iteration}: ${n}`,`${dest}/${n}.png`]);
  const r=spawnSync('montage',['-font','DejaVu-Sans','-pointsize','16',...inputs,'-geometry','512x384+4+4','-tile',`2x${names.length}`,`${dest}/${group}-sheet.png`],{encoding:'utf8'});
  if(r.status)throw Error(r.stderr);
}
await writeFile(`${dest}/sources.json`,JSON.stringify(pairs,null,2)+'\n');
