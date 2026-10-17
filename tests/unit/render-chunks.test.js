// tests/unit/render-chunks.test.js - owns acceptance fixtures for the chunk dirty queue and the 2-castle test scene.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createPlot, setCell } from "../../src/world/grid.js";
import { BLOCK } from "../../src/contracts.js";
import { TUNING } from "../../src/tuning.js";
import { createModelSet, fallbackModels } from "../../src/render/mesher.js";
import { createChunkManager } from "../../src/render/chunks.js";
import { buildTestScene, TEST_SCENE } from "../../src/render/test-scene.js";

const models = createModelSet(fallbackModels());
const material = new THREE.MeshLambertMaterial({ vertexColors: true });
const manager = () => createChunkManager({ models, material, meshOpts: { sunDir: [0.4, 0.8, 0.3] } });

test("a 48x24x48 plot is 3x2x3 = 18 chunks, all dirty on add", () => {
  const m = manager();
  m.addPlot(createPlot({ id: 0 }));
  assert.equal(m.chunkCount(), 18);
  assert.equal(m.dirtyCount(), 18);
});

test("update remeshes at most maxPerFrame (2) chunks per call", () => {
  const m = manager();
  m.addPlot(createPlot({ id: 0 }));
  assert.equal(TUNING.render.remeshPerFrame, 2);
  assert.equal(m.update(), 2);
  assert.equal(m.dirtyCount(), 16);
  assert.equal(m.update(null, 5), 5);
  assert.equal(m.dirtyCount(), 11);
});

test("flush meshes everything; empty chunks get no mesh", () => {
  const m = manager();
  const p = createPlot({ id: 0 });
  m.addPlot(p);
  m.flush();
  assert.equal(m.dirtyCount(), 0);
  assert.equal(m.meshCount(), 9, "only the foundation layer of chunks has geometry");
  for (const mesh of m.group.children) {
    assert.ok(mesh.isMesh);
    assert.ok(mesh.geometry.getAttribute("position").count > 0);
    assert.ok(mesh.geometry.getAttribute("color"));
    assert.ok(mesh.geometry.getIndex());
  }
});

test("markCell dirties the chunk and every chunk within one cell (AO and culling reach)", () => {
  const m = manager();
  const p = createPlot({ id: 0 });
  m.addPlot(p);
  m.flush();
  assert.equal(m.markCell(p, 20, 5, 20), 1, "interior cell");
  m.flush();
  assert.equal(m.markCell(p, 15, 5, 20), 2, "x border");
  m.flush();
  assert.equal(m.markCell(p, 16, 16, 16), 8, "corner of 8 chunks");
});

test("update picks the dirty chunk nearest the focus first", () => {
  const m = manager();
  const p = createPlot({ id: 0, origin: [100, 0, 100] });
  m.addPlot(p);
  m.flush();
  m.markCell(p, 4, 4, 4);
  m.markCell(p, 40, 4, 40);
  assert.equal(m.update({ x: 140, y: 4, z: 140 }, 1), 1);
  assert.deepEqual(m.dirtyKeys(), ["0:0:0:0"]);
});

test("chunk meshes sit at the plot origin and vanish when emptied", () => {
  const m = manager();
  const p = createPlot({ id: 3, origin: [10, 2, 30], foundation: false });
  setCell(p, 1, 1, 1, BLOCK.STONE, 40, 0);
  m.addPlot(p);
  m.flush();
  assert.equal(m.meshCount(), 1);
  const mesh = m.group.children[0];
  assert.deepEqual([mesh.position.x, mesh.position.y, mesh.position.z], [10, 2, 30]);
  setCell(p, 1, 1, 1, BLOCK.AIR, 0, 0);
  m.markCell(p, 1, 1, 1);
  m.flush();
  assert.equal(m.meshCount(), 0);
});

test("test scene: two castles 192 m apart, deterministic, with palace core and cannon mounts", () => {
  const a = buildTestScene(), b = buildTestScene();
  assert.equal(a.plots.length, 2);
  for (let i = 0; i < 2; i++) assert.deepEqual(a.plots[i].type, b.plots[i].type);
  const centre = (p) => [p.origin.x + p.width / 2, p.origin.z + p.depth / 2];
  const [ca, cb] = a.plots.map(centre);
  assert.equal(Math.hypot(cb[0] - ca[0], cb[1] - ca[1]), TUNING.world.duelDistanceM);
  for (const p of a.plots) {
    const palace = p.type.reduce((n, t) => n + (t === BLOCK.PALACE ? 1 : 0), 0);
    assert.equal(palace, 48, "4x4x3 palace core");
  }
  assert.equal(a.cannons.length, 2);
  for (const c of a.cannons) {
    const p = a.plots[c.plot];
    const [x, y, z] = c.cell;
    const at = (xx, yy, zz) => p.type[xx + p.width * zz + p.width * p.depth * yy];
    assert.equal(at(x, y - 1, z), BLOCK.MOUNT, "cannon stands on a mount");
    assert.equal(at(x, y, z), BLOCK.AIR);
    assert.equal(at(x + c.dir[0], y, z + c.dir[2]), BLOCK.AIR, "embrasure in front of the barrel");
  }
  assert.ok(TEST_SCENE.map.slots.length === 2);
});
