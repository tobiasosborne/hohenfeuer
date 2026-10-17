// tests/render-tb1-video.mjs - owns recording the TB1 slice (index.html?demo=1) to test-results/tb1.webm under SwiftShader;
// falls back to 6 screenshots at 2 s intervals (test-results/tb1-*.png) if video recording fails.
import { mkdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { launch, startServer } from "./lib.mjs";

const SECONDS = Number(process.argv[2] ?? 20);
const out = resolve("test-results");
const tmp = resolve(out, "tb1-video-tmp");
await mkdir(tmp, { recursive: true });
const { server, url } = await startServer();
const browser = await launch();
const errors = [];
let mode = "video";
try {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, recordVideo: { dir: tmp, size: { width: 1024, height: 768 } } });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(new URL("index.html?demo=1", url).href);
  await page.waitForFunction(() => window.__hohenfeuer?.ready === true, null, { timeout: 60000 });
  for (let i = 1; i <= 6; i++) {
    await page.waitForTimeout((SECONDS / 6) * 1000);
    const s = await page.evaluate(() => ({ tick: window.__hohenfeuer.state.tick, mode: window.__hohenfeuer.mode, balls: window.__hohenfeuer.state.projectiles.length }));
    console.log(`t=${((SECONDS / 6) * i).toFixed(1)}s tick ${s.tick} mode ${s.mode} balls ${s.balls}`);
    await page.screenshot({ path: resolve(out, `tb1-${i}.png`) });
  }
  const video = page.video();
  await context.close();
  const path = video ? await video.path() : null;
  if (path) await rename(path, resolve(out, "tb1.webm"));
  else mode = "screenshots";
} catch (e) {
  mode = `screenshots (video failed: ${e.message})`;
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
  await rm(tmp, { recursive: true, force: true });
}
console.log(`tb1 capture: ${mode}; console errors: ${errors.length ? errors.join(" | ") : "none"}`);
