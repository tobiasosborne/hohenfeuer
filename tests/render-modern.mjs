// Owns SwiftShader shader compilation, runtime-switch invariants, fire determinism and optional GPU-pass validation.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { launch,startServer,webglRenderer } from './lib.mjs';
const {server,url}=await startServer();await server.watcher.close();const browser=await launch();
const report={renderer:null,errors:[],checks:[]};
try {
  const page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:1});page.setDefaultTimeout(120000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(new URL('dev/render.html?golden=1',url).href);await page.waitForFunction(()=>window.__hohenfeuer?.ready);
  report.renderer=await webglRenderer(page);assert.match(report.renderer,/SwiftShader/);
  const before=await page.screenshot();
  const result=await page.evaluate(()=>{
    const h=window.__hohenfeuer, meshes=h.chunks.group.children;
    window.__styleGeometries=meshes.map(m=>m.geometry);
    const dirty=h.chunks.dirtyCount();h.setStyle('modern');h.render();
    return {style:h.style,shader:meshes.every(m=>m.material.isShaderMaterial),geometry:meshes.every((m,i)=>m.geometry===window.__styleGeometries[i]),dirty:h.chunks.dirtyCount()===dirty,info:h.info()};
  });
  assert.equal(result.style,'modern');assert.ok(result.shader&&result.geometry&&result.dirty);assert.equal(result.info.gpuExtras,false);report.checks.push(result);
  const modern=await page.screenshot();assert.notDeepEqual(modern,before);
  await page.evaluate(()=>{window.__hohenfeuer.setStyle('classic');});
  assert.deepEqual(await page.screenshot(),before,'classic round trip restores exact PNG');
  const fire=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {META}=await import('/src/contracts.js');
    const {createRenderer}=await import('/src/render/renderer.js');
    const view=createRenderer({letterbox:false,style:'modern',golden:false,gpuExtras:true});
    const state={tick:30,castles:[{plot:{width:1,depth:1,origin:{x:0,y:0,z:0},meta:[META.BURNING_BIT],type:[4],hp:[10]}}]};
    view.setStateSource(()=>state);view.camera.position.set(0,1,3);view.render();
    const pixels=view.domElement.toDataURL();
    const mesh=view.scene.getObjectByName('modern-burning-blocks');
    const a={count:mesh.count,time:mesh.material.uniforms.uTime.value,extras:view.gpuExtras,shadows:view.renderer.shadowMap.enabled};
    view.render();a.repeat=mesh.material.uniforms.uTime.value;a.samePixels=pixels===view.domElement.toDataURL();
    state.tick=60;view.render();a.next=mesh.material.uniforms.uTime.value;a.animatedPixels=pixels!==view.domElement.toDataURL();
    state.tick=61;state.castles[0].plot.meta[0]=0;view.render();a.extinguished=mesh.count;
    view.dispose();
    // Shader compilation and GPU-pass smoke is separate from golden baselines. This is a software
    // compatibility probe; extras remain opt-in for actual GPU play, never golden rendering.
    history.replaceState(null,'','/dev/render.html');
    const gpu=createRenderer({letterbox:false,style:'modern',golden:false,gpuExtras:true});
    gpu.camera.position.set(0,2,6);gpu.camera.lookAt(0,0,0);
    const floor=new THREE.Mesh(new THREE.BoxGeometry(8,.2,8),new THREE.MeshLambertMaterial());floor.name='chunk fixture';gpu.scene.add(floor);
    const box=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshLambertMaterial());box.name='chunk box';box.position.y=.6;gpu.scene.add(box);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffffff,transparent:true}));sprite.position.set(0,.4,1);gpu.scene.add(sprite);
    gpu.render();gpu.render();a.gpu={...gpu.info(),shadowSize:gpu.sun.shadow.map.width,programs:gpu.renderer.info.programs.length};
    const depthId=gpu.renderer.properties.get(sprite.material).uniforms.uSceneDepth.value.id;
    const gpuPixels=gpu.domElement.toDataURL();
    gpu.setStyle('classic');gpu.render();a.gpuDisabled=!gpu.renderer.shadowMap.enabled;
    gpu.setStyle('modern');gpu.render();gpu.render();
    const rebound=gpu.renderer.properties.get(sprite.material).uniforms.uSceneDepth?.value;
    a.freshDepthBinding=!!rebound && rebound.id!==depthId;
    a.gpuRoundTripPixels=gpuPixels===gpu.domElement.toDataURL();
    gpu.dispose();floor.geometry.dispose();box.geometry.dispose();sprite.material.dispose();
    return a;
  });
  assert.equal(fire.count,1);assert.equal(fire.time,1);assert.equal(fire.repeat,1);assert.equal(fire.next,2);assert.equal(fire.extinguished,0);
  assert.ok(fire.samePixels&&fire.animatedPixels);
  assert.equal(fire.extras,false);assert.equal(fire.shadows,false);assert.equal(fire.gpu.shadowSize,2048);assert.ok(fire.gpu.gpuExtras&&fire.gpuDisabled);
  assert.ok(fire.freshDepthBinding&&fire.gpuRoundTripPixels,'GPU re-entry must bind the new depth texture and preserve pixels');
  report.checks.push(fire);
  for (const kit of ['none','v0']) {
    await page.goto(new URL(`dev/render.html?golden=1&style=modern&kit=${kit}`,url).href);
    await page.waitForFunction(()=>window.__hohenfeuer?.ready);
    const fallback=await page.evaluate(()=>{const h=window.__hohenfeuer;h.render();return {kit:h.kit,style:h.style,shader:h.chunks.group.children.every(m=>m.material.isShaderMaterial)};});
    assert.equal(fallback.style,'modern');assert.ok(fallback.shader);report.checks.push(fallback);
  }
  // The gameplay impact includes dust sprites, debris, people and the HUD. Preserve all
  // of it across a material switch without advancing or mutating simulation state.
  const impact=JSON.parse(await readFile('tests/goldens/poses.json','utf8'))['impact-dust'];
  await page.goto(new URL('index.html?golden=1',url).href);
  await page.waitForFunction(()=>window.__hohenfeuer?.ready);
  await page.evaluate(p=>window.__hohenfeuer.setPose(p),impact);
  const impactBefore=await page.screenshot(), hashBefore=await page.evaluate(()=>window.__hohenfeuer.sim.hash());
  await page.evaluate(()=>{const h=window.__hohenfeuer;h.setStyle('modern');h.setStyle('classic');});
  assert.deepEqual(await page.screenshot(),impactBefore,'classic impact round trip is exact, including transparent effects');
  assert.equal(await page.evaluate(()=>window.__hohenfeuer.sim.hash()),hashBefore,'style switch leaves the sim untouched');
  report.checks.push({impactRoundTrip:true,simHashUnchanged:true});
  assert.deepEqual(report.errors,[]);report.status='passed';console.log(JSON.stringify(report,null,2));
} catch(e){report.status='failed';report.failure=e.stack;console.error(e,report.errors);process.exitCode=1;}
finally {await writeFile('tests/evidence/14-modern-browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();await server.close();}
