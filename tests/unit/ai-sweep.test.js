// tests/unit/ai-sweep.test.js - owns sweep pairing and acceptance aggregation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOptions, matchJobs, summarize, lowMotionStall } from '../../scripts/sweep.mjs';
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
test('unequal-level sweep exercises both physical assignments independently of slot order', () => {
  const jobs = matchJobs(parseOptions(['--seeds','10','--levels','3,8','--both-assignments']));
  assert.equal(jobs.length,40);
  for (const seed of new Set(jobs.map(j=>j.seed))) {
    const group=jobs.filter(j=>j.seed===seed);
    assert.deepEqual(group.map(j=>j.physicalLevels), [[3,8],[3,8],[8,3],[8,3]]);
    assert.deepEqual(group.map(j=>j.levels), [[3,8],[8,3],[8,3],[3,8]]);
  }
});
test('a return-leg-only cohort preserves physical skill and seed identity',()=>{
  const jobs=matchJobs(parseOptions(['--seeds','10','--levels','3,8','--reverse-only']));
  assert.equal(jobs.length,10);assert.ok(jobs.every(j=>j.swap));
  assert.deepEqual(jobs.map(j=>j.seed),Array.from({length:10},(_,i)=>i+1));
  assert.ok(jobs.every(j=>String(j.physicalLevels)==='3,8'&&String(j.levels)==='8,3'));
});
test('low-motion measurement includes an opening plateau after the two-minute exclusion',()=>{
  const series=Array.from({length:1001},(_,second)=>({second,sides:[{palace:1}]}));
  assert.equal(lowMotionStall(series,0),880);
  for(let i=201;i<series.length;i++)series[i].sides[0].palace=.97;
  assert.equal(lowMotionStall(series,0),799);
});

test('strict plateau aggregation scopes both the count and maximum to eventual losers',()=>{
  const base={seconds:900,winnerSlot:0,firstGunLoss:null,sides:[0,1].map(()=>({goldAtCapShare:0,goldNearCapShare:0,goldNearZeroShare:0,shots:20,hits:10,longestNoFireS:40,longestReadyNoFireS:0,blocksBuilt:1,blocksRepaired:1,npcDeaths:0})),loserDamageMinutes:3,longestPalaceStallS:200};
  const s=summarize([{...base,lowMotion:[508,332]},{...base,winnerSlot:1,lowMotion:[231,800]},{...base,winnerSlot:null,lowMotion:[1000,1000]}]);
  assert.deepEqual(s.losingPalaceLowMotion,{samples:2,over180S:2,maxS:332});
});
