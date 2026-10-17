// tests/unit/npc-jobs.test.js - owns job emission, claim and logistics acceptance tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK, JOB, ROLE, NPC_STATE, META, EV, K } from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';
import { emitJobs, claimJob, expireClaims, fearAllows, tickWork, discoverMagazines } from '../../src/npc/jobs.js';
import { fixture, person } from './npc-fixture.test.js';

test('emitters create repair, designated build, ammo, crew and civilian work exactly once', () => {
  const f = fixture(); f.put(4, 1, 3, BLOCK.STONE, T.blocks.stone.hp * 0.4);
  f.plot.meta[5 + f.plot.width * 3 + f.plot.width * f.plot.depth] |= META.DESIGNATED_BIT;
  f.state.weapons.push({ id: 0, slot: 0, defId: 'cannon', pos: { x: 7.5, y: 1, z: 3.5 }, hp: 36, crewOrdered: true, ammo: 0 });
  emitJobs(f.api, f.castle); const n = f.castle.jobs.length; emitJobs(f.api, f.castle);
  assert.equal(f.castle.jobs.length, n);
  for (const kind of [JOB.BUILD, JOB.REPAIR, JOB.HAUL_AMMO, JOB.CREW, JOB.WORK]) assert.ok(f.castle.jobs.some(j => j.kind === kind));
  assert.equal(f.castle.jobs.find(j => j.kind === JOB.CREW).slots, Math.ceil(T.weapons.cannon.crewSlots * T.weaponRules.minCrewFrac));
  assert.equal(f.events.filter(e => e.type === EV.JOB_CREATED).length, n);
});

test('claim selection uses priority, distance, id, respects roles and reports unreachable jobs', () => {
  const f = fixture({ width: 10, depth: 1 }); f.castle.workSpots = [];
  for (const x of [3, 6]) f.put(x, 1, 0, BLOCK.STONE, 5);
  for(const y of [2,3])f.put(3,y,0,BLOCK.STONE);
  const npc = person(4, ROLE.MASON, [1, 1, 0]); f.state.npcs.push(npc);
  emitJobs(f.api, f.castle);
  const far = f.castle.jobs.find(j => j.target.cell?.[0] === 6); far.priority = 3;
  const claim = claimJob(f.api, f.castle, npc);
  assert.equal(claim.target.cell[0], 3); // high-priority job cannot be reached across the solid block
  assert.equal(far.reachable, true);
  assert.equal(far.blockedNpcUntil[npc.id], T.npc.claimBlockedS * K.TICK_HZ);
  assert.ok(f.events.some(e => e.type === EV.JOB_UNREACHABLE));
  assert.ok(f.events.some(e => e.type === EV.JOB_CLAIMED));
});

for (const reason of ['death', 'flee', 'shelter', 'path', 'timeout']) test(`claims expire on ${reason}`, () => {
  const f = fixture(); f.castle.workSpots = []; f.put(7, 1, 2, BLOCK.STONE, 5);
  const npc = person(4, ROLE.MASON, [1, 1, 2]); f.state.npcs.push(npc);
  emitJobs(f.api, f.castle); const job = claimJob(f.api, f.castle, npc); assert.ok(job);
  if (reason === 'death') npc.hp = 0;
  if (reason === 'flee') npc.state = NPC_STATE.FLEE;
  if (reason === 'shelter') npc.state = NPC_STATE.SHELTER;
  if (reason === 'path') { const c = npc.path[npc.pathIndex]; f.put(...c, BLOCK.STONE); }
  if (reason === 'timeout') f.state.tick = T.npc.claimTimeoutS * K.TICK_HZ + 1;
  expireClaims(f.api, f.castle);
  assert.deepEqual(job.claimedBy, []); assert.equal(npc.jobId, null);
});

test('fear rejects recent nearby enemy impacts but lifts highest-priority repair at 30 seconds', () => {
  const f = fixture(); f.put(6, 1, 3, BLOCK.STONE, 5); f.castle.morale = T.npc.fearMoraleOverride - 1;
  emitJobs(f.api, f.castle); const job = f.castle.jobs.find(j => j.kind === JOB.REPAIR);job.priority=3;
  f.castle.enemyImpacts = [{ tick: 0, pos: { x: 6.5, y: 1, z: 3.5 } }];
  assert.equal(fearAllows(f.api, f.castle, job), false);
  f.castle.morale = T.npc.fearMoraleOverride; assert.ok(fearAllows(f.api, f.castle, job));
  f.castle.morale--; f.state.tick = T.npc.fearDeadlockS * K.TICK_HZ;
  f.castle.enemyImpacts[0].tick = f.state.tick; assert.ok(fearAllows(f.api, f.castle, job));
  f.castle.lastRepairProgressTick = f.state.tick; assert.ok(fearAllows(f.api, f.castle, job));
});

test('repairs progress at maxHp/12 per second (research/16 P2), debit repair gold and finish once', () => {
  const f = fixture(); f.castle.workSpots = []; f.castle.morale = 50;
  f.put(3, 1, 2, BLOCK.STONE, 10);
  const npc = person(4, ROLE.MASON, [2, 1, 2]); f.state.npcs.push(npc);
  emitJobs(f.api, f.castle); const job = claimJob(f.api, f.castle, npc); npc.state = NPC_STATE.WORK;
  const gold = f.castle.gold;
  for (let i = 0; i < K.TICK_HZ; i++) { tickWork(f.api, f.castle, npc); f.state.tick++; }
  const idx = 3 + f.plot.width * 2 + f.plot.width * f.plot.depth;
  assert.equal(f.plot.hp[idx], 10 + Math.floor(T.blocks.stone.hp / T.npc.repairFullS));
  assert.ok(f.castle.gold < gold);
  for (let i = 0; i < T.npc.repairFullS * K.TICK_HZ; i++) { tickWork(f.api, f.castle, npc); f.state.tick++; }
  assert.equal(f.plot.hp[idx], T.blocks.stone.hp);
  assert.equal(f.events.filter(e => e.type === EV.JOB_DONE && e.payload.jobId === job.id).length, 1);
});

test('magazines are connected stores, preserve stock, and disappear when destroyed', () => {
  const f = fixture(); f.put(3, 1, 2, BLOCK.MAGAZINE); f.put(3, 2, 2, BLOCK.MAGAZINE);
  discoverMagazines(f.api, f.castle); assert.equal(f.castle.magazines.length, 1);
  f.castle.magazines[0].stock = 7;
  f.put(6, 1, 3, BLOCK.STONE); discoverMagazines(f.api, f.castle);
  assert.equal(f.castle.magazines[0].stock, 7);
  f.put(3, 1, 2, BLOCK.AIR); f.put(3, 2, 2, BLOCK.AIR); discoverMagazines(f.api, f.castle);
  assert.deepEqual(f.castle.magazines, []);
});
