// tests/unit/npc-tb3.test.js - owns paid designation rules and safe mason construction under fire.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK, CMD, EV, JOB, META, ROLE, NPC_STATE, K } from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';
import { npcCommand } from '../../src/npc/index.js';
import { emitJobs, claimJob, tickWork } from '../../src/npc/jobs.js';
import { indexOf } from '../../src/npc/model.js';
import { fixture, person } from './npc-fixture.test.js';

const order = (type, cell, fields = {}) => ({ type, slot: 0, cell, ...fields });
const designate = (f, cell, block = BLOCK.STONE) => npcCommand(f.api, order(CMD.DESIGNATE, cell, { block, facing: 1 }));
function work(f, npc, count) { for (let n = 0; n < count; n++) { tickWork(f.api, f.castle, npc); f.state.tick++; } }

test('TB3: reserve once, preserve facing, cancel and refund exactly once', () => {
  const f = fixture(), cell = [5, 1, 3], gold = f.castle.gold;
  assert.ok(designate(f, cell));
  assert.equal(f.castle.gold, gold - T.blocks.stone.cost);
  assert.equal(f.plot.meta[indexOf(f.plot, cell)], META.DESIGNATED_BIT | 1);
  assert.equal(designate(f, cell), false);
  emitJobs(f.api, f.castle);
  assert.ok(npcCommand(f.api, order(CMD.CANCEL, cell)));
  assert.equal(f.castle.gold, gold);
  assert.equal(f.plot.meta[indexOf(f.plot, cell)], 0);
  assert.equal(f.castle.jobs.filter(j => j.kind === JOB.BUILD).length, 0);
  assert.equal(npcCommand(f.api, order(CMD.CANCEL, cell)), false);
  assert.equal(f.events.filter(e => e.type === EV.DESIGNATION_CANCELLED).length, 1);
});

test('TB3: reject floating, map-only, air, occupied and unaffordable cells without reserving', () => {
  const f = fixture(), gold = f.castle.gold;
  assert.equal(designate(f, [5, 4, 3]), false, 'floating cell');
  assert.equal(designate(f, [5, 1, 3], BLOCK.PALACE), false);
  assert.equal(designate(f, [5, 1, 3], BLOCK.AIR), false);
  f.put(5, 1, 3, BLOCK.STONE);
  assert.equal(designate(f, [5, 1, 3]), false);
  assert.equal(f.castle.gold, gold);
  f.castle.gold = T.blocks.stone.cost - 0.1;
  assert.equal(designate(f, [6, 1, 3]), false);
});

test('TB3: person overlap includes heads, capsule edges, enemies and the ruler', () => {
  for (const kind of ['head', 'edge', 'enemy', 'ruler']) {
    const f = fixture(), cell = [5, kind === 'head' ? 2 : 1, 3];
    if (kind === 'head') f.put(5, 2, 2, BLOCK.STONE);
    const npc = person(4, ROLE.MASON, [5, 1, 3], kind === 'enemy' ? 1 : 0);
    if (kind === 'edge') npc.pos.x = 4.9;
    if (kind === 'ruler') f.state.rulers.push(npc); else f.state.npcs.push(npc);
    assert.equal(designate(f, cell), false, kind);
  }
});

test('TB3: shared cap covers builds, demolition and cannon reservations', () => {
  const f = fixture({ width: 12, depth: 12 });
  for (let n = 0; n < T.world.maxOpenDesignations; n++) assert.ok(designate(f, [n % 12, 1, Math.floor(n / 12)]));
  f.put(10,1,10,BLOCK.STONE); f.put(11,1,10,BLOCK.MOUNT);
  const cannon = order(CMD.DESIGNATE_WEAPON,[11,2,10],{weapon:'cannon',facing:0});
  assert.equal(designate(f, [11, 1, 11]), false);
  assert.equal(npcCommand(f.api,order(CMD.DEMOLISH,[10,1,10])),false);
  assert.equal(npcCommand(f.api,cannon),false);
  for (let x=0; x<3; x++) assert.ok(npcCommand(f.api,order(CMD.CANCEL,[x,1,0])));
  assert.ok(npcCommand(f.api,order(CMD.DEMOLISH,[10,1,10])));
  assert.ok(npcCommand(f.api,cannon));
  assert.ok(designate(f,[11,1,11]));
  assert.equal(f.castle.npcDesignations.length, T.world.maxOpenDesignations);
});

