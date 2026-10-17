// Owns exact decoded-pixel stability and draw/triangle budgets for every SwiftShader golden, over two fresh runs.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { launch, startServer, webglRenderer } from './lib.mjs';

const poseText = await readFile('tests/goldens/poses.json', 'utf8');
const poses = JSON.parse(poseText);
async function sourceSnapshot() {
  const paths = (await readdir('src', { recursive: true })).filter(p => p.endsWith('.js')).sort();
  return Object.fromEntries(await Promise.all(paths.map(async p => [p, createHash('sha256').update(await readFile(`src/${p}`)).digest('hex')])));
}
async function assetSnapshot() {
  const paths = (await readdir('assets', { recursive: true })).filter(p => /\.(glb|png|json)$/.test(p)).sort();
  return Object.fromEntries(await Promise.all(paths.map(async p => [p, createHash('sha256').update(await readFile(`assets/${p}`)).digest('hex')])));
}
const report = { renderer: null, runs: [], errors: [], sourceSha256: await sourceSnapshot(),
  assetSha256: await assetSnapshot(),
  posesSha256: createHash('sha256').update(poseText).digest('hex') };
const { server, url } = await startServer();
await server.watcher.close(); // Other lanes may edit during capture; HMR must not advance or reset a pose.
const browser = await launch();
let failed = false;
try {
  for (let run = 1; run <= 2; run++) {
    const results = {};
    for (const [name, pose] of Object.entries(poses)) {
      const page = await browser.newPage({ viewport: { width: pose.width, height: pose.height }, deviceScaleFactor: 1 });
      page.setDefaultTimeout(120000);
      page.on('pageerror', e => report.errors.push(`${name}: ${e.message}`));
      await page.goto(new URL(pose.page || 'index.html', url).href);
      await page.waitForFunction(() => window.__hohenfeuer?.ready === true);
      report.renderer ??= await webglRenderer(page);
      await page.evaluate(p => window.__hohenfeuer.setPose(p), pose);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const actual = PNG.sync.read(await page.screenshot());
      const expected = PNG.sync.read(await readFile(`tests/goldens/${name}.png`));
      assert.equal(actual.width, expected.width); assert.equal(actual.height, expected.height);
      let pixels = 0;
      for (let i = 0; i < actual.data.length; i += 4) {
        if (actual.data[i] !== expected.data[i] || actual.data[i+1] !== expected.data[i+1] ||
            actual.data[i+2] !== expected.data[i+2] || actual.data[i+3] !== expected.data[i+3]) pixels++;
      }
      const info = await page.evaluate(() => window.__hohenfeuer.info?.() ?? {});
      results[name] = { pixels, ...info };
      if (pixels || info.calls > 250 || info.triangles > 300000) failed = true;
      console.log(`run ${run} ${name}: ${pixels} exact pixels; ${info.calls ?? '-'} calls, ${info.triangles ?? '-'} triangles`);
      await page.close();
    }
    report.runs.push(results);
  }
  assert.match(report.renderer, /SwiftShader/i);
  assert.equal(await readFile('tests/goldens/poses.json', 'utf8'), poseText, 'poses changed during verification');
  assert.deepEqual(await sourceSnapshot(), report.sourceSha256, 'source changed during verification');
  assert.deepEqual(await assetSnapshot(), report.assetSha256, 'assets changed during verification');
  assert.deepEqual(report.errors, []);
  assert.equal(failed, false, 'all decoded pixels and rendering budgets must pass');
  report.status = 'passed';
} catch (e) {
  report.status = 'failed'; report.failure = String(e.stack || e); process.exitCode = 1;
} finally {
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/render-stability.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close(); await server.close();
  console.log(`exact stability: ${report.status}`);
  if (report.failure) console.error(report.failure);
}
