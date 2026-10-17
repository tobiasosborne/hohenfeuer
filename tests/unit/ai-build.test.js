// tests/unit/ai-build.test.js - owns blueprint priorities, income budgets and weapon reserve fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureBlueprint, planRebuild, planWeaponReplacement } from '../../src/ai/build.js';
import { BLOCK, CMD, TACTIC, FACING, validateCommand } from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';

function fixture() {
  const w = 8, h = 4, d = 8, type = new Uint8Array(w * h * d), meta = new Uint8Array(type.length);
  const index = ([x, y, z]) => x + w * z + w * d * y;
  const cells = [[3, 1, 3], [2, 1, 3], [1, 1, 3], [3, 1, 2], [3, 1, 4], [6, 1, 6]];
  for (const cell of cells) type[index(cell)] = BLOCK.STONE;
  type[index(cells[0])] = BLOCK.PALACE;
  const castle = { slot: 0, gold: 2000, plot: { width: w, height: h, depth: d, origin: [0, 0, 0], type, meta },
    mountSpots: [[2, 2, 2, FACING.E]], weapons: [{ defId: 'cannon', at: [2, 2, 2], facing: FACING.E }] };
  return { castle, index, cells };
}

test('blueprint is a copy; rebuilds nearest palace first, caps four and skips designated/map-only cells', () => {
  const { castle, index, cells } = fixture(), blueprint = captureBlueprint(castle);
  castle.plot.type.fill(BLOCK.AIR);
  assert.equal(blueprint.cells.find(c => c.block === BLOCK.PALACE).cell[0], 3);
  castle.plot.meta[index(cells[1])] = 16;
  const plan = planRebuild(castle, blueprint, TACTIC.GENERAL);
  assert.equal(plan.length, T.ai.buildPerThink);
  assert.deepEqual(plan[0].cell, [3, 1, 2], 'same distance breaks by cell index');
  assert.ok(plan.every(p => p.block !== BLOCK.PALACE && p.cell.join() !== cells[1].join()));
  for (const [seq, p] of plan.entries()) assert.equal(validateCommand({ ...p, slot: 0, seq, tick: 1 }), true);
  assert.deepEqual(castle.plot.type, new Uint8Array(castle.plot.type.length));
});

test('reserve is preserved after the entire plan; repair spending is bounded by income share', () => {
  const { castle } = fixture(), blueprint = captureBlueprint(castle);
  castle.plot.type.fill(BLOCK.AIR);
  castle.gold = T.ai.reserve[TACTIC.WORRIER] + T.blocks.stone.cost;
  assert.equal(planRebuild(castle, blueprint, TACTIC.WORRIER).length, 1);
  castle.gold--;
  assert.equal(planRebuild(castle, blueprint, TACTIC.WORRIER).length, 0);
  castle.gold = 2000;
  assert.equal(planRebuild(castle, blueprint, TACTIC.DAREDEVIL, { incomeGold: 100, spentGold: 100 * T.ai.repairShare[TACTIC.DAREDEVIL] - T.blocks.stone.cost }).length, 1);
  assert.equal(planRebuild(castle, blueprint, TACTIC.DAREDEVIL, { incomeGold: 100, spentGold: 20 }).length, 0);
});

test('lost blueprint weapons are replaced on free mount spots only when cost plus reserve fits', () => {
  const { castle } = fixture(), blueprint = captureBlueprint(castle);
  castle.weapons = [];
  castle.gold = T.ai.reserve.general + T.weapons.cannon.cost;
  const plan = planWeaponReplacement(castle, blueprint, TACTIC.GENERAL, [], { weaponCap: 4 });
  assert.deepEqual(plan, [{ type: CMD.DESIGNATE_WEAPON, weapon: 'cannon', cell: [2, 2, 2], facing: FACING.E }]);
  castle.gold--;
  assert.deepEqual(planWeaponReplacement(castle, blueprint, TACTIC.GENERAL, []), []);
  castle.gold = 2000;
  assert.deepEqual(planWeaponReplacement(castle, blueprint, TACTIC.GENERAL, [{ id: 1, at: [2, 2, 2], hp: 36 }]), []);
  assert.deepEqual(planWeaponReplacement(castle, blueprint, TACTIC.GENERAL, [], { weaponCap: 0 }), []);
});

test('replacement understands public world positions and counts pending same-type replacements', () => {
  const { castle } = fixture();
  castle.mountSpots.push([4, 2, 2, FACING.E]);
  castle.weapons.push({ defId: 'cannon', at: [4, 2, 2], facing: FACING.E });
  const blueprint = captureBlueprint(castle);
  const live = [{ id: 0, defId: 'cannon', hp: 36, pos: { x: 2.5, y: 2, z: 2.5 } }];
  const plan = planWeaponReplacement(castle, blueprint, TACTIC.GENERAL, live);
  assert.deepEqual(plan[0].cell, [4, 2, 2]);
  assert.deepEqual(planWeaponReplacement(castle, blueprint, TACTIC.GENERAL, live,
    { pending: [{ weapon: 'cannon', cell: [4, 2, 2] }] }), []);
});