test('TB3: cannon needs a free mount, reserves its cost, builds after wall-weapon work time', () => {
  const f = fixture(), cell = [5, 2, 3], gold = f.castle.gold;
  const cmd = order(CMD.DESIGNATE_WEAPON, cell, { weapon: 'cannon', facing: 1 });
  assert.equal(npcCommand(f.api, cmd), false);
  f.put(5, 1, 3, BLOCK.MOUNT);
  assert.ok(npcCommand(f.api, cmd));
  assert.equal(f.castle.gold, gold - T.weapons.cannon.cost);
  let placed = null;
  f.api.placeWeapon = (slot, weapon, at, facing) => { placed = { slot, weapon, at, facing }; return 7; };
  const npc = person(4, ROLE.MASON, [4, 1, 3]); f.state.npcs.push(npc);
  emitJobs(f.api, f.castle); assert.ok(claimJob(f.api, f.castle, npc)); npc.state = NPC_STATE.WORK;
  work(f, npc, Math.ceil(T.weaponRules.buildWallS * K.TICK_HZ));
  assert.ok(placed);
  assert.equal(placed.weapon, 'cannon'); assert.equal(placed.facing, 1);
  assert.equal(f.castle.npcDesignations.length, 0);
  assert.equal(f.castle.gold, gold - T.weapons.cannon.cost);
  assert.ok(f.events.some(e => e.type === EV.BLOCK_BUILT && e.payload.weapon === 'cannon'));
});

test('TB3: demolition refunds the tuning fraction on completion and accepts destructible map blocks', () => {
  const f = fixture(), cell = [5, 1, 3]; f.put(...cell, BLOCK.WOOD);
  const gold = f.castle.gold;
  assert.ok(npcCommand(f.api, order(CMD.DEMOLISH, cell)));
  assert.equal(f.castle.gold, gold);
  const npc = person(4, ROLE.MASON, [4, 1, 3]); f.state.npcs.push(npc);
  emitJobs(f.api, f.castle); assert.ok(claimJob(f.api, f.castle, npc)); npc.state = NPC_STATE.WORK;
  work(f, npc, T.blocks.wood.buildS * K.TICK_HZ);
  assert.equal(f.plot.type[indexOf(f.plot, cell)], BLOCK.AIR);
  assert.equal(f.castle.gold, gold + T.blocks.wood.cost * T.economy.demolishRefundFrac);
  f.put(...cell, BLOCK.PALACE);
  assert.equal(npcCommand(f.api, order(CMD.DEMOLISH, cell)), true);
});

test('TB3: supported first, and worker never builds into a person who arrives after designation', () => {
  const f = fixture(); f.castle.workSpots = [];
  const upper = [5, 2, 3], lower = [5, 1, 3]; f.put(6, 2, 3, BLOCK.STONE);
  assert.ok(designate(f, upper)); assert.ok(designate(f, lower));
  f.put(6, 2, 3, BLOCK.AIR); // upper loses support while both designations are pending
  const npc = person(4, ROLE.MASON, [4, 1, 3]); f.state.npcs.push(npc);
  emitJobs(f.api, f.castle); const first = claimJob(f.api, f.castle, npc);
  assert.deepEqual(first.target.cell, lower); npc.state = NPC_STATE.WORK;
  const intruder = person(5, ROLE.CREW, [5, 1, 3], 1); f.state.npcs.push(intruder);
  work(f, npc, K.TICK_HZ); assert.equal(first.progress, 0, 'head intersects target');
  intruder.pos.x = 8.5;
  work(f, npc, K.TICK_HZ);
  assert.equal(f.plot.type[indexOf(f.plot, lower)], BLOCK.STONE);
  assert.ok(claimJob(f.api, f.castle, npc)); npc.state = NPC_STATE.WORK; work(f, npc, K.TICK_HZ);
  assert.equal(f.plot.type[indexOf(f.plot, upper)], BLOCK.STONE);
  assert.deepEqual(f.events.filter(e => e.type === EV.BLOCK_BUILT).map(e => e.payload.cell), [lower, upper]);
});

