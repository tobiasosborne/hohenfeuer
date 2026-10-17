// owns: headless-chromium smoke test of index.html (TB1 boot, software WebGL); writes test-results/smoke.png and browser-report.json.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { launch, startServer, webglRenderer } from "./lib.mjs";

const out = resolve("test-results");
await mkdir(out, { recursive: true });
const report = { status: "running", renderer: null, errors: [], checks: [], screenshots: [] };
let browser, server;
const watch = (page, tag) => {
  page.on("pageerror", (e) => report.errors.push(`${tag}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && report.errors.push(`${tag}: ${m.text()}`));
};
try {
  ({ server, url: report.url } = await startServer());
  browser = await launch();

  // 1. Live boot: the fixed-step loop advances the sim on its own.
  const live = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  live.setDefaultTimeout(60000);
  watch(live, "live");
  // The title screen owns the bare URL; the live renderer smoke explicitly starts a match.
  await live.goto(new URL('index.html?play=1', report.url).href);
  await live.waitForFunction(() => window.__hohenfeuer?.ready === true);
  report.checks.push("ready");
  report.renderer = await webglRenderer(live);
  assert.ok(report.renderer, "WebGL2 context must exist");
  console.log("WebGL renderer:", report.renderer);
  report.checks.push("webgl");
  const boot = await live.evaluate(() => ({ fov: window.__hohenfeuer.camera.fov, kit: window.__hohenfeuer.kit, slots: window.__hohenfeuer.state.slots.map((s) => s.controller) }));
  assert.equal(boot.fov, 60, "first-person FOV (TUNING.ruler.fovDeg)");
  assert.deepEqual(boot.slots, ["local", "ai"]);
  await live.waitForFunction(() => window.__hohenfeuer.state.tick > 15);
  report.checks.push("loop-advances");
  await live.screenshot({ path: resolve(out, "smoke.png") });
  report.screenshots.push(resolve(out, "smoke.png"));

  // 2. Scripted slice (golden mode): walk, man the cannon, fire; the ball flies toward the enemy.
  const g = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  g.setDefaultTimeout(120000);
  watch(g, "golden");
  await g.goto(new URL("index.html?golden=1", report.url).href);
  await g.waitForFunction(() => window.__hohenfeuer?.ready === true);
  const shot = await g.evaluate(() => window.__hohenfeuer.setPose({ script: "tb1", until: "ball-near-enemy" }));
  const st = await g.evaluate(() => { const s = window.__hohenfeuer.state; return { manning: s.rulers[0].manning, balls: s.projectiles.filter((p) => p.sourceSlot === 0).length, tick: s.tick }; });
  assert.equal(shot.mode, "weapon", "weapon view after manning");
  assert.ok(st.manning !== null, "ruler mans a cannon");
  assert.equal(st.balls, 1, "one slot-0 ball in flight");
  report.checks.push(`tb1-first-shot@${st.tick}`);
  await g.screenshot({ path: resolve(out, "smoke-tb1.png") });
  report.screenshots.push(resolve(out, "smoke-tb1.png"));

  // 3. Game over: a surrender ends the game and the HUD shows the defeat message with the menu overlay.
  const over = await g.evaluate(() => {
    const h = window.__hohenfeuer;
    h.issue({ type: "surrender", slot: 0 });
    h.stepTo(h.state.tick + 2);
    return { outcome: h.state.outcome, texts: h.hud.frame.texts };
  });
  assert.ok(over.outcome, "game over");
  assert.deepEqual(over.outcome.winners, [1]);
  assert.ok(over.texts.includes("Niederlage!"), "defeat message drawn");
  report.checks.push("game-over-overlay");
  await g.screenshot({ path: resolve(out, "smoke-gameover.png") });
  report.screenshots.push(resolve(out, "smoke-gameover.png"));

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
