// tests/unit/npc-resilience.test.js - owns recovery, construction and blast adapter regressions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK, ROLE, NPC_STATE, JOB, EV, CMD, META, K } from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';
import { npcTick, npcKinematics, npcCommand, recordNpcEvent } from '../../src/npc/index.js';
import { emitJobs, fearAllows, tickWork, claimJob, discoverMagazines } from '../../src/npc/jobs.js';
import { fixture, person } from './npc-fixture.test.js';

test('a changed cell beyond the initial revalidation window breaks the claim before entry', () => {
  const f = fixture({ width: 12, depth: 1 }); f.castle.npcSpawned = true; f.castle.workSpots = [];
  f.put(11, 1, 0, BLOCK.STONE, 2); const n = person(4, ROLE.MASON, [0, 1, 0]); f.state.npcs.push(n);
  emitJobs(f.api, f.castle); const job = claimJob(f.api, f.castle, n); assert.ok(job);
  f.put(7, 1, 0, BLOCK.STONE);
  for (let i = 0; i < 100; i++) { npcKinematics(f.api); f.state.tick++; }
  assert.ok(n.pos.x < 7); assert.equal(n.jobId, null); assert.deepEqual(job.claimedBy, []);
});

test('anti-deadlock allows its selected job to finish despite continuing impacts', () => {
  const f = fixture(); f.castle.npcSpawned = true; f.castle.morale = 50; f.put(3, 1, 2, BLOCK.STONE, 10);
  const n = person(4, ROLE.MASON, [2, 1, 2]); f.state.npcs.push(n); emitJobs(f.api, f.castle);
  f.state.tick = T.npc.fearDeadlockS * K.TICK_HZ;
  f.castle.enemyImpacts = [{ tick: f.state.tick, pos: { x: 3.5, y: 1, z: 2.5 } }];
  const job = claimJob(f.api, f.castle, n); assert.ok(job);
  for (let i = 0; i < T.npc.repairFullS * K.TICK_HZ; i++) { f.castle.enemyImpacts[0].tick = f.state.tick; tickWork(f.api, f.castle, n); f.state.tick++; }
  assert.equal(f.castle.jobs.includes(job), false);
});

test('magazine destruction queues the stock-scaled explosion once for a connected store', () => {
  const f = fixture(); f.put(3, 1, 2, BLOCK.MAGAZINE); f.put(4, 1, 2, BLOCK.MAGAZINE); discoverMagazines(f.api, f.castle);
  const blasts = []; f.api.applyBlast = blast => blasts.push(blast); const stock = T.magazine.capacityLoads;
  for (const cell of [[3, 1, 2], [4, 1, 2]]) recordNpcEvent(f.api, EV.BLOCK_DESTROYED, { plot: 0, cell, id: BLOCK.MAGAZINE, sourceSlot: 1 });
  assert.equal(blasts.length, 1);
  assert.equal(blasts[0].radius, Math.min(T.magazine.radiusMax, T.magazine.radiusBase + T.magazine.radiusPerLoad * stock));
  assert.equal(blasts[0].splash, Math.min(T.magazine.splashMax, T.magazine.splashBase + T.magazine.splashPerLoad * stock));
  assert.equal(f.castle.magazines[0].stock, 0); assert.equal(f.events.filter(e => e.type === EV.MAGAZINE_EXPLODED).length, 1);
});

test('designations reserve gold, cancel only that cell, build supported cells, never into a person', () => {
  const f = fixture(); f.castle.npcSpawned = true; f.castle.workSpots = [];
  const a = [3, 1, 2], b = [5, 1, 2], startGold = f.castle.gold;
  for (const cell of [a, b]) assert.ok(npcCommand(f.api, { type: CMD.DESIGNATE, slot: 0, cell, block: BLOCK.STONE, facing: 0 }));
  assert.equal(f.castle.gold, startGold - 2 * T.blocks.stone.cost);
  npcCommand(f.api, { type: CMD.CANCEL, slot: 0, cell: a });
  assert.equal(f.castle.npcDesignations.length, 1); assert.deepEqual(f.castle.npcDesignations[0].cell, b);
  assert.equal(f.castle.gold, startGold - T.blocks.stone.cost);
  const n = person(4, ROLE.MASON, [4, 1, 2]), blocker = person(5, ROLE.CIVILIAN, b); f.state.npcs.push(n, blocker);
  emitJobs(f.api, f.castle); assert.equal(claimJob(f.api, f.castle, n), null);
  blocker.pos.x += 2; const job = claimJob(f.api, f.castle, n); assert.ok(job);
  for (let i = 0; i < T.blocks.stone.buildS * K.TICK_HZ + 1; i++) { tickWork(f.api, f.castle, n); f.state.tick++; }
  assert.equal(f.plot.type[5 + f.plot.width * 2 + f.plot.width * f.plot.depth], BLOCK.STONE);
  assert.equal(f.castle.jobs.includes(job), false);
});

test('path searches are limited to eight per castle per tick and queued workers advance next tick', () => {
  const f = fixture({ width: 30 }); f.castle.npcSpawned = true; f.castle.workSpots = [];
  for (let i = 0; i < 16; i++) {
    f.castle.workSpots.push({ x: i + 2.5, y: 1, z: 4.5 });
    f.state.npcs.push(person(i + 4, ROLE.CIVILIAN, [0, 1, 0]));
  }
  npcTick(f.api, f.castle);
  assert.equal(f.castle.npcSearchCount, T.npc.pathSearchesPerTick);
  assert.equal(f.state.npcs.filter(n => n.jobId !== null).length, T.npc.pathSearchesPerTick);
  f.state.tick++; npcTick(f.api, f.castle); assert.equal(f.state.npcs.filter(n => n.jobId !== null).length, 16);
});

test('plugin pickJob may decline work, and haul legs respect the one-second replan limit', () => {
  const f = fixture(); f.castle.npcSpawned = true;
  const n = person(4, ROLE.CIVILIAN); f.state.npcs.push(n); emitJobs(f.api, f.castle);
  assert.equal(claimJob(f.api, f.castle, n, () => null), null);
  assert.equal(n.jobId, null);
  const g = fixture(); g.castle.npcSpawned = true; g.castle.workSpots = [];
  g.put(2, 1, 2, BLOCK.MAGAZINE);
  const runner = person(4, ROLE.RUNNER, [2, 1, 3]); g.state.npcs.push(runner);
  g.state.weapons.push({ id: 0, slot: 0, defId: 'cannon', hp: T.weapons.cannon.hp, pos: { x: 8.5, y: 1, z: 3.5 }, ammo: 0, facing: 0 });
  emitJobs(g.api, g.castle); claimJob(g.api, g.castle, runner); tickWork(g.api, g.castle, runner);
  assert.equal(g.castle.npcSearchCount, 1); assert.equal(runner.carrying, 0);
  g.state.tick = T.npc.pathReplanMinS * K.TICK_HZ;
  tickWork(g.api, g.castle, runner); assert.equal(runner.carrying, T.npc.carryLoads);
});
