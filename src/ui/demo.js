// src/ui/demo.js - owns the fake HUD views used by the dev harness (dev/ui.html), the HUD golden and the unit tests.
// Pure: synthetic castle overview codes are generated from integer rules, no sim needed.

import { CAMERA_MODE } from "../contracts.js";
import { TUNING } from "../tuning.js";
import { t } from "./i18n.js";
import { MAP_CODE } from "./minimap.js";

/** A 48 x 48 overview: curtain wall ring, corner towers, keep, a few weapons and damage. */
export function demoMinimap(variant = 0) {
  const w = TUNING.world.plotW, d = TUNING.world.plotD;
  const codes = new Uint8Array(w * d);
  const set = (x, z, c) => { if (x >= 0 && x < w && z >= 0 && z < d) codes[x + w * z] = c; };
  const lo = 12 + variant * 2, hi = 35 - variant;
  for (let i = lo; i <= hi; i++) for (let k = 0; k < 3; k++) {
    set(i, lo + k, MAP_CODE.BLOCK); set(i, hi - k, MAP_CODE.BLOCK); set(lo + k, i, MAP_CODE.BLOCK); set(hi - k, i, MAP_CODE.BLOCK);
  }
  for (const [cx, cz] of [[lo, lo], [hi, lo], [lo, hi], [hi, hi]]) for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) set(cx + a, cz + b, MAP_CODE.BLOCK);
  for (let x = 20; x <= 27; x++) for (let z = 20; z <= 27; z++) set(x, z, MAP_CODE.BLOCK);
  for (let i = 0; i < 5; i++) set(lo + 6 + i, lo, i < 2 ? MAP_CODE.DAMAGED2 : MAP_CODE.DAMAGED1);
  set(lo + 9, hi, MAP_CODE.DAMAGED3);
  for (const [x, z] of [[lo + 1, lo + 10], [hi - 1, lo + 12]]) set(x, z, MAP_CODE.WEAPON);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) set(30 + a, 30 + b, MAP_CODE.WEAPON);
  for (const [x, z] of [[5, 6], [40, 8], [6, 40], [42, 41]]) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) set(x + a, z + b, MAP_CODE.BLOCK);
  return { w, d, codes };
}

/**
 * Named demo views. `hud-weapon-view` is the Phase 1 (11) golden pose: cannon, dial 000/038,
 * wind 12 m/s, reload 40%.
 * @param {string} name @param {{lang?: string}} [o]
 */
export function demoView(name, o = {}) {
  const lang = o.lang || "de";
  const common = {
    lang, tick: 0,
    gold: TUNING.economy.startGold, pop: { now: 40, start: 40 }, weapons: { now: 2, cap: TUNING.world.weaponCapDefault },
    wind: { speed: 12, dirDeg: 65, prevDirDeg: 20 },
    enemies: [{ bearingDeg: 8, ally: false, color: "#34c034" }],
    enemyLabel: { title: t("enemy", lang), name: "Kunibert I", castle: "Waldburg", color: "#3cc83c" },
    messages: [],
    minimapOwn: demoMinimap(0),
    minimapEnemy: { ...demoMinimap(1), craters: [{ x: 17, z: 22, r: 1.5 }], missArrowDeg: null },
  };
  if (name === "hud-walking") {
    return {
      ...common, mode: CAMERA_MODE.WALK, heading: 30,
      morale: { value: 70 }, selection: { name: "Stein", cost: TUNING.blocks.stone.cost }, shelterOn: false,
      messages: [{ text: t("windChanged", lang), tone: "info" }],
      reticle: {},
    };
  }
  return {
    ...common, mode: CAMERA_MODE.WEAPON, heading: 0,
    weapon: {
      name: t("cannon", lang), hpPct: 100, az: 0, range: 380, reload: 0.4, loaded: false,
      fireCost: TUNING.weapons.cannon.fireCost, affordable: true, autoFire: false, crewOrdered: false, restoreLit: false,
    },
    reticle: { predicted: [512, 384] },
  };
}
