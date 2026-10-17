// tests/unit/ai-targets.test.js - owns public target scoring, line-of-fire shielding and id ordering.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreTarget, rankTargets, selectTarget } from '../../src/ai/targets.js';
import { BLOCK, TRAJ, TACTIC, CONTROLLER } from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';

function fixture() {
  const plot = { width: 8, depth: 8, height: 4, origin: [0, 0, -192], type: new Uint8Array(256), hp: new Uint8Array(256), meta: new Uint8Array(256) };
  const index = (x, y, z) => x + 8 * z + 64 * y;
  plot.type[index(3, 1, 3)] = BLOCK.PALACE; plot.hp[index(3, 1, 3)] = 40;
  const slot = { id: 0, team: 0, controller: CONTROLLER.AI, aiLevel: 10, aiTactic: TACTIC.GENERAL };
  const view = { tick: 0, slots: [slot, { id: 1, team: 1 }], castles: [{ slot: 0 }, { slot: 1, plot }], weapons: [], rulers: [], npcs: [] };
  const weapon = { id: 0, slot: 0, pos: [3.5, 1.5, 3.5], defId: 'cannon' };
  return { view, slot, plot, index, weapon };
}

test('target values and tactic weights follow tuning and score ties use id order', () => {
  const palace = { id: 3, kind: 'palace' }, weapon = { id: 2, kind: 'weapon' };
  assert.equal(scoreTarget(palace, TACTIC.DAREDEVIL), T.ai.targetValue.palace * T.ai.tacticWeight.daredevil.palace);
  assert.equal(scoreTarget(weapon, TACTIC.GENERAL), T.ai.targetValue.weapon * T.ai.tacticWeight.general.weapon);
  assert.equal(rankTargets([palace, weapon], TACTIC.GENERAL)[0].id, weapon.id);
  assert.equal(rankTargets([palace, weapon], TACTIC.DAREDEVIL)[0].id, palace.id);
  const tied = [{ id: 12, kind: 'palace' }, { id: 2, kind: 'palace' }, { id: 7, kind: 'palace' }];
  assert.deepEqual(rankTargets(tied, TACTIC.GENERAL).map(t => t.id), [2, 7, 12]);
  assert.deepEqual(tied.map(t => t.id), [12, 2, 7]);
});

test('straight guns target the wall shielding palace; lobbed guns can retain palace', () => {
  const { view, slot, plot, index, weapon } = fixture();
  plot.type[index(3, 1, 7)] = BLOCK.STONE;
  const before = structuredClone(view);
  assert.equal(selectTarget(view, slot, weapon).kind, 'shieldWall');
  assert.equal(selectTarget(view, slot, { ...weapon, def: { ...T.weapons.cannon, traj: TRAJ.LOBBED } }).kind, 'palace');
  assert.deepEqual(view, before);
  plot.type[index(3, 1, 7)] = BLOCK.AIR;
  assert.equal(selectTarget(view, slot, weapon).kind, 'palace');
});

test('allies and eliminated castles are excluded; visible rulers are immediate-win targets', () => {
  const { view, slot, weapon } = fixture();
  view.rulers = [{ id: 1, slot: 1, hp: 100, pos: [3.5, 1.5, -180] }];
  assert.equal(selectTarget(view, slot, weapon).kind, 'ruler');
  view.slots[1].team = slot.team;
  assert.equal(selectTarget(view, slot, weapon), null);
  view.slots[1].team = 1; view.castles[1].eliminated = true;
  assert.equal(selectTarget(view, slot, weapon), null);
});

test('magazines, weapons and public crew clusters can be selected without private enemy state', () => {
  const { view, slot, weapon, plot } = fixture();
  plot.type.fill(BLOCK.AIR);
  view.weapons = [{ id: 8, slot: 1, hp: 36, pos: [2, 2, -180], defId: 'cannon' }];
  assert.equal(selectTarget(view, slot, weapon).kind, 'weapon');
  view.weapons = [];
  plot.type[90] = BLOCK.MAGAZINE;
  assert.equal(selectTarget(view, slot, weapon).kind, 'magazine');
  plot.type.fill(BLOCK.AIR);
  view.npcs = [0, 1, 2].map(id => ({ id, slot: 1, hp: 100, pos: [2 + id * 0.1, 1, -180] }));
  assert.equal(selectTarget(view, slot, weapon).kind, 'crewCluster');
});

test('visibility starts at the cannon muzzle above a low own parapet, rather than at its feet', () => {
  const { view, slot, weapon } = fixture();
  const plot = { width: 8, depth: 8, height: 4, origin: [0, 0, 0], type: new Uint8Array(256) };
  plot.type[3 + 8 * 2 + 64] = BLOCK.STONE;
  view.castles[0].plot = plot;
  assert.equal(selectTarget(view, slot, weapon)?.kind, 'palace');
});

test('weapons on mounts and people on foundations are aimed at their visible body centres', () => {
  const { view, slot, weapon, plot, index } = fixture();
  plot.type.fill(BLOCK.FOUNDATION, 0, 64);
  plot.type[index(3, 1, 5)] = BLOCK.MOUNT;
  view.weapons = [{ id: 8, slot: 1, defId: 'cannon', hp: 36, pos: [3.5, 2, -186.5] }];
  const gun = selectTarget(view, slot, weapon);
  assert.equal(gun.kind, 'weapon');
  assert.equal(gun.pos.y, 2 + T.weaponRules.wallFootprint[2] / 2);
  view.weapons = [];
  view.rulers = [{ id: 1, slot: 1, hp: 100, pos: [3.5, 1, -184.5] }];
  const ruler = selectTarget(view, slot, weapon);
  assert.equal(ruler.kind, 'ruler');
  assert.equal(ruler.pos.y, 1 + T.people.height / 2);
});

test('TB2: ballistic targeting prefers an exposed enemy gun over a gun behind its keep', async () => {
  const C = await import('../../src/contracts.js');
  const { registerCoreSim } = await import('../../src/plugins/index.sim.js');
  const { createSim } = await import('../../src/sim/sim.js');
  C.resetRegistriesForTests(); registerCoreSim(); C.freezeRegistries();
  const sim = createSim({ map: 'forest-duel', seed: 1 });
  const view = sim.state, slot = view.slots[1], gun = view.weapons[2];
  const target = selectTarget(view, slot, gun, { ballistic: true });
  assert.equal(target.key, 'weapon:1');
  view.weapons[1].hp = 0;
  assert.notEqual(selectTarget(view, slot, gun, { ballistic: true }).kind, 'weapon', 'breach the palace before chasing a rear gun behind its keep');
});
