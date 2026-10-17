// tests/unit/tuning.test.js - owns sanity, freezing and manual-number checks for src/tuning.js.
import test from "node:test";
import assert from "node:assert/strict";
import { traceFlight } from "../../src/sim/ballistics.js";
import { TUNING } from "../../src/tuning.js";

function walk(obj, path, visit) {
  visit(obj, path);
  if (obj && typeof obj === "object") {
    for (const k of Object.keys(obj)) walk(obj[k], `${path}.${k}`, visit);
  }
}

test("TUNING is deep-frozen", () => {
  walk(TUNING, "TUNING", (v, p) => {
    if (v && typeof v === "object") assert.ok(Object.isFrozen(v), `${p} is not frozen`);
  });
  assert.throws(() => { TUNING.world.plotW = 1; }, TypeError);
  assert.throws(() => { TUNING.blocks.stone.hp = 1; }, TypeError);
});

test("every number in TUNING is finite", () => {
  walk(TUNING, "TUNING", (v, p) => {
    if (typeof v === "number") assert.ok(Number.isFinite(v), `${p} = ${v} is not finite`);
  });
});

test("has the documented groups", () => {
  for (const g of ["world", "sim", "aim", "wind", "blocks", "weapons", "ruler", "people",
    "economy", "rules", "npc", "morale", "ai", "render", "golden"]) {
    assert.equal(typeof TUNING[g], "object", `missing group ${g}`);
  }
});

test("world grid: 1 m blocks, 48x48x24 plots, 16-cell chunks", () => {
  const w = TUNING.world;
  assert.equal(w.blockM, 1);
  assert.deepEqual([w.plotW, w.plotD, w.plotH], [48, 48, 24]);
  assert.equal(w.chunk, 16);
  assert.ok(w.weaponCapMin <= w.weaponCapDefault && w.weaponCapDefault <= w.weaponCapMax);
  assert.equal(w.weaponCapMax, 8); // EN p.52
  assert.equal(w.maxSlots, 4);
});

test("sim: 30 Hz, 4 substeps, converted native gravity (research/11 section 3)", () => {
  assert.equal(TUNING.sim.tickHz, 30);
  assert.equal(TUNING.sim.substeps, 4);
  assert.equal(TUNING.sim.gravity, 33 * (5 / 2048) / 0.062 ** 2);
});

test("ruler fits a 2-cell walkway and jumps one block", () => {
  const r = TUNING.ruler;
  assert.ok(r.eye < r.height && r.height < 2 * TUNING.world.blockM);
  assert.ok(r.walk < r.sprint);
  const apex = (r.jumpV * r.jumpV) / (2 * r.gravity);
  assert.ok(apex > 1.0 && apex < 1.5, `apex ${apex}`);
  assert.ok(r.fovDeg >= 30 && r.fovDeg <= 100);
  assert.ok(r.weaponFovDeg < r.fovDeg);
  assert.ok(r.autoStep > 0.5 && r.autoStep < 1, "auto-step must clear a half-step stair");
});

test("TB2: native charge limits and nine wind settings (research/11 sections 4/6)", () => {
  assert.equal(TUNING.aim.chargeMin, 1);
  assert.equal(TUNING.aim.chargeMax, 255);
  assert.deepEqual(TUNING.wind.nativeSpeedByStrength, [0, 10, 25, 45, 70, 100, 135, 175, 220]);
  assert.deepEqual(TUNING.wind.segmentBaseByChange, [64, 32, 16, 8, 4, 1]);
});

test("block table: hp in 0..255, cost integer or null (map-only)", () => {
  for (const [key, b] of Object.entries(TUNING.blocks)) {
    assert.ok(Number.isInteger(b.hp) && b.hp >= 0 && b.hp <= 255, `${key}.hp`);
    assert.ok(b.cost === null || (Number.isInteger(b.cost) && b.cost >= 0), `${key}.cost`);
    assert.ok(b.buildS >= 0, `${key}.buildS`);
  }
});

test("block hp matches the manual's defence points (research/06 section 10)", () => {
  const b = TUNING.blocks;
  assert.equal(b.stone.hp, 40);     // small wall, EN p.36
  assert.equal(b.mount.hp, 60);     // large wall, EN p.36
  assert.equal(b.tower.hp, 72);     // small tower, EN p.37
  assert.equal(b.gate.hp, 96);      // gatehouse, EN p.37
  assert.equal(b.magazine.hp, 24);  // ammo workshop, EN p.39
  assert.equal(b.foundation.hp, 255);
});

test("weapon numbers match the manual (research/06 sections 1 and 10)", () => {
  const manual = {
    catapult: { cost: 600, reloadS: 18, fireCost: 52 },
    cannon: { cost: 750, reloadS: 22, fireCost: 90 },
    "double-cannon": { cost: 750, reloadS: 22, fireCost: 150 },
    "fire-catapult": { cost: 750, reloadS: 24, fireCost: 150 },
    ballista: { cost: 400, reloadS: 15, fireCost: 22 },
    rocket: { cost: 800, reloadS: 30, fireCost: 150 },
    trebuchet: { cost: 850, reloadS: 18, fireCost: 225 },
    arcaballista: { cost: 850, reloadS: 18, fireCost: 300 },
    "fat-freda": { cost: 850, reloadS: 22, fireCost: 225 },
    hellfire: { cost: 850, reloadS: 22, fireCost: 330 },
  };
  assert.deepEqual(Object.keys(TUNING.weapons).sort(), Object.keys(manual).sort());
  for (const [id, m] of Object.entries(manual)) {
    const w = TUNING.weapons[id];
    for (const f of Object.keys(m)) assert.equal(w[f], m[f], `${id}.${f}`);
  }
  // research/11: 60/96 support HP; half-HP loss threshold is not a separate entity pool here.
  assert.equal(TUNING.weapons.catapult.hp, 60);
  assert.equal(TUNING.weapons["fire-catapult"].hp, 60);
  for (const id of ["trebuchet", "arcaballista", "fat-freda", "hellfire"]) {
    assert.equal(TUNING.weapons[id].hp, 96, id);
  }
  // wall weapons: half a 72 dp tower (EN p.43)
  for (const [id, w] of Object.entries(TUNING.weapons)) {
    if (w.mount === "wall") assert.equal(w.hp, TUNING.blocks.tower.hp / 2, id);
  }
});

