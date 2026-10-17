// owns: headless-chromium smoke test (software WebGL), writes test-results/smoke.png and browser-report.json.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { launch, startServer, webglRenderer } from "./lib.mjs";

const out = resolve("test-results");
await mkdir(out, { recursive: true });
const report = { status: "running", renderer: null, errors: [], checks: [], screenshots: [] };
let browser, server;
try {
  ({ server, url: report.url } = await startServer());
  browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && report.errors.push(m.text()));
  await page.goto(report.url);
  await page.waitForFunction(() => window.__hohenfeuer?.ready === true);
  report.checks.push("ready");

  report.renderer = await webglRenderer(page);
  assert.ok(report.renderer, "WebGL2 context must exist");
  console.log("WebGL renderer:", report.renderer);
  report.checks.push("webgl");

  const fov = await page.evaluate(() => window.__hohenfeuer.camera.fov);
  assert.equal(fov, 75);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const shot = resolve(out, "smoke.png");
  await page.screenshot({ path: shot });
  report.screenshots.push(shot);
  report.checks.push("screenshot");

  assert.deepEqual(report.errors, [], "no console errors");
  report.checks.push("no-console-errors");
  report.status = "passed";
} catch (e) {
  report.status = "failed";
  report.failure = String(e.stack || e);
  process.exitCode = 1;
} finally {
  await writeFile(resolve(out, "browser-report.json"), JSON.stringify(report, null, 2));
  await browser?.close();
  await server?.close();
  console.log(`browser smoke: ${report.status} (${report.checks.join(", ")})`);
  if (report.failure) console.error(report.failure);
}
