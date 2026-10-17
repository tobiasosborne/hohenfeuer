// tests/render-goldens.mjs - owns the lane-D browser check: boots dev/render.html under SwiftShader, asserts budgets,
// captures/compares the poses that carry a "page" field in tests/goldens/poses.json (exact match by default),
// and writes test-results/render-report.json with draw calls and frame times. Flags: --update, --tolerance=<px>.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { launch, startServer, webglRenderer } from "./lib.mjs";

const UPDATE = process.argv.includes("--update");
const TOL = Number((process.argv.find((a) => a.startsWith("--tolerance=")) ?? "--tolerance=0").split("=")[1]);
const MAX_DRAW_CALLS = 250; // DESIGN 7.1 / TUNING.render.maxDrawCalls
const goldenDir = resolve("tests/goldens");
const out = resolve("test-results");
await mkdir(out, { recursive: true });
const poses = Object.entries(JSON.parse(await readFile(resolve(goldenDir, "poses.json"), "utf8"))).filter(([, p]) => p.page);

const report = { status: "running", renderer: null, kit: null, poses: {}, errors: [] };
let browser, server, failed = 0;
try {
  ({ server, url: report.url } = await startServer());
  browser = await launch();
  for (const [name, p] of poses) {
    const page = await browser.newPage({ viewport: { width: p.width, height: p.height }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(30000);
    page.on("pageerror", (e) => report.errors.push(`${name}: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && report.errors.push(`${name}: ${m.text()}`));
    await page.goto(new URL(p.page, report.url).href);
    await page.waitForFunction(() => globalThis.__hohenfeuer?.ready === true);
    report.renderer ??= await webglRenderer(page);
    const meta = await page.evaluate((pose) => {
      const h = globalThis.__hohenfeuer;
      h.setPose(pose);
      return { kit: h.kit, kitError: h.kitError, chunks: h.chunks.meshCount(), dirty: h.chunks.dirtyCount() };
    }, p);
    report.kit = meta.kit;
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const shot = await page.screenshot();
    const perf = await page.evaluate(() => globalThis.__hohenfeuer.timeFrames(30));
    await page.close();
    const entry = { ...meta, ...perf };
    report.poses[name] = entry;
    assert.ok(perf.calls <= MAX_DRAW_CALLS, `${name}: ${perf.calls} draw calls > ${MAX_DRAW_CALLS}`);
    assert.equal(meta.dirty, 0, `${name}: chunks still dirty after boot`);
    const goldenPath = resolve(goldenDir, `${name}.png`);
    if (UPDATE || !existsSync(goldenPath)) {
      await writeFile(goldenPath, shot);
      entry.golden = "written";
      console.log(`${name}: golden written (${perf.calls} calls, ${perf.triangles} tris, ${perf.avgMs.toFixed(1)} ms/frame)`);
      continue;
    }
    const a = PNG.sync.read(await readFile(goldenPath)), b = PNG.sync.read(shot);
    if (a.width !== b.width || a.height !== b.height) { entry.golden = "size mismatch"; failed++; console.log(`${name}: FAIL size mismatch`); continue; }
    const diff = new PNG({ width: a.width, height: a.height });
    const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0 });
    entry.diffPx = n;
    if (n > TOL) {
      await writeFile(resolve(out, `${name}.diff.png`), PNG.sync.write(diff));
      await writeFile(resolve(out, `${name}.actual.png`), shot);
      entry.golden = "FAIL"; failed++;
      console.log(`${name}: FAIL ${n} px differ (tolerance ${TOL})`);
    } else {
      entry.golden = "ok";
      console.log(`${name}: ok (${n} px differ; ${perf.calls} calls, ${perf.triangles} tris, ${perf.avgMs.toFixed(1)} ms/frame)`);
    }
  }
  // Fallback palette path (no kit): must boot without errors and mesh the same plots.
  {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
    page.on("pageerror", (e) => report.errors.push(`kit=0: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && report.errors.push(`kit=0: ${m.text()}`));
    await page.goto(new URL("dev/render.html?kit=0", report.url).href);
    await page.waitForFunction(() => globalThis.__hohenfeuer?.ready === true);
    const fb = await page.evaluate(() => ({ kit: globalThis.__hohenfeuer.kit, chunks: globalThis.__hohenfeuer.chunks.meshCount() }));
    report.fallback = fb;
    assert.equal(fb.kit, "fallback");
    assert.ok(fb.chunks > 0, "fallback meshes chunks");
    await page.close();
  }
  assert.deepEqual(report.errors, [], "no page or console errors");
  assert.ok(poses.length >= 2, "rampart-north and weapon-view-cannon poses present");
  report.status = failed ? "failed" : "passed";
  if (failed) process.exitCode = 1;
} catch (e) {
  report.status = "failed";
  report.failure = String(e.stack || e);
  process.exitCode = 1;
} finally {
  await writeFile(resolve(out, "render-report.json"), JSON.stringify(report, null, 2));
  await browser?.close();
  await server?.close();
  console.log(`render goldens: ${report.status} (renderer: ${report.renderer}; kit: ${report.kit})`);
  if (report.failure) console.error(report.failure);
}
