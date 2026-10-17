// tests/unit/ui-menus.test.js - owns the menu state machine tests (src/ui/menus.js): title, skirmish setup, options, pause, end screen.
import test from "node:test";
import assert from "node:assert/strict";
import { CONTROLLER } from "../../src/contracts.js";
import { TUNING } from "../../src/tuning.js";
import { createMenu, SCREEN, MENU_EVENT } from "../../src/ui/menus.js";
import { defaultSettings } from "../../src/ui/flow.js";
import { DEFAULT_OPTIONS, OPTION_VALUES } from "../../src/ui/options.js";

const MAPS = [{ id: "forest-duel", name: { de: "Waldduell", en: "Forest duel" }, slots: [{ castle: "default" }, { castle: "default" }], wind: { strength: 2, change: 2 }, startGold: 1500 }];
const fresh = (o = {}) => createMenu({ maps: MAPS, settings: defaultSettings(MAPS), options: { ...DEFAULT_OPTIONS }, ...o });
const centre = (it) => [(it.rect.x0 + it.rect.x1) / 2, (it.rect.y0 + it.rect.y1) / 2];
const item = (m, id) => m.items.find((i) => i.id === id);
const goto = (m, id) => { for (let i = 0; i < 40 && m.focusId !== id; i++) m.key("ArrowDown"); assert.equal(m.focusId, id); };

test("main menu lists the original's entries in order and navigates by keyboard", () => {
  const m = fresh();
  assert.equal(m.screen, SCREEN.MAIN);
  assert.deepEqual(m.items.map((i) => i.id), ["skirmish", "tutorial", "options", "credits", "exit"]);
  assert.equal(m.focusId, "skirmish");
  m.key("ArrowUp"); assert.equal(m.focusId, "exit");
  m.key("ArrowDown"); m.key("ArrowDown"); assert.equal(m.focusId, "tutorial");
  m.key("Enter"); assert.equal(m.screen, SCREEN.TUTORIAL);
  m.key("Escape"); assert.equal(m.screen, SCREEN.MAIN);
  goto(m, "credits"); m.key("Enter"); assert.equal(m.screen, SCREEN.CREDITS);
  m.key("Enter"); assert.equal(m.screen, SCREEN.MAIN, "credits back button");
  goto(m, "exit"); m.key("Enter"); assert.equal(m.screen, SCREEN.SPLASH);
  m.key("Space"); assert.equal(m.screen, SCREEN.MAIN);
});

test("mouse: hover focuses, click activates; item rects lie inside 1024 x 768 and do not overlap", () => {
  const m = fresh();
  for (const scr of [SCREEN.MAIN, SCREEN.SKIRMISH, SCREEN.OPTIONS, SCREEN.PAUSE]) {
    const mm = fresh({ screen: scr });
    const rs = mm.items.map((i) => i.rect);
    for (const r of rs) assert.ok(r.x0 >= 0 && r.y0 >= 0 && r.x1 <= 1024 && r.y1 <= 768, scr);
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      assert.ok(!(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1), `${scr}: ${mm.items[i].id} overlaps ${mm.items[j].id}`);
    }
  }
  m.pointer(...centre(item(m, "options")), false);
  assert.equal(m.focusId, "options");
  assert.equal(m.pointer(...centre(item(m, "skirmish")), true), null);
  assert.equal(m.screen, SCREEN.SKIRMISH);
  assert.equal(m.pointer(1, 1, true), null, "click outside does nothing");
});

test("skirmish setup: per-slot controller (Human only for slot 0), AI level 1-10, tactic, wind, gold, seed; Start emits settings", () => {
  const m = fresh({ screen: SCREEN.SKIRMISH });
  const ids = m.items.map((i) => i.id);
  for (const id of ["map", "seed", "slot0.ctrl", "slot0.tactic", "slot1.ctrl", "slot1.tactic", "windStrength", "windChange", "startGold", "back", "start"]) assert.ok(ids.includes(id), id);
  goto(m, "slot0.ctrl");
  assert.equal(m.settings.slots[0].controller, CONTROLLER.LOCAL);
  m.key("ArrowLeft"); assert.equal(m.settings.slots[0].controller, CONTROLLER.LOCAL, "clamps at Human");
  m.key("ArrowRight"); assert.equal(m.settings.slots[0].controller, CONTROLLER.AI); assert.equal(m.settings.slots[0].aiLevel, TUNING.ai.levelMin);
  m.key("ArrowLeft"); assert.equal(m.settings.slots[0].controller, CONTROLLER.LOCAL);
  goto(m, "slot1.ctrl");
  for (let i = 0; i < 30; i++) m.key("ArrowLeft");
  assert.equal(m.settings.slots[1].controller, CONTROLLER.AI, "slot 1 cannot be Human");
  assert.equal(m.settings.slots[1].aiLevel, TUNING.ai.levelMin);
  for (let i = 0; i < 30; i++) m.key("ArrowRight");
  assert.equal(m.settings.slots[1].aiLevel, TUNING.ai.levelMax);
  goto(m, "slot1.tactic"); m.key("ArrowRight"); assert.equal(m.settings.slots[1].tactic, "daredevil");
  goto(m, "seed"); m.key("ArrowRight"); assert.equal(m.settings.seed, 2);
  goto(m, "windStrength"); for (let i = 0; i < 20; i++) m.key("ArrowRight");
  assert.equal(m.settings.windStrength, TUNING.wind.maxSpeedByStrength.length - 1);
  goto(m, "startGold"); m.key("ArrowRight"); assert.ok(m.settings.startGold > 1500);
  goto(m, "start");
  const ev = m.key("Enter");
  assert.equal(ev.type, MENU_EVENT.START);
  assert.equal(ev.settings.slots[1].aiLevel, TUNING.ai.levelMax);
  ev.settings.seed = 999; assert.equal(m.settings.seed, 2, "event carries a copy");
  // clicking a field's right half steps it forward, left half back
  const f = item(m, "seed");
  m.pointer(f.rect.x1 - 4, (f.rect.y0 + f.rect.y1) / 2, true); assert.equal(m.settings.seed, 3);
  m.pointer(f.rect.x0 + 4, (f.rect.y0 + f.rect.y1) / 2, true); assert.equal(m.settings.seed, 2);
  m.key("Escape"); assert.equal(m.screen, SCREEN.MAIN);
});

