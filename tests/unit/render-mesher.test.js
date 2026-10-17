// tests/unit/render-mesher.test.js - owns acceptance fixtures for the pure block mesher (DESIGN 7.3).
import test from "node:test";
import assert from "node:assert/strict";
import { createPlot, setCell } from "../../src/world/grid.js";
import { BLOCK } from "../../src/contracts.js";
import {
  meshChunk, createModelSet, fallbackModels, modelFromTriangles, rotateModel, boxTriangles, FACE_DIRS,
} from "../../src/render/mesher.js";

const UP = [0, 1, 0];
function emptyPlot() { return createPlot({ width: 48, height: 24, depth: 48, foundation: false }); }
function set(plot, x, y, z, id, meta = 0) { assert.ok(setCell(plot, x, y, z, id, 40, meta)); }
const models = createModelSet(fallbackModels());
const opts = (extra = {}) => ({ models, sunDir: UP, ...extra });
const faces = (m) => m.indices.length / 6; // fallback cube faces are quads

test("FACE_DIRS lists the six axis directions", () => {
  assert.deepEqual(Object.keys(FACE_DIRS).sort(), ["nx", "ny", "nz", "px", "py", "pz"]);
});

test("a lone stone emits 6 quads in plot-local coordinates", () => {
  const p = emptyPlot();
  set(p, 3, 2, 5, BLOCK.STONE);
  const m = meshChunk(p, 0, 0, 0, opts());
  assert.equal(m.vertexCount, 24);
  assert.equal(faces(m), 6);
  for (let i = 0; i < m.positions.length; i += 3) {
    assert.ok(m.positions[i] >= 3 && m.positions[i] <= 4);
    assert.ok(m.positions[i + 1] >= 2 && m.positions[i + 1] <= 3);
    assert.ok(m.positions[i + 2] >= 5 && m.positions[i + 2] <= 6);
  }
  assert.equal(m.normals.length, m.positions.length);
  assert.equal(m.colors.length, m.positions.length);
  assert.equal(m.uvs.length / 2, m.vertexCount);
});

test("faces between opaque neighbours are culled, also across chunk borders", () => {
  const p = emptyPlot();
  set(p, 15, 1, 1, BLOCK.STONE);
  set(p, 16, 1, 1, BLOCK.STONE); // next chunk in x
  assert.equal(faces(meshChunk(p, 0, 0, 0, opts())), 5);
  assert.equal(faces(meshChunk(p, 1, 0, 0, opts())), 5);
});

test("non-opaque neighbours (floor slab, stairs, ladder, roof) do not cull", () => {
  for (const id of [BLOCK.FLOOR, BLOCK.STAIRS, BLOCK.LADDER, BLOCK.ROOF]) {
    const p = emptyPlot();
    set(p, 4, 1, 4, BLOCK.STONE);
    set(p, 5, 1, 4, id);
    const m = meshChunk(p, 0, 0, 0, { ...opts(), only: BLOCK.STONE });
    assert.equal(faces(m), 6, `neighbour id ${id}`);
  }
});

test("opacity is derived from model coverage", () => {
  assert.equal(models.opaque[BLOCK.STONE], 1);
  assert.equal(models.opaque[BLOCK.FOUNDATION], 1);
  assert.equal(models.opaque[BLOCK.AIR], 0);
  assert.equal(models.opaque[BLOCK.FLOOR], 0);
  assert.equal(models.opaque[BLOCK.STAIRS], 0);
  assert.equal(models.opaque[BLOCK.ROOF], 0);
});

test("foundation layer: bottom faces below y=0 are culled by default", () => {
  const p = createPlot({ width: 48, height: 24, depth: 48, foundation: true });
  const m = meshChunk(p, 0, 0, 0, opts());
  // 16x16 top quads only, plus the two plot-border side strips of this chunk (x=0, z=0)
  assert.equal(faces(m), 16 * 16 + 16 + 16);
});

test("vertex AO darkens corners next to occluders and leaves open faces bright", () => {
  const p = emptyPlot();
  set(p, 5, 1, 5, BLOCK.STONE);
  const open = meshChunk(p, 0, 0, 0, opts({ only: BLOCK.STONE, sunDir: [0, -1, 0] }));
  const topBright = topFaceColors(open, 2);
  assert.ok(topBright.every((c) => c === topBright[0]), "open top face is uniform");
  set(p, 6, 2, 5, BLOCK.STONE); // occluder diagonally above +x side of the top face
  const occ = meshChunk(p, 0, 0, 0, opts({ only: BLOCK.STONE, at: [5, 1, 5], sunDir: [0, -1, 0] }));
  const top = topFaceVertices(occ, 2);
  const near = top.filter((v) => v.x === 6).map((v) => v.c);
  const far = top.filter((v) => v.x === 5).map((v) => v.c);
  assert.equal(near.length, 2);
  assert.ok(Math.max(...near) < Math.min(...far), `near ${near} far ${far}`);
});

