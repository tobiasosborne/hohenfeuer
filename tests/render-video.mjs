// tests/render-video.mjs - owns recording a scripted slice of index.html to test-results/<name>.webm under SwiftShader,
// plus 6 evenly spaced stills (test-results/<name>-1..6.png). Usage: node tests/render-video.mjs [seconds] [query] [name]
// e.g. `20 demo=1 tb1` (TB1) or `30 demo=tb2&speed=2 tb2` (TB2 director).
import { mkdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { launch, startServer } from "./lib.mjs";

const SECONDS = Number(process.argv[2] ?? 20);
const QUERY = process.argv[3] ?? "demo=1";
const NAME = process.argv[4] ?? "tb1";
const out = resolve("test-results");
const tmp = resolve(out, `${NAME}-video-tmp`);
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
  await page.goto(new URL(`index.html?${QUERY}`, url).href);
  await page.waitForFunction(() => window.__hohenfeuer?.ready === true, null, { timeout: 60000 });
  for (let i = 1; i <= 6; i++) {
    await page.waitForTimeout((SECONDS / 6) * 1000);
    const s = await page.evaluate(() => { const h = window.__hohenfeuer, st = h.state; return { tick: st.tick, mode: h.mode, balls: st.projectiles.length, masons: st.npcs.filter((n) => n.slot === 0 && n.role === "mason").map((n) => n.state).join(","), info: h.info() }; });
    console.log(`t=${((SECONDS / 6) * i).toFixed(1)}s tick ${s.tick} mode ${s.mode} balls ${s.balls} masons ${s.masons} calls ${s.info.calls} tris ${s.info.triangles}`);
    await page.screenshot({ path: resolve(out, `${NAME}-${i}.png`) });
  }
  const video = page.video();
  await context.close();
  const path = video ? await video.path() : null;
  if (path) await rename(path, resolve(out, `${NAME}.webm`));
  else mode = "screenshots";
} catch (e) {
  mode = `screenshots (video failed: ${e.message})`;
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
  await rm(tmp, { recursive: true, force: true });
}
console.log(`${NAME} capture: ${mode}; console errors: ${errors.length ? errors.join(" | ") : "none"}`);
