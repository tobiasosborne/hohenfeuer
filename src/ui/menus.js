// src/ui/menus.js - owns the menu state machine: title/main menu, skirmish setup, options, credits, tutorial stub, in-match pause and end screen.
// Pure: screens, items with their 1024 x 768 rects, keyboard and pointer handling, emitted events.
// Drawing lives in src/ui/menu-draw.js. Layout follows the original's 800 x 600 menus (main menu,
// options, scenario and hot-seat setup captures) scaled to the 1024 x 768 HUD space.

import { CONTROLLER, TACTIC } from "../contracts.js";
import { TUNING } from "../tuning.js";
import { OPTION_VALUES, sanitizeOptions, DEFAULT_OPTIONS } from "./options.js";
import { defaultSettings } from "./flow.js";

export const SCREEN = Object.freeze({
  SPLASH: "splash", MAIN: "main", SKIRMISH: "skirmish", OPTIONS: "options", CREDITS: "credits", TUTORIAL: "tutorial",
  PAUSE: "pause", OVER: "over",
});
export const MENU_EVENT = Object.freeze({ START: "start", RESUME: "resume", RESTART: "restart", TITLE: "title", SETUP: "setup", OPTIONS: "options" });

const rect = (x0, y0, x1, y1) => Object.freeze({ x0, y0, x1, y1 });
const inRect = (r, x, y) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const TACTICS = [TACTIC.WORRIER, TACTIC.GENERAL, TACTIC.DAREDEVIL];
const TACTIC_KEY = { [TACTIC.WORRIER]: "tacticWorrier", [TACTIC.GENERAL]: "tacticGeneral", [TACTIC.DAREDEVIL]: "tacticDaredevil" };
const GOLD = [500, 1000, 1500, 2000, 3000, 4000, 6000];
const SEED_MAX = 0x7fffffff;

/** Vertical stack of capsule buttons centred on x 512 (main menu, pause). */
const stack = (ids, y0, step, w = 256, h = 40) => ids.map((id, i) => ({ id, kind: "button", label: id, rect: rect(512 - w / 2, y0 + i * step, 512 + w / 2, y0 + i * step + h) }));
/** Bottom-centre button of the circular screens (the original's Exit / Back plate). */
const bottom = (id) => ({ id, kind: "button", label: id, rect: rect(432, 630, 592, 670) });

/** Step a value inside a list by dir; returns the new value (clamped). */
function stepList(list, v, dir) {
  const i = Math.max(0, list.indexOf(v));
  return list[Math.max(0, Math.min(list.length - 1, i + dir))];
}

/**
 * @param {{screen?: string, maps: Array<{id: string, name: {de: string, en: string}, slots: object[]}>,
 *   settings?: object, options?: object, result?: object}} o
 */
