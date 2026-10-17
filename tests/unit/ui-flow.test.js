// tests/unit/ui-flow.test.js - owns boot-routing and settings->match tests for src/ui/flow.js (title screen vs match boot).
import test from "node:test";
import assert from "node:assert/strict";
import { CONTROLLER, validateSlot } from "../../src/contracts.js";
import { TUNING } from "../../src/tuning.js";
import { resolveBoot, defaultSettings, settingsToMatch, flowRecord, FLOW_KEY } from "../../src/ui/flow.js";

const MAP = Object.freeze({
  id: "forest-duel", name: { de: "Waldduell", en: "Forest duel" }, slots: [{ castle: "default" }, { castle: "default" }],
  wind: { strength: 2, change: 2 }, startGold: 1500, weaponCap: 4,
});
const params = (s) => new URLSearchParams(s);

test("bare URL opens the title menu; golden/demo/play URLs keep booting a match directly", () => {
  assert.deepEqual(resolveBoot(params(""), null), { kind: "frontend", screen: "main", golden: false, settings: null });
  assert.equal(resolveBoot(params("golden=1"), null).kind, "match");
  assert.equal(resolveBoot(params("golden=1"), null).settings, null, "golden match uses the TB1 defaults");
  assert.equal(resolveBoot(params("demo=tb2"), null).kind, "match");
  assert.equal(resolveBoot(params("demo=1&speed=2"), null).kind, "match");
  assert.equal(resolveBoot(params("play=1"), null).kind, "match");
  assert.deepEqual(resolveBoot(params("golden=1&screen=skirmish"), null), { kind: "frontend", screen: "skirmish", golden: true, settings: null });
  assert.equal(resolveBoot(params("screen=bogus"), null).screen, "main");
});

test("session hand-off: start a match, restart it, or come back to setup/title", () => {
  const s = defaultSettings([MAP]);
  const m = resolveBoot(params(""), flowRecord("match", s));
  assert.equal(m.kind, "match"); assert.deepEqual(m.settings, s);
  const back = resolveBoot(params(""), flowRecord("skirmish", s));
  assert.equal(back.kind, "frontend"); assert.equal(back.screen, "skirmish"); assert.deepEqual(back.settings, s);
  assert.equal(resolveBoot(params(""), flowRecord("main", null)).screen, "main");
  assert.equal(resolveBoot(params(""), "{broken").kind, "frontend");
  assert.equal(typeof FLOW_KEY, "string");
  // URL params win over the session record
  assert.equal(resolveBoot(params("golden=1"), flowRecord("skirmish", s)).kind, "match");
});

test("default settings come from the map and tuning", () => {
  const s = defaultSettings([MAP]);
  assert.equal(s.map, "forest-duel");
  assert.equal(s.seed, 1);
  assert.equal(s.windStrength, MAP.wind.strength); assert.equal(s.windChange, MAP.wind.change);
  assert.equal(s.startGold, MAP.startGold);
  assert.equal(s.slots.length, 2);
  assert.equal(s.slots[0].controller, CONTROLLER.LOCAL);
  assert.equal(s.slots[1].controller, CONTROLLER.AI);
  assert.equal(s.slots[1].aiLevel, TUNING.ai.defaultLevel);
});

test("settingsToMatch builds a map copy with wind/gold and contract-valid slots", () => {
  const s = defaultSettings([MAP]);
  s.windStrength = 4; s.windChange = 0; s.startGold = 3000; s.seed = 77;
  s.slots[0] = { ...s.slots[0], controller: CONTROLLER.AI, aiLevel: 9, tactic: "daredevil" };
  const m = settingsToMatch(s, MAP);
  assert.equal(m.seed, 77);
  assert.deepEqual(m.map.wind, { strength: 4, change: 0 });
  assert.equal(m.map.startGold, 3000);
  assert.equal(m.map.id, MAP.id);
  assert.equal(MAP.startGold, 1500, "registered map untouched");
  assert.equal(m.slots.length, 2);
  for (const slot of m.slots) assert.equal(validateSlot(slot), true);
  assert.equal(m.slots[0].controller, CONTROLLER.AI); assert.equal(m.slots[0].aiLevel, 9); assert.equal(m.slots[0].aiTactic, "daredevil");
  assert.equal(m.slots[0].castleId, "default");
  assert.notEqual(m.slots[0].team, m.slots[1].team);
});

import { matchResult } from "../../src/ui/flow.js";

test("matchResult turns sim stats and the outcome into end-screen rows", () => {
  const stats = (shots, hits, dmg, losses) => ({ shots, directHits: hits, damageDp: dmg, damageGold: 0, losses, ammoCosts: 0, income: 0, eliminatedTick: null });
  const state = { tick: 3930, outcome: { winners: [1], draw: false, tick: 3900 },
    castles: [{ slot: 0, stats: stats(4, 2, 48, 3) }, { slot: 1, stats: stats(6, 5, 120, 0) }] };
  const s = defaultSettings([MAP]);
  const r = matchResult(state, 0, s);
  assert.equal(r.won, false); assert.equal(r.draw, false);
  assert.equal(r.durationS, 3900 / 30);
  assert.equal(r.winnerName, s.slots[1].name);
  assert.deepEqual(r.rows.map((x) => [x.slot, x.name, x.shots, x.hits, x.damage, x.losses]),
    [[0, s.slots[0].name, 4, 2, 48, 3], [1, s.slots[1].name, 6, 5, 120, 0]]);
  const d = matchResult({ ...state, outcome: { winners: [], draw: true, tick: 30 } }, 0, s);
  assert.equal(d.draw, true); assert.equal(d.winnerName, null);
  assert.equal(matchResult({ ...state, outcome: { winners: [0], draw: false, tick: 30 } }, 0, null).won, true);
});
