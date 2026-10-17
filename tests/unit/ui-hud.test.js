// tests/unit/ui-hud.test.js - owns node-side tests of the HUD parts: compass geometry, minimap, message log, menus, textures, hud draw.
import test from "node:test";
import assert from "node:assert/strict";
import { BLOCK, CAMERA_MODE, EV } from "../../src/contracts.js";
import { TUNING } from "../../src/tuning.js";
import { createPlot, setCell } from "../../src/world/grid.js";
import { compassGeometry, LETTER_RADIUS } from "../../src/ui/compass.js";
import { topDown, MAP_CODE, binCodes } from "../../src/ui/minimap.js";
import { createMessageLog, eventsToMessages } from "../../src/ui/console.js";
import { createMenu, SCREEN } from "../../src/ui/menus.js";
import { createHud, formatReadouts } from "../../src/ui/hud.js";
import { demoView, demoMinimap } from "../../src/ui/demo.js";
import { stoneTexture, steelTexture, hashNoise } from "../../src/ui/paint.js";
import { LAYOUT } from "../../src/ui/layout.js";

const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

test("compass: letters rotate with heading, hub shows rounded wind, red/blue arrows per 3.4", () => {
  const c = LAYOUT.compass;
  const g0 = compassGeometry({ heading: 0, wind: { speed: 11.6, dirDeg: 90, prevDirDeg: null }, enemies: [], lang: "de" });
  const N = g0.letters.find((l) => l.key === "dirN");
  assert.ok(near(N.x, c.cx) && near(N.y, c.cy - LETTER_RADIUS));
  assert.equal(g0.letters.find((l) => l.key === "dirE").text, "O");
  assert.equal(g0.hub, "12");
  assert.equal(g0.red, 90); assert.equal(g0.blue, null);
  const g90 = compassGeometry({ heading: 90, wind: { speed: 0.4, dirDeg: 90, prevDirDeg: 30 }, enemies: [{ bearingDeg: 120, ally: false, color: "#22cc22" }], lang: "en" });
  const N90 = g90.letters.find((l) => l.key === "dirN");
  assert.ok(near(N90.x, c.cx - LETTER_RADIUS) && near(N90.y, c.cy, 1e-9));
  assert.equal(g90.red, null, "hidden below 0.5 m/s");
  assert.equal(g90.blue, -60);
  assert.equal(g90.icons.length, 1); assert.ok(near(g90.icons[0].angle, 30));
  assert.equal(g90.hub, "0");
});

test("minimap topDown: top block per column, damage redder, weapons blue, designations marked", () => {
  const plot = createPlot({ id: 0 });
  setCell(plot, 1, 1, 1, BLOCK.STONE, TUNING.blocks.stone.hp, 0);
  setCell(plot, 2, 1, 1, BLOCK.STONE, 5, 0);
  setCell(plot, 3, 3, 1, BLOCK.TOWER, TUNING.blocks.tower.hp, 0);
  plot.meta[4 + 48 * 1 + 2304 * 2] = 32; // designated air
  const m = topDown(plot, [{ cell: [10, 2, 10], footprint: [3, 3] }]);
  assert.equal(m.w, 48); assert.equal(m.d, 48);
  const at = (x, z) => m.codes[x + 48 * z];
  assert.equal(at(0, 0), MAP_CODE.EMPTY);
  assert.equal(at(1, 1), MAP_CODE.BLOCK);
  assert.equal(at(2, 1), MAP_CODE.DAMAGED3);
  assert.equal(at(3, 1), MAP_CODE.BLOCK);
  assert.equal(at(4, 1), MAP_CODE.DESIGNATED);
  for (const [x, z] of [[9, 9], [10, 10], [11, 11]]) assert.equal(at(x, z), MAP_CODE.WEAPON);
});

test("message log keeps the newest N within their lifetime; events map through EV names", () => {
  const log = createMessageLog({ max: 3, ttlTicks: 100 });
  for (let i = 0; i < 5; i++) log.push(`m${i}`, { tick: i * 10 });
  assert.deepEqual(log.visible(40).map((m) => m.text), ["m2", "m3", "m4"]);
  assert.deepEqual(log.visible(125).map((m) => m.text), ["m3", "m4"]);
  assert.deepEqual(log.visible(1000), []);
  const msgs = eventsToMessages([
    { type: EV.WIND_CHANGED, payload: { speed: 5, dirDeg: 10, prevDirDeg: 0 } },
    { type: EV.RULER_DIED, payload: { slot: 0, cause: "shot" } },
    { type: EV.GAME_OVER, payload: { winners: [0], draw: false } },
    { type: EV.BLOCK_DAMAGED, payload: {} },
  ], { lang: "de", slot: 0 });
  assert.deepEqual(msgs.map((m) => m.text), ["Der Wind hat gedreht!", "Der Herrscher ist gefallen!", "Sieg!"]);
});

