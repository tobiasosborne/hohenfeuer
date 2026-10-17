// tests/unit/ui-interact.test.js - owns reticle picking and designation-ghost validity tests for src/player/interact.js.
import test from "node:test";
import assert from "node:assert/strict";
import { BLOCK, K } from "../../src/contracts.js";
import { TUNING } from "../../src/tuning.js";
import { createPlot, setCell } from "../../src/world/grid.js";
import { lookDir, pick, ghost, facingFromYaw, GHOST_REASON, DESIGNATED_BIT } from "../../src/player/interact.js";

const ORIGIN = [100, 0, 100];
function world() {
  const plot = createPlot({ origin: ORIGIN, id: 0 });
  for (let y = 1; y <= 3; y++) setCell(plot, 10, y, 20, BLOCK.STONE, 40, 0);
  setCell(plot, 30, 1, 30, BLOCK.MOUNT, 60, 0);
  setCell(plot, 12, 1, 25, BLOCK.AIR, 0, 0);
  const enemy = createPlot({ origin: [100, 0, 0], id: 1 });
  return { plot, enemy, plots: [{ plot, slot: 0 }, { plot: enemy, slot: 1 }] };
}
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

test("lookDir: yaw clockwise from north, pitch up", () => {
  const n = lookDir(0, 0); assert.ok(near(n.x, 0) && near(n.y, 0) && near(n.z, -1));
  const e = lookDir(Math.PI / 2, 0); assert.ok(near(e.x, 1) && near(e.z, 0));
  const u = lookDir(0, Math.PI / 2 - 1e-9); assert.ok(near(u.y, 1, 1e-6));
});

test("facingFromYaw maps to FACING N/E/S/W", () => {
  assert.equal(facingFromYaw(0), 0);
  assert.equal(facingFromYaw(Math.PI / 2), 1);
  assert.equal(facingFromYaw(Math.PI), 2);
  assert.equal(facingFromYaw(-Math.PI / 2), 3);
  assert.equal(facingFromYaw(0.7), 0); // 40 deg -> N
  assert.equal(facingFromYaw(0.9), 1); // 52 deg -> E
});

test("pick hits the first block face under the reticle with distance and normal", () => {
  const { plots } = world();
  const eye = [110.5, 2.6, 125.5];
  const t = pick({ eye, yaw: 0, pitch: 0, plots, weapons: [], slot: 0 });
  assert.equal(t.kind, "block");
  assert.deepEqual(t.cell, [10, 2, 20]);
  assert.deepEqual(t.normal, [0, 0, 1]);
  assert.ok(near(t.dist, 4.5, 1e-9));
  assert.equal(t.own, true);
  assert.equal(t.block, BLOCK.STONE);
  assert.equal(pick({ eye, yaw: 0, pitch: 0, plots, weapons: [], slot: 1 }).own, false);
});

test("pick respects the 24 m order range and returns kind none on a miss", () => {
  const { plots } = world();
  const far = pick({ eye: [110.5, 2.6, 121 + TUNING.ruler.interactOrderM + 0.5], yaw: 0, pitch: 0, plots, weapons: [], slot: 0 });
  assert.equal(far.kind, "none");
  const sky = pick({ eye: [110.5, 2.6, 125.5], yaw: 0, pitch: 1.2, plots, weapons: [], slot: 0 });
  assert.equal(sky.kind, "none");
});

test("pick prefers a nearer weapon AABB and reports its id and crew state", () => {
  const { plots } = world();
  const weapons = [{ id: 7, slot: 0, min: [110, 2, 123], max: [111, 3, 124], crewOrdered: true }];
  const t = pick({ eye: [110.5, 2.6, 125.5], yaw: 0, pitch: 0, plots, weapons, slot: 0 });
  assert.equal(t.kind, "weapon"); assert.equal(t.weaponId, 7); assert.equal(t.crewOrdered, true);
  assert.ok(near(t.dist, 1.5, 1e-9));
});

