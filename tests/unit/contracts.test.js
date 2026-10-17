// tests/unit/contracts.test.js - owns registration, validation and enum checks for src/contracts.js.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as C from "../../src/contracts.js";
import { TUNING } from "../../src/tuning.js";

const name = (en) => ({ de: en, en });

function blockDef(key, extra = {}) {
  const t = TUNING.blocks[key];
  return {
    id: C.BLOCK[key.toUpperCase()], key, name: name(key), hp: t.hp, cost: t.cost, buildS: t.buildS,
    solid: true, walkOn: true, passable: false, projectileSolid: true, climbable: false,
    burnable: false, oriented: false, collider: "cube", mapOnly: t.cost === null, ...extra,
  };
}

function weaponDef(id = "cannon", extra = {}) {
  const t = TUNING.weapons[id];
  return {
    id, name: name(id), mount: t.mount, footprint: t.mount === "wall" ? [1, 1, 1] : [3, 3, 2],
    cost: t.cost, hp: t.hp, reloadS: t.reloadS, crewSlots: t.crewSlots, fireCost: t.fireCost,
    ammoLoads: 1, traj: t.traj,
    elevDeg: t.traj === "lobbed" ? [...TUNING.aim.lobbedElevDeg] : [...TUNING.aim.straightElevDeg],
    v0: t.v0, k: t.k, scatter: { azDeg: t.sAzDeg, vFrac: t.sV },
    shot: { count: t.count, intervalS: t.intervalS, spreadDeg: t.spreadDeg, radius: t.projRadius,
      direct: t.direct, splash: t.splash, splashRadius: t.splashRadius, ignite: t.ignite, pierce: t.pierce },
    ...extra,
  };
}

function npcDef(extra = {}) {
  return { id: "gunner", role: C.ROLE.CREW, hp: 100, speed: 3, carrySpeed: 2, climbSpeed: 1,
    jobs: [C.JOB.CREW, C.JOB.HAUL_AMMO], flee: { base: 10, spread: 10 }, workMul: 1, share: 0.4, ...extra };
}

function castleDef(extra = {}) {
  return {
    id: "tiny", size: [3, 2, 2], legend: { "#": "stone" },
    layers: [["###", "#.#"], ["#..", "..."]],
    weapons: [], mountSpots: [], shelters: [[0, 1, 0, 2, 2, 1]], workSpots: [[1, 1, 1]],
    exit: [1, 1, 1], rulerSpawn: [1, 1, 1], throne: [1, 1, 1], population: 40, ...extra,
  };
}

function mapDef(extra = {}) {
  return {
    id: "duel", name: name("Duel"), biome: "forest", size: [384, 256],
    slots: [{ origin: [0, 0, 0], facingDeg: 90, castle: "tiny" }, { origin: [192, 0, 0], facingDeg: 270, castle: "tiny" }],
    terrain: { amp: 6, octaves: 3, ridge: null }, water: null, wind: { strength: 2, change: 2 },
    startGold: 2000, weaponCap: 4, suddenDeathS: null, ...extra,
  };
}

const biomeDef = () => ({ id: "forest", terrainPalette: { grass: 1 }, props: [] });

function registerBasics() {
  C.registerBlock(blockDef("air", { solid: false, walkOn: false, passable: true, projectileSolid: false, collider: "none" }));
  C.registerBlock(blockDef("stone"));
  C.registerWeapon(weaponDef());
  C.registerNpcType(npcDef());
  C.registerCastle(castleDef());
  C.registerBiome(biomeDef());
  C.registerMap(mapDef());
}

