// tests/evidence/43-tb3-video.mjs - owns an exact 20 s, 30 fps SwiftShader TB3 capture through the debug API.
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { TUNING as T } from '../../src/tuning.js';
import { launch, startServer, webglRenderer } from '../lib.mjs';
const frames = 'test-results/tb3-frames', fps = 30, seconds = 20;
await mkdir(frames, { recursive: true });
const { server, url } = await startServer(), browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(120000);
  await page.goto(new URL('index.html?golden=1&lang=en', url).href);
  await page.waitForFunction(() => window.__hohenfeuer?.ready);
  assert.match(await webglRenderer(page), /SwiftShader/);
  await page.evaluate(() => { const h=window.__hohenfeuer; h.runScript('tb3'); h.stepTo(260); });
  const timeline = [];
  // Two sim ticks/frame: the ruler designates, masons climb the stairs, five blocks appear,
  // a controlled incoming projectile hits one of them, and a normal R order repairs it.
  for (let frame=0; frame<fps*seconds; frame++) {
    const status = await page.evaluate(({ frame }) => {
      const h=window.__hohenfeuer;
      if (frame===250) h.setPose({ position:[111.5,8.6,125.5],yaw:-2.90,pitch:-0.18,fov:60,showRuler:false });
      if (frame===270) h.enemyShot([41,7,29]);
      if (frame===280) h.issue({ type:'repair-priority',cell:[41,7,29] });
      h.stepTo(260+frame*2);
      const p=h.state.castles[0].plot;
      return { frame,tick:h.state.tick,pending:h.ghosts.count,hp:p.hp[41+48*29+2304*7],built:[25,27,29,31,33].map(z=>p.type[41+48*z+2304*7]) };
    }, { frame });
    if ([0,11,249,250,270,279,280,400,599].includes(frame)) timeline.push(status);
    await page.screenshot({ path:`${frames}/${String(frame).padStart(4,'0')}.png` });
  }
  assert.deepEqual(timeline.find(s=>s.frame===250).built,[1,1,1,1,1]);
  const damaged=timeline.find(s=>s.frame===279), repaired=timeline.at(-1);
  assert.ok(damaged.hp>0 && damaged.hp<T.blocks.stone.hp,JSON.stringify(damaged));
  assert.equal(repaired.hp,T.blocks.stone.hp);
  await writeFile('tests/evidence/43-tb3-video-timeline.json',JSON.stringify(timeline,null,2));
  const result=spawnSync('ffmpeg',['-nostdin','-y','-loglevel','error','-framerate',String(fps),'-i',`${frames}/%04d.png`,'-t',String(seconds),'-c:v','libvpx-vp9','-pix_fmt','yuv420p','-crf','30','-b:v','0','test-results/tb3.webm'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  console.log(JSON.stringify({ seconds,fps,frames:fps*seconds,timeline }));
  await rm(frames,{recursive:true});
} finally { await browser.close(); await server.close(); }
