// src/ui/flow.js - owns match flow routing: which screen a page load opens (title menu or match), skirmish settings and their mapping to createSim input.
// Pure. The session record (sessionStorage, written before a reload) carries the hand-off between
// the title menu, a running match (restart) and the setup screen after a match.

import { CONTROLLER, TACTIC } from "../contracts.js";
import { TUNING } from "../tuning.js";

export const FLOW_KEY = "hohenfeuer.flow";
const FRONT_SCREENS = ["main", "skirmish", "options", "credits", "tutorial", "splash"];
const SLOT_COLORS = [0xc02828, 0x2860c0, 0x28a040, 0xc0a020];
const DEFAULT_NAMES = ["Spieler", "Kunibert", "Adelheid", "Gottfried"];

/** Serialised session record: next = 'match' | 'skirmish' | 'main', with the settings to carry. */
export function flowRecord(next, settings) { return JSON.stringify({ next, settings: settings ?? null }); }

/**
 * Decide what this page load shows. URL params win (golden/demo/play boot a match directly, so the
 * debug API, demo scripts and goldens keep working; golden=1&screen=<id> renders a menu screen).
 * @param {{get: (k: string) => string|null}} params @param {string|null} record session flow record
 * @returns {{kind: 'match'|'frontend', screen?: string, golden?: boolean, settings: object|null}}
 */
export function resolveBoot(params, record) {
  const golden = params.get("golden") === "1";
  const screen = params.get("screen");
  if (screen !== null) return { kind: "frontend", screen: FRONT_SCREENS.includes(screen) ? screen : "main", golden, settings: null };
  if (golden || params.get("demo") !== null || params.get("play") === "1") return { kind: "match", settings: null };
  let rec = null;
  try { rec = record ? JSON.parse(record) : null; } catch { rec = null; }
  if (rec && rec.next === "match" && rec.settings) return { kind: "match", settings: rec.settings };
  if (rec && rec.next === "skirmish") return { kind: "frontend", screen: "skirmish", golden: false, settings: rec.settings ?? null };
  return { kind: "frontend", screen: "main", golden: false, settings: null };
}

/** Skirmish defaults for the first registered map: slot 0 human, the rest AI at the default level. */
export function defaultSettings(maps) {
  const m = maps[0];
  return {
    map: m.id, seed: 1,
    windStrength: m.wind?.strength ?? TUNING.wind.defaultStrength, windChange: m.wind?.change ?? TUNING.wind.defaultChange,
    startGold: m.startGold ?? TUNING.economy.startGold,
    slots: m.slots.map((_, i) => ({
      name: DEFAULT_NAMES[i] ?? `KI ${i}`, controller: i === 0 ? CONTROLLER.LOCAL : CONTROLLER.AI,
      aiLevel: TUNING.ai.defaultLevel, tactic: TACTIC.GENERAL,
    })),
  };
}

/**
 * Settings -> createSim({map, seed, slots}) input: a copy of the map with the chosen wind and start
 * gold, and one contract Slot per map slot (one team each).
 * @param {object} s settings @param {object} mapDef registered MapDef
 */
export function settingsToMatch(s, mapDef) {
  const map = { ...mapDef, wind: { strength: s.windStrength, change: s.windChange }, startGold: s.startGold };
  const slots = mapDef.slots.map((ms, i) => {
    const p = s.slots[i] ?? { controller: CONTROLLER.AI, aiLevel: TUNING.ai.defaultLevel, tactic: TACTIC.GENERAL };
    return {
      id: i, castleId: ms.castle, team: i, color: SLOT_COLORS[i],
      controller: i === 0 && p.controller === CONTROLLER.LOCAL ? CONTROLLER.LOCAL : CONTROLLER.AI,
      aiLevel: p.aiLevel, aiTactic: p.tactic,
    };
  });
  return { map, seed: s.seed >>> 0, slots };
}

/**
 * End-screen data from the sim's per-castle stats and outcome (DESIGN 3.7): shots, direct hits,
 * damage dealt (defence points), losses, duration, winner.
 * @param {{tick: number, outcome: {winners: number[], draw: boolean, tick?: number}, castles: Array<{slot: number, stats: object}>}} state
 * @param {number} me local slot @param {object|null} settings skirmish settings (names), null for defaults
 */
export function matchResult(state, me, settings) {
  const o = state.outcome ?? { winners: [], draw: true };
  const names = (settings?.slots ?? []).map((s) => s.name);
  const nameOf = (slot) => names[slot] ?? DEFAULT_NAMES[slot] ?? `KI ${slot}`;
  const rows = state.castles.map((c) => ({
    slot: c.slot, name: nameOf(c.slot), shots: c.stats?.shots ?? 0, hits: c.stats?.directHits ?? 0,
    damage: Math.round(c.stats?.damageDp ?? 0), losses: c.stats?.losses ?? 0,
  }));
  return {
    won: !o.draw && o.winners.includes(me), draw: !!o.draw,
    winnerName: !o.draw && o.winners.length ? nameOf(o.winners[0]) : null,
    durationS: (o.tick ?? state.tick) / TUNING.sim.tickHz, rows,
  };
}
