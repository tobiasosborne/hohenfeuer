// tests/ui-hud.mjs - owns the HUD harness browser test: dev/ui.html renders under SwiftShader without console errors and is pixel-stable.
// Run: node tests/ui-hud.mjs. Writes test-results/ui-hud-<pose>.png and test-results/ui-hud-report.json.
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { launch, startServer, webglRenderer } from "./lib.mjs";

const out = resolve("test-results");
await mkdir(out, { recursive: true });
const poses = JSON.parse(await readFile(resolve("tests/goldens/poses-ui.json"), "utf8"));
const extra = { "menu-skirmish": { page: "dev/ui.html?pose=menu-skirmish&bg=sky&lang=de", width: 1024, height: 768 } };
const report = { status: "running", renderer: null, errors: [], checks: [] };
let browser, server;

async function shoot(url, p) {
  const page = await browser.newPage({ viewport: { width: p.width, height: p.height }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(url + p.page);
  await page.waitForFunction(() => window.__hohenfeuer?.ready === true);
  // same call sequence as scripts/goldens.mjs
  await page.evaluate((pose) => window.__hohenfeuer.setPose(pose), p);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  if (!report.renderer) report.renderer = await webglRenderer(page);
  const png = await page.screenshot();
  await page.close();
  return { png, errors };
}

try {
  let url;
  ({ server, url } = await startServer());
  browser = await launch();
  for (const [name, p] of Object.entries({ ...poses, ...extra })) {
    const a = await shoot(url, p);
    const b = await shoot(url, p);
    report.errors.push(...a.errors, ...b.errors);
    assert.deepEqual([...a.errors, ...b.errors], [], `${name}: console errors`);
    await writeFile(resolve(out, `ui-hud-${name}.png`), a.png);
    const ia = PNG.sync.read(a.png), ib = PNG.sync.read(b.png);
    assert.equal(ia.width, p.width); assert.equal(ia.height, p.height);
    const diff = pixelmatch(ia.data, ib.data, null, ia.width, ia.height, { threshold: 0 });
    assert.equal(diff, 0, `${name}: ${diff} px differ between two runs`);
    // the console centre must be HUD, not the magenta/sky background
    const px = (x, y) => { const i = (y * ia.width + x) * 4; return [ia.data[i], ia.data[i + 1], ia.data[i + 2]]; };
    const [r, g, bl] = px(300, 700);
    assert.ok(!(r > 240 && g < 20 && bl > 240), `${name}: console not drawn`);
    report.checks.push(`${name}: stable (0 px), no errors`);
  }
  console.log("renderer:", report.renderer);
  report.status = "passed";
} catch (e) {
  report.status = "failed";
  report.failure = String(e.stack || e);
  process.exitCode = 1;
} finally {
  await writeFile(resolve(out, "ui-hud-report.json"), JSON.stringify(report, null, 2));
  await browser?.close();
  await server?.close();
  console.log(`ui-hud: ${report.status}\n  ${report.checks.join("\n  ")}`);
  if (report.failure) console.error(report.failure);
}
