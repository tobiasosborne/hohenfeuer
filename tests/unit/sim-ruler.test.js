// tests/unit/sim-ruler.test.js - owns ruler clearance, stairs, ladders and falling acceptance fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuler, tickRuler } from '../../src/sim/ruler.js';
import { createPlot, setCell } from '../../src/world/grid.js';
import { TUNING as T } from '../../src/tuning.js';
import * as C from '../../src/contracts.js';
function fixture() {
  const plot = createPlot({ width: 12, height: 12, depth: 12 });
  const ruler = createRuler(0, { x: 2.5, y: 1, z: 2.5 });
  const ctx = { state: { tick: 0, castles: [{ plot }], terrain: null }, emit() {}, getBlock(id) { return { solid: ![C.BLOCK.AIR, C.BLOCK.DOOR, C.BLOCK.LADDER].includes(id), passable: [C.BLOCK.AIR, C.BLOCK.DOOR, C.BLOCK.LADDER].includes(id), collider: id === C.BLOCK.STAIRS ? 'stairs' : 'cube' }; } };
  return { plot, ruler, ctx };
}

test('ruler cannot fit a one-high gap or tunnel a wall', () => {
  const { plot, ruler, ctx } = fixture();
  for (let z = 0; z < plot.depth; z++) setCell(plot, 4, 2, z, C.BLOCK.STONE, T.blocks.stone.hp);
  for (let i = 0; i < 90; i++) tickRuler(ctx, ruler, { fwd: 127, strafe: 0, yaw: 16384, pitch: 0 });
  assert.ok(ruler.pos.x <= 4 - T.ruler.radius + 1e-6);
});

test('ruler climbs two-box stairs and ladder with forward input', () => {
  const stairs = fixture();
  setCell(stairs.plot, 3, 1, 2, C.BLOCK.STAIRS, T.blocks.stairs.hp, 1);
  setCell(stairs.plot, 4, 1, 2, C.BLOCK.STONE, T.blocks.stone.hp);
  for (let i = 0; i < 18; i++) tickRuler(stairs.ctx, stairs.ruler, { fwd: 127, strafe: 0, yaw: 16384 });
  assert.ok(stairs.ruler.pos.x > 4 && stairs.ruler.pos.y >= 2 - 1e-6, JSON.stringify(stairs.ruler.pos));
  const ladder = fixture();
  ladder.ruler.pos.x = 3.5;
  for (let y = 1; y < 7; y++) setCell(ladder.plot, 3, y, 2, C.BLOCK.LADDER, T.blocks.ladder.hp);
  for (let i = 0; i < 60; i++) tickRuler(ladder.ctx, ladder.ruler, { fwd: 127, strafe: 0, yaw: 0 });
  assert.ok(ladder.ruler.pos.y > 4.5);
});

test('shooting away a floor makes the ruler fall and take height-based damage', () => {
  const { plot, ruler, ctx } = fixture();
  ruler.pos.y = 7;
  setCell(plot, 2, 6, 2, C.BLOCK.STONE, T.blocks.stone.hp);
  tickRuler(ctx, ruler, {});
  assert.equal(ruler.pos.y, 7);
  setCell(plot, 2, 6, 2, C.BLOCK.AIR, 0);
  for (let i = 0; i < 100; i++) tickRuler(ctx, ruler, {});
  assert.equal(ruler.pos.y, 1);
  assert.ok(ruler.hp < T.people.hp);
});