test("pick sees designated air cells", () => {
  const { plot, plots } = world();
  setCell(plot, 10, 2, 22, BLOCK.AIR, 0, 0);
  plot.meta[10 + K.PLOT_W * 22 + K.CELLS_PER_LAYER * 2] = DESIGNATED_BIT;
  const t = pick({ eye: [110.5, 2.6, 125.5], yaw: 0, pitch: 0, plots, weapons: [], slot: 0 });
  assert.equal(t.kind, "designation"); assert.deepEqual(t.cell, [10, 2, 22]); assert.equal(t.designated, true);
});

test("ghost: block designation adjacent to the hit face, with every invalid reason", () => {
  const { plot, enemy, plots } = world();
  const target = pick({ eye: [110.5, 2.6, 125.5], yaw: 0, pitch: 0, plots, weapons: [], slot: 0 });
  const base = { target, plot, slot: 0, build: { mode: "block", block: BLOCK.STONE, cost: 10 }, gold: 100, openDesignations: 0, people: [], yaw: 0 };
  const g = ghost(base);
  assert.deepEqual(g.cell, [10, 2, 21]); assert.equal(g.valid, true); assert.equal(g.reason, GHOST_REASON.OK);
  assert.equal(g.facing, 0);
  assert.equal(ghost({ ...base, gold: 9 }).reason, GHOST_REASON.GOLD);
  assert.equal(ghost({ ...base, openDesignations: TUNING.world.maxOpenDesignations }).reason, GHOST_REASON.CAP);
  assert.equal(ghost({ ...base, people: [{ pos: [110.5, 1, 121.6], radius: 0.3, height: 1.75 }] }).reason, GHOST_REASON.PERSON);
  // target on the enemy plot
  const et = pick({ eye: [110.5, 2.6, 125.5], yaw: Math.PI, pitch: 0, plots: [{ plot: enemy, slot: 1 }], weapons: [], slot: 0 });
  assert.equal(ghost({ ...base, target: { ...target, own: false } }).reason, GHOST_REASON.NOT_OWN);
  // top of the build limit
  const top = { ...target, cell: [10, TUNING.world.buildMaxY, 20], normal: [0, 1, 0] };
  assert.equal(ghost({ ...base, target: top }).reason, GHOST_REASON.HEIGHT);
  // edge of the plot
  const edge = { ...target, cell: [47, 2, 20], normal: [1, 0, 0] };
  assert.equal(ghost({ ...base, target: edge }).reason, GHOST_REASON.OUTSIDE);
  // occupied by a block
  const occ = { ...target, cell: [10, 1, 21], normal: [0, 0, -1] };
  assert.equal(ghost({ ...base, target: occ }).reason, GHOST_REASON.OCCUPIED);
  assert.equal(ghost({ ...base, target: { kind: "none" } }), null);
  assert.equal(et.kind, "none");
});

test("ghost: wall weapons need a mount below, ground weapons a clear 3x3x2 on solid floor", () => {
  const { plot } = world();
  const onMount = { kind: "block", own: true, dist: 3, cell: [30, 1, 30], normal: [0, 1, 0], block: BLOCK.MOUNT };
  const wall = { mode: "weapon", weapon: "cannon", cost: 750, footprint: [1, 1, 1], mount: "wall" };
  const base = { plot, slot: 0, gold: 5000, openDesignations: 0, people: [], yaw: Math.PI / 2 };
  const ok = ghost({ ...base, target: onMount, build: wall });
  assert.equal(ok.valid, true); assert.deepEqual(ok.cell, [30, 2, 30]); assert.equal(ok.facing, 1);
  const onFloor = { kind: "block", own: true, dist: 3, cell: [5, 0, 5], normal: [0, 1, 0], block: BLOCK.FOUNDATION };
  assert.equal(ghost({ ...base, target: onFloor, build: wall }).reason, GHOST_REASON.MOUNT);
  const ground = { mode: "weapon", weapon: "catapult", cost: 600, footprint: [3, 3, 2], mount: "ground" };
  assert.equal(ghost({ ...base, target: onFloor, build: ground }).valid, true);
  const blocked = { ...onFloor, cell: [9, 0, 20] }; // 3x3 around (9,1,20) hits the stone column at x 10
  assert.equal(ghost({ ...base, target: blocked, build: ground }).reason, GHOST_REASON.OCCUPIED);
});
