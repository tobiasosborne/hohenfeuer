// dev/ui.js - owns the HUD harness logic: query-param pose -> fake view -> createHud().draw, plus a small debug hook.
// Query: ?pose=hud-weapon-view|hud-walking|menu-title|menu-skirmish &bg=magenta|sky &lang=de|en
// No clock, no randomness: one draw per pose, so screenshots are pixel-stable.

import { createHud } from "../src/ui/hud.js";
import { demoView } from "../src/ui/demo.js";
import { createMenu, SCREEN } from "../src/ui/menus.js";

/** Stand-in map list (the harness does not load the plugin registry). */
const MAPS = [{ id: "forest-duel", name: { de: "Waldduell", en: "Forest duel" }, slots: [{ castle: "default" }, { castle: "default" }], wind: { strength: 2, change: 2 }, startGold: 1500 }];

const q = new URLSearchParams(location.search);
const state = { pose: q.get("pose") || "hud-weapon-view", bg: q.get("bg") || "magenta", lang: q.get("lang") || "de" };
const bg = document.getElementById("bg");
const hudCanvas = document.getElementById("hud");
const hud = createHud(hudCanvas);

function viewFor(pose) {
  if (pose.startsWith("menu-")) {
    const menu = createMenu({ maps: MAPS, screen: pose === "menu-skirmish" ? SCREEN.SKIRMISH : SCREEN.MAIN, options: { lang: state.lang } });
    return { ...demoView("hud-walking", { lang: state.lang }), menu };
  }
  return demoView(pose, { lang: state.lang });
}

function paintBackground() {
  const c = bg.getContext("2d");
  if (state.bg === "sky") {
    const g = c.createLinearGradient(0, 0, 0, bg.height);
    g.addColorStop(0, "#3b6ea8"); g.addColorStop(0.55, "#9cc0e0"); g.addColorStop(0.56, "#5f8a3c"); g.addColorStop(1, "#3e5f26");
    c.fillStyle = g;
  } else c.fillStyle = "#ff00ff";
  c.fillRect(0, 0, bg.width, bg.height);
}

function render() {
  for (const cv of [bg, hudCanvas]) { cv.width = window.innerWidth; cv.height = window.innerHeight; }
  paintBackground();
  hud.draw(viewFor(state.pose));
}

window.__hohenfeuer = {
  ready: false,
  /** Accepts a pose name or a scripts/goldens.mjs pose object ({pose?, page, width, height}). */
  setPose(p) {
    if (typeof p === "string") state.pose = p;
    else if (p && typeof p.pose === "string") state.pose = p.pose;
    render();
  },
  render,
  hud,
};
window.addEventListener("resize", render);
render();
window.__hohenfeuer.ready = true;
