// src/ui/menus.js - owns the title and skirmish-setup menus: keyboard-navigable state machine and their drawing.
// State logic is pure; drawMenu paints a stone-framed 800 x 600 panel centred in the 1024 x 768 HUD
// (layout after shots 01, 02; only the in-scope skirmish controls of DESIGN 7.5).

import { TACTIC } from "../contracts.js";
import { TUNING } from "../tuning.js";
import { t } from "./i18n.js";
import { drawText, drawTextIn } from "./font.js";
import { roundRectPath, bevelRect } from "./paint.js";

export const SCREEN = Object.freeze({ TITLE: "title", SKIRMISH: "skirmish" });

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const W = TUNING.wind;

/** Skirmish fields: id, label key, option values, optional label keys for values. */
function skirmishFields(o) {
  return [
    { id: "players", label: "players", values: range(2, TUNING.world.maxSlots) },
    { id: "aiLevel", label: "aiLevel", values: range(TUNING.ai.levelMin, TUNING.ai.levelMax) },
    { id: "tactic", label: "tactic", values: [TACTIC.WORRIER, TACTIC.GENERAL, TACTIC.DAREDEVIL],
      names: { [TACTIC.WORRIER]: "tacticWorrier", [TACTIC.GENERAL]: "tacticGeneral", [TACTIC.DAREDEVIL]: "tacticDaredevil" } },
    { id: "startGold", label: "startGold", values: [1000, 1500, 2000, 3000, 4000] },
    { id: "windStrength", label: "windStrength", values: range(0, W.maxSpeedByStrength.length - 1) },
    { id: "windChange", label: "windChange", values: range(0, W.meanIntervalSByChange.length - 1) },
    { id: "map", label: "map", values: o.maps || ["forest-duel"] },
    { id: "biome", label: "biome", values: o.biomes || ["forest", "desert", "ice", "volcano"], names: { forest: "forest", desert: "desert", ice: "ice", volcano: "volcano" } },
    { id: "lang", label: "language", values: ["de", "en"], names: { de: "langName", en: "langName" } },
  ];
}

/**
 * Menu state machine. key(code) handles ArrowUp/Down (focus, wraps), ArrowLeft/Right (value),
 * Enter (activate), Escape (back); returns an event `{type: 'start', settings}` / `{type: 'quit'}` or null.
 * @param {{maps?: string[], biomes?: string[]}} [o]
 */
export function createMenu(o = {}) {
  const fields = skirmishFields(o);
  const settings = {
    players: 2, aiLevel: 5, tactic: TACTIC.GENERAL, startGold: TUNING.economy.startGold,
    windStrength: W.defaultStrength, windChange: W.defaultChange, map: fields[6].values[0], biome: fields[7].values[0], lang: "de",
  };
  const screens = {
    [SCREEN.TITLE]: [{ id: "skirmish", label: "skirmish" }, { id: "quit", label: "quit" }],
    [SCREEN.SKIRMISH]: [...fields, { id: "start", label: "start" }, { id: "back", label: "back" }],
  };
  let screen = SCREEN.TITLE, focus = 0;
  const go = (s) => { screen = s; focus = 0; };
  return {
    get screen() { return screen; },
    get items() { return screens[screen]; },
    get focus() { return focus; },
    get focusId() { return screens[screen][focus].id; },
    settings,
    fields,
    /** @param {string} code KeyboardEvent.code */
    key(code) {
      const items = screens[screen];
      const item = items[focus];
      if (code === "ArrowDown") focus = (focus + 1) % items.length;
      else if (code === "ArrowUp") focus = (focus - 1 + items.length) % items.length;
      else if ((code === "ArrowLeft" || code === "ArrowRight") && item.values) {
        const i = item.values.indexOf(settings[item.id]);
        const j = Math.max(0, Math.min(item.values.length - 1, i + (code === "ArrowRight" ? 1 : -1)));
        settings[item.id] = item.values[j];
      } else if (code === "Enter" || code === "NumpadEnter" || code === "Space") {
        if (item.id === "skirmish") go(SCREEN.SKIRMISH);
        else if (item.id === "quit") return { type: "quit" };
        else if (item.id === "back") go(SCREEN.TITLE);
        else if (item.id === "start") return { type: "start", settings: { ...settings } };
      } else if (code === "Escape" && screen !== SCREEN.TITLE) go(SCREEN.TITLE);
      return null;
    },
  };
}

/** Display text of a field's current value. */
function valueText(f, v, lang) {
  if (f.id === "lang") return t("langName", v);
  if (f.names) return t(f.names[v], lang);
  if ((f.id === "windStrength" || f.id === "windChange") && v === 0) return t("off", lang);
  return String(v);
}

/**
 * Draw the current menu screen over the HUD (logical 1024 x 768 coordinates).
 * @param {CanvasRenderingContext2D} ctx @param {ReturnType<typeof createMenu>} menu
 */
export function drawMenu(ctx, menu) {
  const lang = menu.settings.lang;
  const x0 = 112, y0 = 84, x1 = 912, y1 = 684;
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, 1024, 768);
  roundRectPath(ctx, x0, y0, x1, y1, 16); ctx.fillStyle = "#6b6258"; ctx.fill();
  roundRectPath(ctx, x0 + 14, y0 + 14, x1 - 14, y1 - 14, 10); ctx.fillStyle = "#2c2a28"; ctx.fill();
  bevelRect(ctx, x0 + 14, y0 + 14, x1 - 14, y1 - 14, "#1a1918", "#8d847a", 2);
  drawText(ctx, t("gameTitle", lang), 512, y0 + 30, { scale: 3, bold: true, outline: true, color: "#f0d890", align: "center" });
  const items = menu.items;
  const top = menu.screen === SCREEN.TITLE ? 300 : 170;
  const step = menu.screen === SCREEN.TITLE ? 48 : 40;
  items.forEach((it, i) => {
    const y = top + i * step;
    const focused = i === menu.focus;
    const row = { x0: x0 + 120, y0: y, x1: x1 - 120, y1: y + 30 };
    roundRectPath(ctx, row.x0, row.y0, row.x1, row.y1, 12);
    ctx.fillStyle = focused ? "#e8dc9a" : "#5d5752"; ctx.fill();
    const color = focused ? "#1a1208" : "#f2eee6";
    if (it.values) {
      drawText(ctx, t(it.label, lang), row.x0 + 20, y + 15 - 7, { bold: true, color, outline: false });
      drawText(ctx, `< ${valueText(it, menu.settings[it.id], lang)} >`, row.x1 - 20, y + 15 - 7, { bold: true, color, align: "right" });
    } else {
      drawTextIn(ctx, t(it.label, lang), row, { bold: true, color });
    }
  });
}
