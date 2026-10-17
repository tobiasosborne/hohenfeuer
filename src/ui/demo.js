// src/ui/demo.js - owns the fake HUD views used by the dev harness (dev/ui.html), the HUD golden and the unit tests.
// Pure: synthetic castle overview codes are generated from integer rules, no sim needed.

import { CAMERA_MODE } from "../contracts.js";
import { TUNING } from "../tuning.js";
import { fixedElevation, traceFlight } from "../sim/ballistics.js";
import { t } from "./i18n.js";
import { MAP_CODE } from "./minimap.js";

/** A 48 x 48 overview: one-cell curtain wall, corner towers, keep, a few houses and weapons, some damage. */
export function demoMinimap(variant = 0) {
  const w = TUNING.world.plotW, d = TUNING.world.plotD;
  const codes = new Uint8Array(w * d);
  const set = (x, z, c) => { if (x >= 0 && x < w && z >= 0 && z < d) codes[x + w * z] = c; };
  const box = (x0, z0, x1, z1, c) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) set(x, z, c); };
  const lo = 14 + variant * 2, hi = 33 - variant;
  for (let i = lo; i <= hi; i++) { set(i, lo, MAP_CODE.BLOCK); set(i, hi, MAP_CODE.BLOCK); set(lo, i, MAP_CODE.BLOCK); set(hi, i, MAP_CODE.BLOCK); }
  for (const [cx, cz] of [[lo, lo], [hi, lo], [lo, hi], [hi, hi]]) box(cx - 1, cz - 1, cx + 1, cz + 1, MAP_CODE.BLOCK);
  box(20, 20, 27, 27, MAP_CODE.BLOCK);
  for (let i = 0; i < 4; i++) set(lo + 6 + i, lo, i < 2 ? MAP_CODE.DAMAGED2 : MAP_CODE.DAMAGED1);
  set(lo + 9, hi, MAP_CODE.DAMAGED3);
  box(hi - 1, lo - 1, hi + 1, lo + 1, MAP_CODE.WEAPON);
  box(36, 6, 38, 8, MAP_CODE.WEAPON);
  for (const [x, z] of [[6, 10], [8, 30], [30, 38], [40, 26], [10, 40], [24, 40]]) box(x, z, x + 1, z + 1, MAP_CODE.BLOCK);
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
    lang, tick: 0, incomeRate: TUNING.economy.palaceIncomeS + 20 * TUNING.economy.civilianIncomeS,
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
      target: { name: t("cannon", lang), hpPct: 100 },
      minimapEnemy: null, // castle view: no enemy targeted, the overview stays dark (as the original)
      messages: [{ text: t("windChanged", lang), tone: "info" }],
      reticle: {},
    };
  }
  return {
    ...common, mode: CAMERA_MODE.WEAPON, heading: 0,
    weapon: {
      name: t("cannon", lang), hpPct: 100, az: 0, range: 380, reload: 0.4, loaded: false,
      rangeM: traceFlight({ ...TUNING.weapons.cannon, charge: 38, elevation: fixedElevation(TUNING.weapons.cannon) }).range,
      fireCost: TUNING.weapons.cannon.fireCost, affordable: true, autoFire: false, crewOrdered: false, restoreLit: false,
    },
    messages: [{ text: t("windChanged", lang), tone: "info" }],
    reticle: { predicted: [512, 384] },
  };
}