test("every weapon can reach the duel distance under production quadratic drag", () => {
  for (const [id, w] of Object.entries(TUNING.weapons)) {
    const range = traceFlight({ ...w, charge: TUNING.aim.chargeMax, elevation: w.elevationDeg }).range;
    assert.ok(range >= TUNING.world.duelDistanceM, `${id} max range ${range.toFixed(0)}m`);
    assert.ok(w.k >= 0 && w.k < 1, `${id}.k`);
    assert.ok(Number.isInteger(w.crewSlots) && w.crewSlots >= 1 && w.crewSlots <= 12, id);
    assert.ok(Number.isInteger(w.count) && w.count >= 1, id);
    assert.ok(w.direct >= 0 && w.splash >= 0 && w.splashRadius >= 0, id);
  }
});

test("npc role shares leave civilians and respect minimums", () => {
  const s = TUNING.npc.shares;
  const sum = s.crew + s.runner + s.mason;
  assert.ok(sum < 1, "civilians must get the rest");
  assert.equal(Math.round(TUNING.npc.population * s.crew), 16);
  assert.ok(TUNING.npc.populationMin <= TUNING.npc.population);
  assert.ok(TUNING.npc.population <= TUNING.npc.populationMax);
});

test("morale: surrender is reachable above the floor; bands descend", () => {
  const m = TUNING.morale;
  assert.ok(m.floor < TUNING.rules.surrenderMorale, "floor must sit below the surrender line");
  assert.ok(m.floor >= 0 && m.start <= 100);
  assert.equal(m.wFast + m.wBase, 1);
  for (let i = 1; i < m.workBands.length; i++) {
    assert.ok(m.workBands[i][0] < m.workBands[i - 1][0], "band thresholds descend");
    assert.ok(m.workBands[i][1] <= m.workBands[i - 1][1], "work speed descends");
  }
  assert.ok(m.rallyBelow > TUNING.rules.surrenderMorale);
});

test("ai: levels 1..10 and level 10 aims tighter than level 1", () => {
  const a = TUNING.ai;
  assert.equal(a.levelMin, 1);
  assert.equal(a.levelMax, 10);
  const sigma = (L) => a.sAz0PerLevelDeg * (11 - L);
  assert.ok(sigma(10) < sigma(1));
  assert.ok(a.alphaBase + a.alphaPerLevel * 10 <= 1.0 + 1e-9);
});

test("render and golden frame are 1024x768", () => {
  assert.equal(TUNING.render.logicalW, 1024);
  assert.equal(TUNING.render.logicalH, 768);
  assert.equal(TUNING.golden.width, 1024);
  assert.equal(TUNING.golden.height, 768);
});

test("Repair waves retain scarce economy while strengthening early keep durability (research/17,20)", async () => {
  const { DEFAULT_CASTLE } = await import('../../src/plugins/castles/default.sim.js');
  const count = DEFAULT_CASTLE.layers.flat().join('').split('P').length - 1;
  assert.equal(count, 48);
  const removalDp = count * TUNING.blocks.palace.hp * (1 - TUNING.palace.destroyedBelow);
  assert.equal(removalDp, 3686.4); // 48 reinforced 96-HP cells, opening defeat below 20%, paid repairs
  assert.equal(TUNING.economy.goldCap, 2000);
  assert.equal(TUNING.economy.startGold, 1500);
  assert.equal(TUNING.blocks.stone.cost, 4);
  assert.equal(TUNING.blocks.tower.cost, 8);
  assert.equal(TUNING.economy.palaceIncomeS, 3);
  assert.equal(TUNING.economy.civilianIncomeS, .1);
  assert.equal(TUNING.economy.repairCostFrac, .8);
  assert.equal(TUNING.blocks.tower.buildS, 18);
  assert.equal(TUNING.blocks.wood.hp, 12);
  assert.equal(TUNING.structures.windmill.hp, 24);
  assert.equal(TUNING.blocks.magazine.cost * 8, 600);
  for (const [id, w] of Object.entries(TUNING.weapons)) {
    assert.equal(Math.floor(w.fireCostWorkshop * 1.5), w.fireCost, id);
  }
  assert.equal(TUNING.weapons.cannon.direct, 16);
  assert.equal(TUNING.weapons.cannon.splash, 20);
  assert.equal(TUNING.weapons.cannon.splashRadius, 640 * TUNING.sim.splashNativePositionM);
});

test('TB2: blast footprints use the flight world scale so one blast cannot level a keep', () => {
  for (const w of Object.values(TUNING.weapons)) {
    assert.equal(w.splashRadius, w.nativeSplashRadius * TUNING.sim.splashNativePositionM);
  }
  assert.ok(TUNING.weapons.cannon.splashRadius < 640 * 5 / 256, 'smaller than the building-sized renderer footprint');
});