export function createMenu(o) {
  const maps = o.maps;
  const settings = o.settings ? JSON.parse(JSON.stringify(o.settings)) : defaultSettings(maps);
  const options = sanitizeOptions(o.options ?? DEFAULT_OPTIONS);
  const result = o.result ?? null;
  let screen = o.screen ?? SCREEN.MAIN;
  let returnTo = screen === SCREEN.PAUSE ? SCREEN.PAUSE : SCREEN.MAIN;
  let focus = 0;

  const field = (id, label, r, get, step, text) => ({ id, kind: "field", label, rect: r, get, step, text });

  function slotFields() {
    const out = [];
    settings.slots.forEach((s, i) => {
      const y = 112 + i * 40;
      const ctrlValues = i === 0 ? ["local", ...range(TUNING.ai.levelMin, TUNING.ai.levelMax)] : range(TUNING.ai.levelMin, TUNING.ai.levelMax);
      out.push(field(`slot${i}.ctrl`, "slotController", rect(330, y, 570, y + 32),
        () => (s.controller === CONTROLLER.LOCAL ? "local" : s.aiLevel),
        (dir) => {
          const cur = s.controller === CONTROLLER.LOCAL ? "local" : s.aiLevel;
          const next = stepList(ctrlValues, cur, dir);
          if (next === cur) return false;
          if (next === "local") s.controller = CONTROLLER.LOCAL;
          else { s.controller = CONTROLLER.AI; s.aiLevel = next; }
          return true;
        },
        (t) => (s.controller === CONTROLLER.LOCAL ? t("human") : t("aiLevelN", { n: s.aiLevel }))));
      out.push(field(`slot${i}.tactic`, "tactic", rect(590, y, 830, y + 32), () => s.tactic,
        (dir) => { const n = stepList(TACTICS, s.tactic, dir); if (n === s.tactic) return false; s.tactic = n; return true; },
        (t) => t(TACTIC_KEY[s.tactic])));
    });
    return out;
  }

  function listField(id, label, r, list, obj, key, textOf) {
    return field(id, label, r, () => obj[key],
      (dir) => { const n = stepList(list, obj[key], dir); if (n === obj[key]) return false; obj[key] = n; return true; },
      textOf ?? (() => String(obj[key])));
  }

  function items() {
    switch (screen) {
      case SCREEN.SPLASH: return [{ id: "continue", kind: "button", label: "pressKey", rect: rect(312, 560, 712, 600) }];
      case SCREEN.MAIN: return [...stack(["skirmish", "tutorial", "options", "credits"], 238, 52), bottom("exit")];
      case SCREEN.SKIRMISH: {
        const mapDef = maps.find((m) => m.id === settings.map) ?? maps[0];
        const W = TUNING.wind;
        return [
          listField("map", "map", rect(150, 318, 470, 350), maps.map((m) => m.id), settings, "map", (t, lang) => mapDef.name[lang] ?? mapDef.id),
          field("seed", "seed", rect(150, 362, 470, 394), () => settings.seed,
            (dir) => { const n = Math.max(0, Math.min(SEED_MAX, settings.seed + dir)); if (n === settings.seed) return false; settings.seed = n; return true; },
            () => String(settings.seed)),
          ...slotFields(),
          listField("windStrength", "windStrength", rect(700, 318, 980, 350), range(0, W.maxSpeedByStrength.length - 1), settings, "windStrength",
            (t) => (settings.windStrength === 0 ? t("off") : String(settings.windStrength))),
          listField("windChange", "windChange", rect(700, 362, 980, 394), range(0, W.segmentBaseByChange.length - 1), settings, "windChange",
            (t) => (settings.windChange === 0 ? t("off") : String(settings.windChange))),
          listField("startGold", "startGold", rect(700, 406, 980, 438), GOLD.includes(settings.startGold) ? GOLD : [...GOLD, settings.startGold].sort((a, b) => a - b), settings, "startGold"),
          { id: "back", kind: "button", label: "back", rect: rect(824, 606, 984, 642) },
          { id: "start", kind: "button", label: "start", rect: rect(824, 660, 984, 724) },
        ];
      }
      case SCREEN.OPTIONS: return [
        listField("sensitivity", "sensitivity", rect(250, 250, 540, 290), OPTION_VALUES.sensitivity, options, "sensitivity",
          () => `${Math.round((options.sensitivity / OPTION_VALUES.sensitivity[3]) * 100)}%`),
        listField("lang", "language", rect(250, 320, 540, 360), OPTION_VALUES.lang, options, "lang", (t) => t("langName", options.lang)),
        listField("volume", "volume", rect(250, 390, 540, 430), OPTION_VALUES.volume, options, "volume", () => `${options.volume * 10}%`),
        listField("followCam", "followCam", rect(250, 460, 540, 500), OPTION_VALUES.followCam, options, "followCam", (t) => t(options.followCam ? "on" : "off")),
        bottom("back"),
      ];
      case SCREEN.CREDITS: case SCREEN.TUTORIAL: return [bottom("back")];
      case SCREEN.PAUSE: return stack(["resume", "restart", "options", "title"], 270, 58, 280, 44);
      case SCREEN.OVER: return [
        { id: "setup", kind: "button", label: "continue", rect: rect(292, 668, 502, 710) },
        { id: "title", kind: "button", label: "title", rect: rect(522, 668, 732, 710) },
      ];
      default: return [];
    }
  }

  const go = (s) => { screen = s; const its = items(); focus = s === SCREEN.SKIRMISH ? its.findIndex((i) => i.id === "start") : 0; };
  const copy = (x) => JSON.parse(JSON.stringify(x));

  function activate(it) {
    switch (it.id) {
      case "continue": go(SCREEN.MAIN); return null;
      case "skirmish": go(SCREEN.SKIRMISH); return null;
      case "tutorial": go(SCREEN.TUTORIAL); return null;
      case "credits": go(SCREEN.CREDITS); return null;
      case "options": returnTo = screen === SCREEN.PAUSE ? SCREEN.PAUSE : SCREEN.MAIN; go(SCREEN.OPTIONS); return null;
      case "exit": go(SCREEN.SPLASH); return null;
      case "back": go(screen === SCREEN.OPTIONS ? returnTo : SCREEN.MAIN); return null;
      case "start": return { type: MENU_EVENT.START, settings: copy(settings) };
      case "resume": return { type: MENU_EVENT.RESUME };
      case "restart": return { type: MENU_EVENT.RESTART };
      case "title": return { type: MENU_EVENT.TITLE };
      case "setup": return { type: MENU_EVENT.SETUP, settings: copy(settings) };
      default: return null;
    }
  }

  function stepField(it, dir) {
    if (!it.step(dir)) return null;
    return screen === SCREEN.OPTIONS ? { type: MENU_EVENT.OPTIONS, options: { ...options } } : null;
  }

  return {
    get screen() { return screen; },
    get items() { return items(); },
    get focus() { return focus; },
    get focusId() { return items()[focus]?.id ?? null; },
    get lang() { return options.lang; },
    settings, options, result, maps,
    /** @param {string} code KeyboardEvent.code @returns {object|null} event */
    key(code) {
      const its = items();
      const it = its[focus];
      if (screen === SCREEN.SPLASH) { go(SCREEN.MAIN); return null; }
      if (code === "ArrowDown" || code === "Tab") focus = (focus + 1) % its.length;
      else if (code === "ArrowUp") focus = (focus - 1 + its.length) % its.length;
      else if ((code === "ArrowLeft" || code === "ArrowRight") && it?.kind === "field") return stepField(it, code === "ArrowRight" ? 1 : -1);
      else if (code === "Enter" || code === "NumpadEnter" || code === "Space") {
        if (it?.kind === "button") return activate(it);
        if (it?.kind === "field") return stepField(it, 1);
      } else if (code === "Escape") {
        if (screen === SCREEN.PAUSE) return { type: MENU_EVENT.RESUME };
        if (screen === SCREEN.OPTIONS) go(returnTo);
        else if ([SCREEN.SKIRMISH, SCREEN.CREDITS, SCREEN.TUTORIAL].includes(screen)) go(SCREEN.MAIN);
      }
      return null;
    },
    /** Pointer at logical (x, y); hover focuses, click activates (fields: left half steps back, right half forward). */
    pointer(x, y, click) {
      const its = items();
      if (screen === SCREEN.SPLASH && click) { go(SCREEN.MAIN); return null; }
      const i = its.findIndex((it) => inRect(it.rect, x, y));
      if (i < 0) return null;
      focus = i;
      if (!click) return null;
      const it = its[i];
      if (it.kind === "button") return activate(it);
      return stepField(it, x < (it.rect.x0 + it.rect.x1) / 2 ? -1 : 1);
    },
    /** Jump to a screen (debug API / flow). */
    show(s) { go(s); },
  };
}
