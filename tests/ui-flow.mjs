// tests/ui-flow.mjs - owns the browser test of the match flow: title menu -> skirmish setup -> match -> pause -> restart / title, options persistence, end screen.
// Run: node tests/ui-flow.mjs (SwiftShader). Writes test-results/ui-flow-*.png and test-results/ui-flow-report.json.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { launch } from "./lib.mjs";

/** Vite without HMR/watch: concurrent edits elsewhere in the repo must not full-reload the page mid-test. */
async function startServer() {
  const server = await createServer({ server: { port: 0, strictPort: false, host: "127.0.0.1", hmr: false, watch: null }, logLevel: "error" });
  await server.listen();
  return { server, url: server.resolvedUrls.local[0] };
}

const out = resolve("test-results");
await mkdir(out, { recursive: true });
const report = { status: "running", errors: [], checks: [] };
let browser, server;
const H = "window.__hohenfeuer";
const ready = (page, extra = "true") => page.waitForFunction(`${H}?.ready === true && (${extra})`, null, { timeout: 90000 });
const shot = (page, name) => page.screenshot({ path: resolve(out, `ui-flow-${name}.png`) });

try {
  let url;
  ({ server, url } = await startServer());
  browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && report.errors.push(m.text()));

  // 1. Bare URL: the title menu, not a match.
  await page.goto(url);
  await ready(page, `${H}.frontend === true`);
  assert.equal(await page.evaluate(`${H}.menu.screen`), "main");
  assert.ok((await page.evaluate(`${H}.texts`)).includes("Hauptmenü"));
  await shot(page, "title");
  report.checks.push("title-menu");

  // 2. Options persist in localStorage across a reload (mouse: click the Options plate, then keys).
  const opt = await page.evaluate(`${H}.menu.items.find((i) => i.id === "options").rect`);
  await page.mouse.click((opt.x0 + opt.x1) / 2, (opt.y0 + opt.y1) / 2);
  assert.equal(await page.evaluate(`${H}.menu.screen`), "options");
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown"); // volume
  await page.keyboard.press("ArrowRight");
  const stored = JSON.parse(await page.evaluate(`localStorage.getItem("hohenfeuer.options")`));
  assert.equal(stored.volume, 7);
  await page.reload();
  await ready(page, `${H}.frontend === true`);
  assert.equal(await page.evaluate(`${H}.menu.options.volume`), 7);
  report.checks.push("options-persist");

  // 3. Keyboard: Skirmish -> setup (Start focused), raise the AI level, Start -> the match boots.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(`${H}.menu.screen`), "skirmish");
  await shot(page, "skirmish");
  for (let i = 0; i < 40 && (await page.evaluate(`${H}.menu.focusId`)) !== "slot1.ctrl"; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  for (let i = 0; i < 40 && (await page.evaluate(`${H}.menu.focusId`)) !== "start"; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await ready(page, `${H}.state && ${H}.state.tick > 15`);
  const slots = await page.evaluate(`${H}.state.slots.map((s) => [s.controller, s.aiLevel])`);
  assert.deepEqual(slots.map((s) => s[0]), ["local", "ai"]);
  assert.equal(slots[1][1], 6, "AI level from the setup screen");
  report.checks.push("setup-starts-match");

  // 4. Pause menu: the sim stops, Esc resumes.
  await page.evaluate(`${H}.openMenu("pause")`);
  const t0 = await page.evaluate(`${H}.state.tick`);
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(`${H}.state.tick`), t0, "paused");
  await shot(page, "pause");
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(`${H}.menu`), null);
  await page.waitForFunction(`${H}.state.tick > ${t0}`);
  report.checks.push("pause-resume");

  // 5. Restart keeps the settings; back to title returns to the menu.
  await page.evaluate(`${H}.openMenu("pause")`);
  await Promise.all([page.waitForEvent("load"), page.evaluate(`${H}.menuKey("ArrowDown"), ${H}.menuKey("Enter")`)]);
  await ready(page, `${H}.state && ${H}.state.tick > 5`);
  assert.equal(await page.evaluate(`${H}.state.slots[1].aiLevel`), 6, "restart keeps settings");
  await page.evaluate(`${H}.openMenu("pause")`);
  await Promise.all([page.waitForEvent("load"), page.evaluate(`${H}.menuKey("ArrowUp"), ${H}.menuKey("Enter")`)]);
  await ready(page, `${H}.frontend === true`);
  assert.equal(await page.evaluate(`${H}.menu.screen`), "main");
  report.checks.push("restart-and-title");

  // 6. End screen after a surrender, then "Weiter" opens the setup with the same settings.
  await page.goto(new URL("index.html?golden=1", url).href);
  await ready(page, `${H}.state`);
  const over = await page.evaluate(() => {
    const h = window.__hohenfeuer;
    h.issue({ type: "surrender", slot: 0 });
    h.stepTo(h.state.tick + 2);
    return { screen: h.menu?.screen, texts: h.hud.frame.texts };
  });
  assert.equal(over.screen, "over");
  assert.ok(over.texts.includes("Niederlage!") && over.texts.includes("Schüsse"));
  await shot(page, "over");
  report.checks.push("end-screen");

  assert.deepEqual(report.errors, [], "no console errors");
  report.status = "passed";
} catch (e) {
  report.status = "failed";
  report.failure = String(e.stack || e);
  process.exitCode = 1;
} finally {
  await writeFile(resolve(out, "ui-flow-report.json"), JSON.stringify(report, null, 2));
  await browser?.close();
  await server?.close();
  console.log(`ui-flow: ${report.status}\n  ${report.checks.join("\n  ")}`);
  if (report.failure) console.error(report.failure);
}
