// owns: strict two-run onboarding/HUD capture with explicit, reviewable baseline replacement names.
// node tests/evidence/onboarding/capture.mjs [--accept=pose1,pose2,...]
// Captures all non-modern gameplay/UI poses; never touches render-only or modern baselines.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { launch, startServer, webglRenderer } from '../../lib.mjs';

const out = resolve('tests/evidence/onboarding'), goldenDir = resolve('tests/goldens');
await mkdir(out, { recursive: true });
const poses = JSON.parse(await readFile(resolve(goldenDir, 'poses.json'), 'utf8'));
const names = Object.keys(poses).filter(n => !n.startsWith('modern-') && /^(index|dev\/ui)\.html/.test(poses[n].page));
const accept = (process.argv.find(a => a.startsWith('--accept='))?.slice(9) ?? '').split(',').filter(Boolean);
assert.ok(accept.every(n => names.includes(n)), 'accept list contains an unknown, render-only or modern pose');
async function fingerprint() {
  const h = createHash('sha256');
  const files = (await readdir('src', { recursive: true })).filter(n => n.endsWith('.js')).sort();
  for (const file of files) h.update(file).update(await readFile(resolve('src', file)));
  return h.update(await readFile(resolve(goldenDir, 'poses.json'))).digest('hex');
}
const source = await fingerprint();
const report = { status: 'running', source, renderer: null, ignored: Object.keys(poses).filter(n => n.startsWith('modern-')), captures: [], replaced: [] };
let browser, server;
async function shot(url, name) {
  const p = poses[name], page = await browser.newPage({ viewport: { width: p.width, height: p.height }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(new URL(p.page, url).href);
  await page.waitForFunction(() => window.__hohenfeuer?.ready === true);
  await page.evaluate(p => window.__hohenfeuer.setPose(p), p);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  report.renderer ??= await webglRenderer(page);
  assert.match(report.renderer, /SwiftShader/i);
  const png = await page.screenshot();
  await page.close(); assert.deepEqual(errors, [], `${name} console errors`);
  return png;
}
function difference(a,b) {
  assert.equal(a.width,b.width); assert.equal(a.height,b.height);
  return pixelmatch(a.data,b.data,null,a.width,a.height,{ threshold: 0 });
}
try {
  let url; ({ server, url } = await startServer()); browser = await launch();
  const replacements = [];
  for (const name of names) {
    const a = await shot(url,name), b = await shot(url,name);
    const image = PNG.sync.read(a);
    assert.equal(difference(image, PNG.sync.read(b)), 0, `${name}: two captures differ`);
    await writeFile(resolve(out, `${name}.actual.png`), a);
    let baseline = null;
    try { baseline = PNG.sync.read(await readFile(resolve(goldenDir, `${name}.png`))); } catch(e) { if(e.code !== 'ENOENT') throw e; }
    const changedPixels = baseline ? difference(image,baseline) : null;
    report.captures.push({ name, repeatedPixels: 0, changedPixels });
    if (accept.includes(name)) replacements.push({ name, data: a });
  }
  assert.equal(await fingerprint(), source, 'source changed during captures; rerun after concurrent edits settle');
  // Only explicitly named, twice-identical, source-stable captures may replace baselines.
  for (const { name,data } of replacements) { await writeFile(resolve(goldenDir,`${name}.png`),data); report.replaced.push(name); }
  for (const [name, file] of [['hud-match1','after-match1'], ['hud-match3','after-match3'], ['hud-walking','after-walking'], ['hud-weapon-view','after-weapon'], ['quick-start-title','after-title']]) {
    await writeFile(resolve(out,`${file}.png`),await readFile(resolve(out,`${name}.actual.png`)));
  }
  report.status = 'passed';
} catch(e) { report.status = 'failed'; report.failure = String(e.stack ?? e); process.exitCode = 1; }
finally {
  await browser?.close(); await server?.close();
  await writeFile(resolve(out,'capture-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
