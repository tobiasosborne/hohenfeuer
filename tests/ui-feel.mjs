// tests/ui-feel.mjs - owns the feel/readability golden-pose stability test: feel-recoil, impact-view, npc-markers captured twice, 0 px apart.
// Run: node tests/ui-feel.mjs [pose ...] (default: the three feel poses). Vite runs without HMR/watch so concurrent edits cannot reload the page mid-run.
// Writes test-results/ui-feel-<pose>.png and test-results/ui-feel-report.json.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { createServer } from "vite";
import { launch } from "./lib.mjs";

const out = resolve("test-results");
await mkdir(out, { recursive: true });
const poses = JSON.parse(await readFile(resolve("tests/goldens/poses.json"), "utf8"));
const NAMES = process.argv.length > 2 ? process.argv.slice(2) : ["feel-recoil", "impact-view", "npc-markers"];
const report = { status: "running", errors: [], checks: [] };
let browser, server;

async function shoot(url, p) {
  const page = await browser.newPage({ viewport: { width: p.width, height: p.height }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(new URL(p.page, url).href);
  await page.waitForFunction(() => window.__hohenfeuer?.ready === true);
  const r = await page.evaluate((pose) => window.__hohenfeuer.setPose(pose), p);
  const info = await page.evaluate(() => ({ texts: window.__hohenfeuer.hud.frame.texts }));
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  const png = await page.screenshot();
  await page.close();
  return { png, errors, r, info };
}

try {
  server = await createServer({ server: { port: 0, strictPort: false, host: "127.0.0.1", hmr: false, watch: null }, logLevel: "error" });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await launch();
  for (const name of NAMES) {
    const p = poses[name];
    assert.ok(p, `pose ${name} in tests/goldens/poses.json`);
    const a = await shoot(url, p), b = await shoot(url, p);
    report.errors.push(...a.errors, ...b.errors);
    await writeFile(resolve(out, `ui-feel-${name}.png`), a.png);
    const ia = PNG.sync.read(a.png), ib = PNG.sync.read(b.png);
    const diff = pixelmatch(ia.data, ib.data, null, ia.width, ia.height, { threshold: 0 });
    assert.equal(diff, 0, `${name}: ${diff} px differ between two runs`);
    if (name === "impact-view") assert.equal(a.r.mode, "impact", "follow cam holds on the impact");
    if (name === "feel-recoil") assert.equal(a.r.mode, "weapon");
    if (name === "npc-markers") assert.ok(a.info.texts.includes("Mauer steht!"), "speech bubble drawn");
    report.checks.push(`${name}: 0 px over two runs (mode ${a.r.mode})`);
  }
  assert.deepEqual(report.errors, [], "no console errors");
  report.status = "passed";
} catch (e) {
  report.status = "failed";
  report.failure = String(e.stack || e);
  process.exitCode = 1;
} finally {
  await writeFile(resolve(out, "ui-feel-report.json"), JSON.stringify(report, null, 2));
  await browser?.close();
  await server?.close();
  console.log(`ui-feel: ${report.status}\n  ${report.checks.join("\n  ")}`);
  if (report.failure) console.error(report.failure);
}
