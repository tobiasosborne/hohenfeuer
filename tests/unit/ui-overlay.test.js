// tests/unit/ui-overlay.test.js - owns NPC job markers, speech bubbles and the morale band (src/ui/overlay.js) tests.
import test from "node:test";
import assert from "node:assert/strict";
import { EV, JOB, NPC_STATE, ROLE } from "../../src/contracts.js";
import { TUNING } from "../../src/tuning.js";
import { MARKER, npcMarker, createBubbles, drawOverlays, moraleBand, BUBBLE_LIFE_TICKS } from "../../src/ui/overlay.js";

const npc = (o) => ({ id: 10, slot: 0, castle: 0, role: ROLE.MASON, state: NPC_STATE.IDLE, hp: 100, carrying: 0, jobId: null, pos: { x: 0, y: 1, z: 0 }, ...o });

test("job markers: hammer for working masons, shell for ammo runners, flame for fleeing, bed for sheltering", () => {
  assert.equal(npcMarker(npc({ state: NPC_STATE.WORK, jobId: 1 }), JOB.BUILD), MARKER.HAMMER);
  assert.equal(npcMarker(npc({ state: NPC_STATE.WALK, jobId: 1 }), JOB.REPAIR), MARKER.HAMMER);
  assert.equal(npcMarker(npc({ role: ROLE.RUNNER, state: NPC_STATE.WALK, carrying: 1 }), null), MARKER.SHELL);
  assert.equal(npcMarker(npc({ role: ROLE.CREW, state: NPC_STATE.WALK, jobId: 2 }), JOB.HAUL_AMMO), MARKER.SHELL);
  assert.equal(npcMarker(npc({ state: NPC_STATE.FLEE }), null), MARKER.FLAME);
  assert.equal(npcMarker(npc({ role: ROLE.CIVILIAN, state: NPC_STATE.SHELTER }), null), MARKER.BED);
  assert.equal(npcMarker(npc({ state: NPC_STATE.IDLE }), null), null);
  assert.equal(npcMarker(npc({ state: NPC_STATE.FLEE, hp: 0 }), null), null);
});

function world() {
  return {
    tick: 100,
    castles: [{ id: 0, slot: 0, plot: { origin: { x: 100, y: 0, z: 100 } } }, { id: 1, slot: 1, plot: { origin: { x: 300, y: 0, z: 100 } } }],
    weapons: [{ id: 5, slot: 0, pos: { x: 120, y: 8, z: 120 } }],
    npcs: [
      npc({ id: 10, role: ROLE.MASON, pos: { x: 110, y: 1, z: 110 } }),
      npc({ id: 11, role: ROLE.MASON, pos: { x: 140, y: 1, z: 140 } }),
      npc({ id: 12, role: ROLE.RUNNER, jobId: 77, pos: { x: 118, y: 8, z: 121 } }),
      npc({ id: 13, role: ROLE.CREW, pos: { x: 121, y: 8, z: 120 } }),
      npc({ id: 14, role: ROLE.CIVILIAN, pos: { x: 105, y: 1, z: 105 } }),
      npc({ id: 20, slot: 1, castle: 1, role: ROLE.CREW, pos: { x: 320, y: 8, z: 120 } }),
    ],
  };
}

test("bubbles: event -> the right own NPC says a short line for 2 s; cooldown per line; enemies stay silent", () => {
  const b = createBubbles();
  const s = world();
  b.onEvents([
    { type: EV.JOB_CLAIMED, payload: { jobId: 77, kind: JOB.HAUL_AMMO, castle: 0 } },
    { type: EV.BLOCK_BUILT, payload: { plot: 0, cell: [10, 1, 10], id: 1 } },
    { type: EV.SHELTER_TOGGLED, payload: { slot: 0, on: true } },
    { type: EV.WEAPON_LOADED, payload: { weaponId: 5 } },
    { type: EV.NPC_FLED, payload: { entityId: 20, castle: 1 } },
  ], s, { slot: 0, lang: "de" });
  const v = b.visible(100);
  const said = Object.fromEntries(v.map((x) => [x.entityId, x.text]));
  assert.equal(said[12], "Munition!");
  assert.equal(said[10], "Mauer steht!", "nearest mason to the built cell");
  assert.equal(said[14], "Deckung!");
  assert.equal(said[13], "Geladen!");
  assert.equal(said[20], undefined);
  assert.equal(b.visible(100 + BUBBLE_LIFE_TICKS - 1).length, v.length);
  assert.equal(b.visible(100 + BUBBLE_LIFE_TICKS).length, 0, "2 s lifetime");
  b.onEvents([{ type: EV.SHELTER_TOGGLED, payload: { slot: 0, on: true } }], { ...s, tick: 110 }, { slot: 0, lang: "de" });
  assert.equal(b.visible(110).filter((x) => x.text === "Deckung!").length, 1, "cooldown");
  assert.equal(BUBBLE_LIFE_TICKS, 2 * TUNING.sim.tickHz);
});

test("morale band follows TUNING.morale.workBands", () => {
  const bands = TUNING.morale.workBands;
  assert.equal(moraleBand(100).index, 0);
  assert.equal(moraleBand(bands[1][0]).index, 1);
  assert.equal(moraleBand(bands[1][0] - 0.01).index, 2);
  assert.equal(moraleBand(0).index, bands.length - 1);
  assert.ok(moraleBand(50).color.startsWith("#"));
  assert.equal(moraleBand(80, "de").name, "Mutig");
});

test("drawOverlays draws icons and bubbles and notes the bubble text", () => {
  const calls = [];
  const ctx = new Proxy({ canvas: { width: 1024, height: 768 } }, {
    get(t, k) { if (k in t) return t[k]; return (...a) => calls.push(k); },
    set(t, k, v) { t[k] = v; return true; },
  });
  const texts = [];
  drawOverlays(ctx, { markers: Object.values(MARKER).map((icon, i) => ({ x: 100 + i * 40, y: 200, icon, scale: 1 })), bubbles: [{ x: 300, y: 300, text: "Munition!" }] }, (s) => texts.push(s));
  assert.ok(calls.length > 20);
  assert.deepEqual(texts, ["Munition!"]);
});