test("options: sensitivity, language, volume emit an options event and clamp", () => {
  const m = fresh({ screen: SCREEN.OPTIONS });
  assert.deepEqual(m.items.map((i) => i.id), ["sensitivity", "lang", "volume", "followCam", "back"]);
  goto(m, "volume");
  const ev = m.key("ArrowRight");
  assert.equal(ev.type, MENU_EVENT.OPTIONS);
  assert.equal(ev.options.volume, OPTION_VALUES.volume[OPTION_VALUES.volume.indexOf(DEFAULT_OPTIONS.volume) + 1]);
  goto(m, "lang"); const ev2 = m.key("ArrowRight");
  assert.equal(ev2.options.lang, "en"); assert.equal(m.lang, "en");
  assert.equal(m.key("ArrowRight"), null, "no change at the end, no event");
  goto(m, "followCam"); const ev3 = m.key("ArrowLeft");
  assert.equal(ev3.options.followCam, false);
});

test("in-match pause menu: resume, restart, options (returns to pause), back to title; Esc resumes", () => {
  const m = fresh({ screen: SCREEN.PAUSE });
  assert.deepEqual(m.items.map((i) => i.id), ["resume", "restart", "options", "title"]);
  assert.equal(m.key("Escape").type, MENU_EVENT.RESUME);
  goto(m, "restart"); assert.equal(m.key("Enter").type, MENU_EVENT.RESTART);
  goto(m, "options"); m.key("Enter"); assert.equal(m.screen, SCREEN.OPTIONS);
  m.key("Escape"); assert.equal(m.screen, SCREEN.PAUSE);
  goto(m, "title"); assert.equal(m.key("Enter").type, MENU_EVENT.TITLE);
});

test("end screen shows the result and returns to setup or title", () => {
  const result = { won: false, draw: false, durationS: 125, rows: [
    { slot: 0, name: "Spieler", shots: 3, hits: 1, damage: 40, losses: 2 }, { slot: 1, name: "KI", shots: 5, hits: 4, damage: 120, losses: 0 }] };
  const m = fresh({ screen: SCREEN.OVER, result });
  assert.equal(m.result, result);
  assert.deepEqual(m.items.map((i) => i.id), ["setup", "title"]);
  const ev = m.key("Enter");
  assert.equal(ev.type, MENU_EVENT.SETUP); assert.deepEqual(ev.settings, m.settings);
  assert.equal(m.key("Escape"), null, "Esc does not dismiss the end screen");
});

import { drawMenu } from "../../src/ui/menu-draw.js";

function fakeCtx() {
  const handler = {
    get(t, k) {
      if (k in t) return t[k];
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop() {} });
      if (k === "createPattern") return () => ({});
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  };
  return new Proxy({ canvas: { width: 1024, height: 768 } }, handler);
}

test("every screen draws without throwing and labels its items in the menu language", () => {
  const result = { won: true, draw: false, durationS: 65, winnerName: "Spieler", rows: [
    { slot: 0, name: "Spieler", shots: 3, hits: 1, damage: 40, losses: 0, color: "#c02828" }, { slot: 1, name: "Kunibert", shots: 2, hits: 0, damage: 0, losses: 1, color: "#2860c0" }] };
  const seen = {};
  for (const scr of Object.values(SCREEN)) {
    const m = fresh({ screen: scr, result });
    const texts = [];
    drawMenu(fakeCtx(), m, { note: (s) => texts.push(s) });
    seen[scr] = texts;
  }
  assert.ok(seen.main.includes("Hauptmenü") && seen.main.includes("Gefecht") && seen.main.includes("Beenden"));
  assert.ok(seen.skirmish.includes("Starten") && seen.skirmish.includes("Mensch") && seen.skirmish.includes("KI 5") && seen.skirmish.includes("Waldduell"));
  assert.ok(seen.options.includes("Mausempfindlichkeit") && seen.options.includes("Deutsch"));
  assert.ok(seen.pause.includes("Neustart") && seen.pause.includes("Zum Titel"));
  assert.ok(seen.over.includes("Sieg!") && seen.over.includes("Spieldauer 1:05") && seen.over.includes("Schüsse"));
  assert.ok(seen.splash.includes("Taste drücken"));
  const en = fresh({ screen: SCREEN.OVER, result: { ...result, won: false }, options: { ...DEFAULT_OPTIONS, lang: "en" } });
  const t2 = []; drawMenu(fakeCtx(), en, { note: (s) => t2.push(s) });
  assert.ok(t2.includes("Defeat!"));
  const dr = fresh({ screen: SCREEN.OVER, result: { ...result, draw: true } });
  const t3 = []; drawMenu(fakeCtx(), dr, { note: (s) => t3.push(s) });
  assert.ok(t3.includes("Unentschieden!"));
});
