// tests/evidence/36-tb3-browser.mjs - owns SwiftShader keyboard-to-build rendering acceptance and evidence images.
import assert from 'node:assert/strict';
import { launch, startServer, webglRenderer } from '../lib.mjs';
const { server, url } = await startServer(), browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(new URL('index.html?golden=1&lang=en', url).href);
  await page.waitForFunction(() => window.__hohenfeuer?.ready);
  assert.match(await webglRenderer(page), /SwiftShader/);
  await page.evaluate(() => { const h = window.__hohenfeuer; h.runScript('tb3'); h.stepTo(279); h.setBuild({ mode: 'none' }, h.script().look(h.state)); });
  await page.keyboard.press('b');
  let c = await page.evaluate(() => { const h = window.__hohenfeuer; h.frame(); const c = h.construction(); return { ghost: c.ghost, visible: h.ghosts.preview.visible, texts: h.hud.frame.texts }; });
  assert.ok(c.visible && c.ghost.valid, JSON.stringify(c));
  assert.deepEqual(c.ghost.cell, [41, 7, 25]);
  assert.ok(c.texts.some(t => t.includes('Stone') && t.includes('1')));
  await page.screenshot({ path: 'test-results/tb3-live-ghost.png' });
  // Pointer lock cannot be granted by headless Chromium. Override only its DOM flag;
  // keyboard, click, reticle picking, buildCommands and sim dispatch remain the real path.
  await page.evaluate(() => Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => document.querySelector('canvas') }));
  await page.mouse.click(512, 384);
  const designated = await page.evaluate(() => {
    const h = window.__hohenfeuer; h.playerStep();
    return { count: h.ghosts.count, reserved: h.state.castles[0].npcDesignations.reduce((s,d) => s+d.reserved,0), texts: h.hud.frame.texts, dirty: h.chunks.dirtyCount() };
  });
  assert.equal(designated.count, 1); assert.equal(designated.reserved, 1);
  assert.ok(designated.texts.some(t => t.includes('Reserved 1')));
  await page.screenshot({ path: 'test-results/tb3-live-designated.png' });
  await page.mouse.click(512, 384, { button: 'right' });
  await page.evaluate(() => window.__hohenfeuer.playerStep());
  assert.equal(await page.evaluate(() => window.__hohenfeuer.ghosts.count), 0);
  await page.keyboard.press('3');
  assert.equal(await page.evaluate(() => window.__hohenfeuer.input.build.block), 4);
  await page.mouse.wheel(0, 100);
  assert.equal(await page.evaluate(() => window.__hohenfeuer.input.build.block), 5);
  await page.keyboard.press('g');
  assert.equal(await page.evaluate(() => window.__hohenfeuer.input.build.mode), 'weapon');
  console.log(JSON.stringify({ renderer: await webglRenderer(page), designated, errors }));
  assert.deepEqual(errors, []);
  await page.close();
  const p = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await p.goto(new URL('index.html?golden=1', url).href); await p.waitForFunction(() => window.__hohenfeuer?.ready);
  const result = await p.evaluate(() => {
    const h = window.__hohenfeuer; h.runScript('tb3'); h.stepTo(281); const outlines = h.ghosts.count;
    h.stepTo(760); return { outlines, pending: h.ghosts.count, dirty: h.chunks.dirtyCount(), cells: [25,27,29,31,33].map(z => h.state.castles[0].plot.type[41+48*z+2304*7]) };
  });
  assert.equal(result.outlines, 5); assert.equal(result.pending, 0); assert.deepEqual(result.cells, [1,1,1,1,1]);
  console.log(JSON.stringify(result)); await p.close();
} finally { await browser.close(); await server.close(); }
