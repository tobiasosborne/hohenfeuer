// tests/unit/ai-sweep.test.js - owns sweep pairing and acceptance aggregation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOptions, matchJobs, summarize } from '../../scripts/sweep.mjs';
test('sweep defaults to twenty paired matches, supports sixty and unequal AI levels', () => {
  const opts = parseOptions([]);
  assert.equal(matchJobs(opts).length, 20);
  assert.deepEqual(matchJobs(opts).slice(0, 2).map(j => [j.seed, j.swap]), [[1, false], [1, true]]);
  assert.equal(matchJobs(parseOptions(['--matches', '60'])).length, 60);
  const pool = matchJobs(parseOptions(['--matches','60','--ai-levels','3,5,8']));
  assert.equal(new Set(pool.map(j=>j.seed)).size,10);
  for(const level of [3,5,8]) assert.equal(pool.filter(j=>j.levels[0]===level).length,20);
  const jobs = matchJobs(parseOptions(['--seeds', '20', '--levels', '3,8', '--swap-slot']));
  assert.equal(jobs.length, 40);
  assert.deepEqual(jobs[1].levels, [8, 3]);
  assert.throws(() => parseOptions(['--matches', '0']));
  assert.throws(() => parseOptions(['--label', '../bad']));
});
test('sweep reports first-gun comebacks and excludes timeouts from wins', () => {
  const match = { seconds: 800, winnerSlot: 1, firstGunLoss: { slot: 1 }, sides: [0, 1].map(() => ({ goldAtCapShare: 0, goldNearCapShare: 0, goldNearZeroShare: .1, shots: 20, hits: 15, longestNoFireS: 50, longestReadyNoFireS: 0, blocksBuilt: 2, blocksRepaired: 3, npcDeaths: 1 })), loserDamageMinutes: 3, longestPalaceStallS: 200 };
  const s = summarize([match, { ...match, winnerSlot: null }]);
  assert.deepEqual(s.slotWins, [0, 1]);
  assert.equal(s.timeouts, 1);
  assert.equal(s.firstGunComebackShare, 1);
  assert.equal(s.palaceStepsPass, 1);
});
test('sweep can reproduce a later seed without replaying earlier matches',()=>{
  assert.deepEqual(matchJobs(parseOptions(['--seed-start','17','--matches','2'])).map(j=>[j.seed,j.swap]),[[17,false],[17,true]]);
});