test("contracts.js is pure: no three.js or DOM imports", () => {
  const src = readFileSync(new URL("../../src/contracts.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /from\s+["']three/);
  assert.doesNotMatch(src, /\b(window|document|Math\.random|Date\.now|performance\.now)\b/);
});

test("enums are frozen and their values unique", () => {
  for (const e of ["BLOCK", "MOUNT", "TRAJ", "ROLE", "JOB", "NPC_STATE", "CMD", "EV", "CONTROLLER",
    "TACTIC", "FACING", "ELIM", "CAMERA_MODE", "RNG_STREAM", "PLUGIN_KIND"]) {
    const v = C[e];
    assert.ok(v && Object.isFrozen(v), `${e} must be a frozen object`);
    const vals = Object.values(v);
    assert.equal(new Set(vals).size, vals.length, `${e} values must be unique`);
  }
  assert.equal(C.EVENTS, C.EV);
});

test("every core block in TUNING has a BLOCK id below 64, and vice versa", () => {
  assert.deepEqual(Object.keys(C.BLOCK).map((k) => k.toLowerCase()).sort(), Object.keys(TUNING.blocks).sort());
  for (const id of Object.values(C.BLOCK)) assert.ok(id >= 0 && id <= C.K.CORE_BLOCK_MAX);
  assert.equal(C.BLOCK.AIR, 0);
  assert.equal(C.BLOCK.FOUNDATION, 13);
});

test("K is derived from TUNING", () => {
  assert.equal(C.K.DT, 1 / 30);
  assert.equal(C.K.SUBSTEPS, 4);
  assert.equal(C.K.CELLS_PER_PLOT, 48 * 48 * 24);
  assert.equal(C.K.DIAL_UNIT_M, 5);
  assert.ok(Object.isFrozen(C.K));
});

test("registration round-trips and stored defs are frozen", () => {
  C.resetRegistriesForTests();
  registerBasics();
  assert.equal(C.getBlock(C.BLOCK.STONE).key, "stone");
  assert.equal(C.getBlockByKey("stone").hp, 40);
  assert.equal(C.getWeapon("cannon").reloadS, 22);
  assert.equal(C.getNpcType("gunner").role, C.ROLE.CREW);
  assert.equal(C.getCastle("tiny").size[0], 3);
  assert.equal(C.getMap("duel").slots.length, 2);
  assert.equal(C.getBiome("forest").id, "forest");
  assert.ok(Object.isFrozen(C.getWeapon("cannon").shot));
  assert.deepEqual(C.listPlugins(C.PLUGIN_KIND.BLOCK).map((b) => b.key), ["air", "stone"]);
  assert.equal(C.getWeapon("nope"), null);
});

test("registerPlugin dispatches by kind and rejects unknown kinds and spells", () => {
  C.resetRegistriesForTests();
  C.registerPlugin(C.PLUGIN_KIND.WEAPON, weaponDef("catapult"));
  assert.equal(C.getWeapon("catapult").traj, C.TRAJ.LOBBED);
  assert.throws(() => C.registerPlugin("zeppelin", {}), /unknown plugin kind "zeppelin"/);
  assert.throws(() => C.registerSpell({ id: "rain" }), /reserved/);
});

test("duplicates are rejected", () => {
  C.resetRegistriesForTests();
  C.registerWeapon(weaponDef());
  assert.throws(() => C.registerWeapon(weaponDef()), /duplicate weapon id "cannon"/);
  C.registerBlock(blockDef("stone"));
  assert.throws(() => C.registerBlock(blockDef("stone")), /duplicate block/);
});

test("freezeRegistries returns a stable hash and blocks later registration", () => {
  C.resetRegistriesForTests();
  registerBasics();
  const h1 = C.freezeRegistries();
  assert.match(h1, /^[0-9a-f]{8}$/);
  assert.ok(C.isFrozen());
  assert.equal(C.registryHash(), h1);
  assert.throws(() => C.registerWeapon(weaponDef("catapult")), /frozen/);

  C.resetRegistriesForTests();
  registerBasics();
  assert.equal(C.freezeRegistries(), h1, "same plugin set, same hash");

  C.resetRegistriesForTests();
  C.registerBlock(blockDef("air", { solid: false, walkOn: false, passable: true, projectileSolid: false, collider: "none" }));
  C.registerBlock(blockDef("stone"));
  C.registerWeapon(weaponDef("cannon", { reloadS: 21 }));
  C.registerNpcType(npcDef());
  C.registerCastle(castleDef());
  C.registerBiome(biomeDef());
  C.registerMap(mapDef());
  assert.notEqual(C.freezeRegistries(), h1, "changed number, changed hash");
});

test("freeze cross-checks references", () => {
  C.resetRegistriesForTests();
  C.registerBlock(blockDef("stone"));
  C.registerCastle(castleDef({ legend: { "#": "marble" } }));
  assert.throws(() => C.freezeRegistries(), /castle "tiny": legend "#" -> unknown block key "marble"/);

  C.resetRegistriesForTests();
  C.registerBlock(blockDef("stone"));
  C.registerBiome(biomeDef());
  C.registerMap(mapDef());
  assert.throws(() => C.freezeRegistries(), /map "duel": slots\[0\]\.castle -> unknown castle "tiny"/);

  C.resetRegistriesForTests();
  C.registerWeaponView("cannon", { model: "assets/weapons/cannon.glb",
    nodes: { yaw: "Yaw", pitch: "Pitch", muzzle: "Muzzle", sight: "Sight" },
    fx: { muzzle: "smoke", trail: "none", impact: "dust" }, sfx: { fire: "boom", impact: "thud" } });
  assert.throws(() => C.freezeRegistries(), /weapon view "cannon" has no weapon def/);
});

test("validators reject malformed weapons with precise messages", () => {
  assert.doesNotThrow(() => C.validateWeaponPlugin(weaponDef()));
  const { v0, ...noV0 } = weaponDef();
  assert.throws(() => C.validateWeaponPlugin(noV0), /weapon "cannon": field "v0" is required/);
  assert.throws(() => C.validateWeaponPlugin(weaponDef("cannon", { v0: -1 })), /weapon "cannon": field "v0" must be a number > 0 \(got -1\)/);
  assert.throws(() => C.validateWeaponPlugin(weaponDef("cannon", { colour: "red" })), /weapon "cannon": unknown field "colour"/);
  assert.throws(() => C.validateWeaponPlugin(weaponDef("cannon", { mount: "roof" })), /field "mount" must be one of/);
  assert.throws(() => C.validateWeaponPlugin(weaponDef("cannon", { footprint: [3, 3, 2] })), /wall weapons have footprint \[1,1,1\]/);
  assert.throws(() => C.validateWeaponPlugin(weaponDef("catapult", { elevDeg: [0, 25] })), /lobbed weapons need elevDeg\[0\] >= 45/);
  assert.throws(() => C.validateWeaponPlugin(weaponDef("cannon", { onFire: 3 })), /field "onFire" must be a function/);
  assert.throws(() => C.validateWeaponPlugin(weaponDef("cannon", { id: "Cannon!" })), /field "id"/);
  const bad = weaponDef();
  bad.shot = { ...bad.shot, count: 0 };
  assert.throws(() => C.validateWeaponPlugin(bad), /field "shot.count" must be an integer >= 1/);
  assert.throws(() => C.validateWeaponPlugin(null), /weapon: definition must be an object/);
});

test("validators reject malformed blocks, npc types, castles and maps", () => {
  assert.doesNotThrow(() => C.validateBlockPlugin(blockDef("stone")));
  assert.throws(() => C.validateBlockPlugin(blockDef("stone", { id: 2 })), /core block id 2 must have key "tower"/);
  assert.throws(() => C.validateBlockPlugin(blockDef("stone", { hp: 300 })), /field "hp" must be an integer in 0\.\.255/);
  assert.throws(() => C.validateBlockPlugin(blockDef("stone", { id: 70, key: "tower" })), /plugin block key "tower" collides with a core block/);
  assert.throws(() => C.validateBlockPlugin(blockDef("stone", { collider: "sphere" })), /field "collider" must be one of/);

  assert.doesNotThrow(() => C.validateNpcTypePlugin(npcDef()));
  assert.throws(() => C.validateNpcTypePlugin(npcDef({ jobs: [] })), /field "jobs" must be a non-empty array/);
  assert.throws(() => C.validateNpcTypePlugin(npcDef({ jobs: ["dance"] })), /field "jobs\[0\]" must be one of/);
  assert.throws(() => C.validateNpcTypePlugin(npcDef({ share: 2 })), /field "share" must be a number in 0\.\.1/);

  assert.doesNotThrow(() => C.validateCastlePlugin(castleDef()));
  assert.throws(() => C.validateCastlePlugin(castleDef({ layers: [["##", "#.#"]] })), /castle "tiny": layers\[0\]\[0\] must have length 3 \(got 2\)/);
  assert.throws(() => C.validateCastlePlugin(castleDef({ layers: [["#x#", "#.#"]] })), /layers\[0\]\[0\] uses "x" which is not in legend/);
  assert.throws(() => C.validateCastlePlugin(castleDef({ size: [49, 2, 2] })), /field "size" must be \[w,h,d\] within 48x24x48/);
  assert.throws(() => C.validateCastlePlugin(castleDef({ throne: [5, 1, 1] })), /field "throne" is outside the castle size/);

  assert.doesNotThrow(() => C.validateMapPlugin(mapDef()));
  assert.throws(() => C.validateMapPlugin(mapDef({ slots: [] })), /field "slots" must hold 1\.\.4 entries/);
  assert.throws(() => C.validateMapPlugin(mapDef({ weaponCap: 9 })), /field "weaponCap" must be an integer in 2\.\.8/);
  assert.throws(() => C.validateMapPlugin(mapDef({ wind: { strength: 6, change: 2 } })), /field "wind.strength" must be an integer in 0\.\.5/);
});

test("validateCommand accepts integer commands and rejects the rest", () => {
  const base = { slot: 0, tick: 10, seq: 0 };
  assert.doesNotThrow(() => C.validateCommand({ ...base, type: C.CMD.MOVE, fwd: 127, strafe: -3, yaw: 65535, pitch: -16384, jump: 0, sprint: 1 }));
  assert.doesNotThrow(() => C.validateCommand({ ...base, type: C.CMD.AIM, weaponId: 3, az: 3599, range: 380 }));
  assert.doesNotThrow(() => C.validateCommand({ ...base, type: C.CMD.DESIGNATE, cell: [1, 2, 3], block: 1, facing: 0 }));
  assert.throws(() => C.validateCommand({ ...base, type: C.CMD.MOVE, fwd: 0, strafe: 0, yaw: 1.5, pitch: 0, jump: 0, sprint: 0 }), /command move: field "yaw" must be an integer in 0\.\.65535/);
  assert.throws(() => C.validateCommand({ ...base, type: C.CMD.AIM, weaponId: 3, az: 3600, range: 0 }), /field "az" must be an integer in 0\.\.3599/);
  assert.throws(() => C.validateCommand({ ...base, type: "teleport" }), /unknown command type "teleport"/);
  assert.throws(() => C.validateCommand({ ...base, slot: 4, type: C.CMD.SURRENDER }), /field "slot" must be an integer in 0\.\.3/);
});

test("validateSlot checks controller, level and tactic", () => {
  const s = { id: 0, castleId: "tiny", team: 0, color: 0xc03030, controller: C.CONTROLLER.AI, aiLevel: 5, aiTactic: C.TACTIC.GENERAL };
  assert.doesNotThrow(() => C.validateSlot(s));
  assert.throws(() => C.validateSlot({ ...s, aiLevel: 11 }), /field "aiLevel" must be an integer in 1\.\.10/);
  assert.throws(() => C.validateSlot({ ...s, controller: "cpu" }), /field "controller" must be one of/);
});