test('TB3: continuous enemy fire pauses build work, then the 30 s guard finishes one job', () => {
  const f = fixture(); f.castle.morale = T.npc.fearMoraleOverride - 1;
  assert.ok(designate(f, [5, 1, 3], BLOCK.WOOD));
  const npc = person(4, ROLE.MASON, [4, 1, 3]); f.state.npcs.push(npc);
  emitJobs(f.api, f.castle); const job = claimJob(f.api, f.castle, npc); npc.state = NPC_STATE.WORK;
  for (; f.state.tick < T.npc.fearDeadlockS * K.TICK_HZ; f.state.tick++) {
    f.castle.enemyImpacts = [{ tick: f.state.tick, pos: { x: 5.5, y: 1, z: 3.5 } }];
    tickWork(f.api, f.castle, npc);
  }
  assert.equal(job.progress, 0);
  work(f, npc, T.blocks.wood.buildS * K.TICK_HZ + 1);
  assert.equal(f.plot.type[indexOf(f.plot, [5, 1, 3])], BLOCK.WOOD);
});

test('TB3: calm morale lets a mason build during repeated enemy impacts', () => {
  const f = fixture(); f.castle.morale = T.npc.fearMoraleOverride;
  assert.ok(designate(f, [5, 1, 3], BLOCK.WOOD));
  const npc = person(4, ROLE.MASON, [4, 1, 3]); f.state.npcs.push(npc);
  emitJobs(f.api, f.castle); assert.ok(claimJob(f.api, f.castle, npc)); npc.state = NPC_STATE.WORK;
  for (let n = 0; n < T.blocks.wood.buildS * K.TICK_HZ; n++) {
    f.castle.enemyImpacts = [{ tick: f.state.tick, pos: { x: 5.5, y: 1, z: 3.5 } }];
    work(f, npc, 1);
  }
  assert.equal(f.plot.type[indexOf(f.plot, [5,1,3])], BLOCK.WOOD);
});

test('TB3: a mason avoids ending work inside another pending site (five simultaneous jobs cannot deadlock)', () => {
  const f = fixture(); f.castle.workSpots = [];
  for (const cell of [[4,1,3], [5,1,3]]) assert.ok(designate(f, cell));
  const npc = person(4, ROLE.MASON, [3,1,3]); f.state.npcs.push(npc);
  emitJobs(f.api, f.castle); assert.ok(claimJob(f.api, f.castle, npc));
  assert.ok(npc.path.at(-1)[0] < 4, 'worker stops outside both reserved cells');
});

test('TB3: live plus pending cannons obey weapon cap, and cancellation releases a cannon reservation', () => {
  const f = fixture(); f.put(5,1,3,BLOCK.MOUNT); f.put(7,1,3,BLOCK.MOUNT);
  f.state.weaponCap = 1;
  const place = cell => npcCommand(f.api, order(CMD.DESIGNATE_WEAPON, cell, { weapon: 'cannon', facing: 0 }));
  assert.ok(place([5,2,3])); assert.equal(place([7,2,3]), false);
  assert.ok(npcCommand(f.api, order(CMD.CANCEL,[5,2,3])));
  assert.equal(f.castle.gold, T.economy.startGold);
  assert.ok(place([7,2,3]));
});

test('TB3: enemy destruction of a demolition target releases its designation slot', () => {
  const f = fixture(), cell = [5,1,3]; f.put(...cell, BLOCK.STONE);
  assert.ok(npcCommand(f.api, order(CMD.DEMOLISH, cell)));
  f.put(...cell, BLOCK.AIR); emitJobs(f.api, f.castle);
  assert.equal(f.castle.npcDesignations.length, 0);
  assert.equal(f.castle.jobs.filter(j => j.kind === JOB.DEMOLISH).length, 0);
});

test('TB3: marking an oriented block for demolition preserves its facing and shape', () => {
  const f = fixture(), cell=[5,1,3]; f.put(...cell,BLOCK.STAIRS,undefined,3|4);
  assert.ok(npcCommand(f.api,order(CMD.DEMOLISH,cell)));
  assert.equal(f.plot.meta[indexOf(f.plot,cell)],3|4|META.DESIGNATED_BIT);
  assert.ok(npcCommand(f.api,order(CMD.CANCEL,cell)));
  assert.equal(f.plot.meta[indexOf(f.plot,cell)],3|4);
});