test("sun term: an overhang shadows the top face only when the sun is above", () => {
  const p = emptyPlot();
  set(p, 5, 1, 5, BLOCK.STONE);
  set(p, 5, 4, 5, BLOCK.STONE);
  const lit = topFaceColors(meshChunk(p, 0, 0, 0, opts({ only: BLOCK.STONE, at: [5, 1, 5], sunDir: [1, 0.2, 0] })), 2);
  const shaded = topFaceColors(meshChunk(p, 0, 0, 0, opts({ only: BLOCK.STONE, at: [5, 1, 5], sunDir: UP })), 2);
  assert.ok(shaded[0] < lit[0], `shaded ${shaded[0]} lit ${lit[0]}`);
  assert.ok(Math.abs(shaded[0] / lit[0] - 0.6) < 1e-6, "shadow factor 0.6");
});

test("damage states tint per TUNING (hp 20/40 is state 2 = 0.8)", () => {
  const p = emptyPlot();
  setCell(p, 5, 1, 5, BLOCK.STONE, 40, 0);
  const full = topFaceColors(meshChunk(p, 0, 0, 0, opts()), 2)[0];
  setCell(p, 5, 1, 5, BLOCK.STONE, 20, 0);
  const half = topFaceColors(meshChunk(p, 0, 0, 0, opts()), 2)[0];
  assert.ok(Math.abs(half / full - 0.8) < 1e-6);
});

test("modelFromTriangles classifies faces and detects full cubes", () => {
  const cube = modelFromTriangles(boxTriangles([0, 0, 0], [1, 1, 1], [1, 1, 1]));
  assert.equal(cube.opaque, true);
  assert.deepEqual(cube.faces.map((f) => f.cull).sort(), ["nx", "ny", "nz", "px", "py", "pz"]);
  const slab = modelFromTriangles(boxTriangles([0, 0.82, 0], [1, 1, 1], [1, 1, 1]));
  assert.equal(slab.opaque, false);
  assert.ok(slab.faces.some((f) => f.cull === null), "inner bottom face is uncullable");
  // kit GLBs are centred on x/z: offset moves them into the 0..1 cell
  const kit = modelFromTriangles(boxTriangles([-0.5, 0, -0.5], [0.5, 1, 0.5], [1, 1, 1]), { offset: [0.5, 0, 0.5] });
  assert.equal(kit.opaque, true);
});

test("rotateModel turns a north-facing model clockwise by facing", () => {
  const panel = modelFromTriangles(boxTriangles([0, 0, 0], [1, 1, 0.1], [1, 1, 1])); // hugs the north (-Z) face
  const full = (m) => m.faces.filter((f) => Math.abs(f.area - 1) < 1e-6).map((f) => f.cull).filter(Boolean);
  assert.deepEqual(full(panel), ["nz"]);
  assert.deepEqual(full(rotateModel(panel, 1)), ["px"]);
  assert.deepEqual(full(rotateModel(panel, 2)), ["pz"]);
  assert.deepEqual(full(rotateModel(panel, 3)), ["nx"]);
  assert.equal(rotateModel(panel, 0), panel);
});

test("meshing is deterministic and fast enough for a full wall chunk", () => {
  const p = createPlot({ width: 48, height: 24, depth: 48 });
  for (let x = 0; x < 16; x++) for (let y = 1; y < 8; y++) for (let z = 0; z < 3; z++) set(p, x, y, z, BLOCK.STONE);
  const a = meshChunk(p, 0, 0, 0, opts({ sunDir: [0.5, 0.8, 0.3] }));
  const b = meshChunk(p, 0, 0, 0, opts({ sunDir: [0.5, 0.8, 0.3] }));
  assert.deepEqual(a.colors, b.colors);
  assert.deepEqual(a.positions, b.positions);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 10; i++) meshChunk(p, 0, 0, 0, opts({ sunDir: [0.5, 0.8, 0.3] }));
  const ms = Number(process.hrtime.bigint() - t0) / 1e7;
  assert.ok(ms < 20, `chunk mesh ${ms.toFixed(2)} ms`);
});

/* helpers: read the top (+y normal) face of the first emitted cell */
function topFaceVertices(m) {
  const out = [];
  for (let v = 0; v < m.vertexCount; v++) {
    if (m.normals[v * 3 + 1] > 0.99) out.push({ x: m.positions[v * 3], z: m.positions[v * 3 + 2], c: m.colors[v * 3] });
  }
  return out.slice(0, 4);
}
function topFaceColors(m) { return topFaceVertices(m).map((v) => v.c); }
