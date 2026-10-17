// Owns the shipped cannon's camera/Sight agreement and projected muzzle-clearance check on SwiftShader.
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { launch,startServer } from './lib.mjs';
const {server,url}=await startServer();await server.watcher.close();
const browser=await launch();
try {
  const page=await browser.newPage({viewport:{width:1024,height:768}});page.setDefaultTimeout(120000);
  page.on('pageerror',e=>console.error(e.message));
  page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
  await page.goto(new URL('index.html?golden=1',url).href);
  await page.waitForFunction(()=>window.__hohenfeuer?.ready===true);
  await page.evaluate(()=>window.__hohenfeuer.setPose({script:'tb1',until:254,camera:'rig'}));
  const result=await page.evaluate(()=>{
    const h=window.__hohenfeuer,c=h.camera,p=c.position.clone();let sightError=Infinity,muzzle=null,nearest=Infinity;
    h.scene.updateMatrixWorld(true);
    h.scene.traverse(o=>{
      if(o.name!=='Sight'&&o.name!=='Muzzle')return;
      o.getWorldPosition(p);const d=p.distanceTo(c.position);
      if(o.name==='Sight')sightError=Math.min(sightError,d);
      else if(d<nearest){nearest=d;muzzle=p.clone();}
    });
    const direction=c.getWorldDirection(p);direction.y=0;direction.normalize().multiplyScalar(10000).add(c.position).project(c);
    muzzle.project(c);
    return {camera:c.position.toArray(),pitch:c.rotation.x,fov:c.fov,sightError,
      muzzlePx:[(muzzle.x+1)*512,(1-muzzle.y)*384],horizonY:(1-direction.y)*384};
  });
  assert.ok(result.sightError<1e-6,'rendered Sight and live pivot rig must coincide');
  assert.equal(result.fov,50);
  assert.ok(result.muzzlePx[0]>350 && result.muzzlePx[0]<500,'muzzle left of centre');
  assert.ok(result.muzzlePx[1]>result.horizonY && result.muzzlePx[1]<430,'muzzle below the horizon in lower-middle scene');
  await mkdir('assets-ripped/look-loop/pass2',{recursive:true});
  await writeFile('assets-ripped/look-loop/pass2/cannon-framing.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
} finally {await browser.close();await server.close();}