test("menus: keyboard navigation through title and skirmish setup", () => {
  const m = createMenu();
  assert.equal(m.screen, SCREEN.TITLE);
  assert.equal(m.focusId, "skirmish");
  assert.equal(m.key("Enter"), null);
  assert.equal(m.screen, SCREEN.SKIRMISH);
  const before = m.settings.windStrength;
  assert.equal(before, TUNING.wind.defaultStrength);
  while (m.focusId !== "windStrength") m.key("ArrowDown");
  m.key("ArrowRight");
  assert.equal(m.settings.windStrength, before + 1);
  m.key("ArrowUp"); m.key("ArrowDown");
  assert.equal(m.focusId, "windStrength");
  for (let i = 0; i < 20; i++) m.key("ArrowRight");
  assert.equal(m.settings.windStrength, TUNING.wind.maxSpeedByStrength.length - 1);
  while (m.focusId !== "start") m.key("ArrowDown");
  const ev = m.key("Enter");
  assert.equal(ev.type, "start");
  assert.equal(ev.settings.windStrength, TUNING.wind.maxSpeedByStrength.length - 1);
  m.key("Escape");
  assert.equal(m.screen, SCREEN.TITLE);
  // focus wraps
  m.key("ArrowUp");
  assert.equal(m.focusId, m.items[m.items.length - 1].id);
});

test("textures are deterministic RGBA buffers", () => {
  const a = stoneTexture(32, 16, 7), b = stoneTexture(32, 16, 7), c = stoneTexture(32, 16, 8);
  assert.equal(a.length, 32 * 16 * 4);
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  assert.equal(steelTexture(8, 8, 1).length, 256);
  for (let i = 0; i < 100; i++) { const v = hashNoise(i, i * 3, 5); assert.ok(v >= 0 && v < 1); }
});

test("readouts format as three digits: floor(az/10), floor(range/10)", () => {
  assert.deepEqual(formatReadouts(0, 380), ["000", "038"]);
  assert.deepEqual(formatReadouts(3549, 489), ["354", "048"]);
  assert.deepEqual(formatReadouts(3599, 9999), ["359", "999"]);
});

function fakeCtx(w = 1024, h = 768) {
  const texts = [];
  const handler = {
    get(t, k) {
      if (k in t) return t[k];
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop() {} });
      if (k === "createPattern") return () => ({});
      if (k === "createImageData") return (iw, ih) => ({ width: iw, height: ih, data: new Uint8ClampedArray(iw * ih * 4) });
      if (k === "measureText") return () => ({ width: 0 });
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  };
  return { ctx: new Proxy({ canvas: { width: w, height: h }, texts }, handler), texts };
}

test("hud draws a weapon view and a walking view without throwing", () => {
  const { ctx } = fakeCtx();
  const hud = createHud(ctx);
  const v = demoView("hud-weapon-view");
  assert.equal(v.mode, CAMERA_MODE.WEAPON);
  hud.draw(v);
  assert.deepEqual(hud.frame.readouts, ["000", "038"]);
  assert.ok(hud.frame.texts.includes("Lädt nach"));
  assert.ok(hud.frame.texts.includes("Kanone (100%)"));
  assert.ok(hud.frame.texts.includes("12"));
  const w = demoView("hud-walking");
  hud.draw(w);
  assert.equal(hud.frame.readouts, null);
  assert.ok(hud.frame.texts.some((s) => s.includes("%")));
  hud.draw({ mode: CAMERA_MODE.WALK });
  hud.draw({ mode: CAMERA_MODE.DEATH, lang: "en" });
});

test("overview squares: 2 x 2 plot cells per square, worst damage wins, weapons on top", () => {
  const codes = new Uint8Array(16);
  codes[0] = MAP_CODE.BLOCK; codes[1] = MAP_CODE.DAMAGED2;
  codes[2] = MAP_CODE.BLOCK; codes[2 + 4] = MAP_CODE.WEAPON; codes[3 + 4] = MAP_CODE.DAMAGED3;
  const b = binCodes({ w: 4, d: 4, codes });
  assert.equal(b.w, 2); assert.equal(b.d, 2);
  assert.deepEqual([...b.codes], [MAP_CODE.DAMAGED2, MAP_CODE.WEAPON, 0, 0]);
});

test("demo views: castle view has no targeted enemy map; overviews are sparse like the original's", () => {
  assert.equal(demoView("hud-walking").minimapEnemy, null);
  assert.ok(demoView("hud-weapon-view").minimapEnemy);
  const m = demoMinimap(0);
  const lit = m.codes.reduce((n, c) => n + (c ? 1 : 0), 0) / m.codes.length;
  assert.ok(lit > 0.03 && lit < 0.12, `lit fraction ${lit}`);
});

test("walking console: status bar shows the reticle target's condition, shelter takes priority, no fourth button", () => {
  const { ctx } = fakeCtx();
  const hud = createHud(ctx);
  const w = demoView("hud-walking");
  hud.draw(w);
  assert.ok(hud.frame.texts.includes("Kanone (100%)"), hud.frame.texts.join("|"));
  assert.ok(!hud.frame.texts.includes("Schutzraum"));
  hud.draw({ ...w, shelterOn: true });
  assert.ok(hud.frame.texts.includes("Schutzraum"));
  assert.ok(!hud.frame.texts.includes("Kanone (100%)"));
});
