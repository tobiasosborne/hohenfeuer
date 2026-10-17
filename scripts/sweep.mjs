// scripts/sweep.mjs - owns reproducible paired headless match measurement and JSON evidence.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { availableParallelism } from 'node:os';
import { resolve, join } from 'node:path';
import { pathObserver } from './critique-metrics.mjs';
import * as C from '../src/contracts.js';
import { TUNING as T } from '../src/tuning.js';
import { registerCoreSim } from '../src/plugins/index.sim.js';
import { createSim } from '../src/sim/sim.js';
import { createSlotTable } from '../src/ai/slots.js';
import { palaceIntegrity } from '../src/sim/rules.js';
import { canFire } from '../src/npc/crew.js';

export function parseOptions(args) {
  const o = { label: 'sample', matches: 20, seedStart: 1, seeds: null, levels: [5, 5], levelPool: null, swapSlot: true, maxMinutes: 20, workers: Math.min(6, availableParallelism()), map: 'forest-duel' };
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--swap-slot') { o.swapSlot = true; continue; }
    if (key === '--no-swap-slot') { o.swapSlot = false; continue; }
    if (key === '--resume') { o.resume = true; continue; }
    const value = args[++i];
    if (key === '--output-dir') o.outputDir = value;
    else if (key === '--label') o.label = value;
    else if (key === '--matches') o.matches = Number(value);
    else if (key === '--seeds') o.seeds = Number(value);
    else if (key === '--seed-start') o.seedStart = Number(value);
    else if (key === '--levels') o.levels = value.split(',').map(Number);
    else if (key === '--ai-levels') o.levelPool = value.split(',').map(Number);
    else if (key === '--workers') o.workers = Number(value);
    else if (key === '--max-minutes') o.maxMinutes = Number(value);
    else if (key === '--map') o.map = value;
    else throw new Error(`Unknown option ${key}`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(o.label)) throw new Error('Label must be a simple filename');
  for (const v of [o.matches, o.workers, o.maxMinutes, o.seedStart, ...(o.seeds === null ? [] : [o.seeds])]) if (!Number.isInteger(v) || v < 1) throw new Error('Counts must be positive integers');
  if (o.levelPool && (!o.levelPool.length || o.levelPool.some(v => !Number.isInteger(v) || v < 1 || v > 10))) throw new Error('AI level pool must contain levels 1 to 10');
  if (o.levels.length === 1) o.levels.push(o.levels[0]);
  if (o.levels.length !== 2 || o.levels.some(v => !Number.isInteger(v) || v < 1 || v > 10)) throw new Error('Levels must be one or two integers from 1 to 10');
  if (o.swapSlot && o.seeds === null && o.matches % 2) throw new Error('Paired sweeps need an even match count');
  return o;
}
export function matchJobs(o) {
  const count = o.seeds === null ? o.matches : o.seeds * (o.levelPool?.length ?? 1) * (o.swapSlot ? 2 : 1);
  return Array.from({ length: count }, (_, i) => {
    const swap = o.swapSlot && i % 2 === 1;
    const pair = o.swapSlot ? Math.floor(i / 2) : i;
    const level = o.levelPool?.[pair % o.levelPool.length];
    return { index: i, seed: Math.floor(pair / (o.levelPool?.length ?? 1)) + o.seedStart, swap, levels: level ? [level,level] : swap ? [...o.levels].reverse() : [...o.levels], map: o.map, maxMinutes: o.maxMinutes };
  });
}
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
export function summarize(matches) {
  const wins = [0, 1].map(s => matches.filter(m => m.winnerSlot === s).length), finished = matches.filter(m => m.winnerSlot !== null);
  const first = finished.filter(m => m.firstGunLoss !== null && m.firstGunLoss !== undefined && !m.firstGunLoss.simultaneous);
  const sides = matches.flatMap(m => m.sides), lengths = matches.map(m => m.seconds);
  return { matches: matches.length, slotWins: wins, slotWinShares: wins.map(n => n / matches.length), timeouts: matches.filter(m => m.winnerSlot === null).length,
    lengthMinS: Math.min(...lengths), lengthMeanS: mean(lengths), lengthMaxS: Math.max(...lengths), lengthStdDevS: Math.sqrt(mean(lengths.map(s => (s - mean(lengths)) ** 2))),
    pacingPass: matches.filter(m => m.winnerSlot !== null && m.seconds >= 720 && m.seconds <= 1200).length,
    goldAtCapShares: [0, 1].map(s => mean(matches.map(m => m.sides[s].goldAtCapShare))),
    goldNearCapShares: [0, 1].map(s => mean(matches.map(m => m.sides[s].goldNearCapShare))),
    maxGoldAtCapShare: Math.max(...sides.map(s => s.goldAtCapShare)), goldNearZeroMeanShare: mean(sides.map(s => s.goldNearZeroShare)),
    firstGunMatches: first.length, firstGunComebacks: first.filter(m => m.winnerSlot === m.firstGunLoss.slot).length,
    firstGunComebackShare: first.length ? first.filter(m => m.winnerSlot === m.firstGunLoss.slot).length / first.length : null,
    palaceStepsPass: finished.filter(m => m.loserDamageMinutes >= 3).length,
    palaceStallPass: matches.filter(m => m.longestPalaceStallS <= 300).length,
    fireWindowPass: matches.filter(m => m.sides.every(s => s.longestNoFireS <= 120)).length,
    maxNoFireS: Math.max(...sides.map(s => s.longestNoFireS)), maxReadyNoFireS: Math.max(...sides.map(s => s.longestReadyNoFireS)),
    shots: [0, 1].map(s => mean(matches.map(m => m.sides[s].shots))), hits: [0, 1].map(s => mean(matches.map(m => m.sides[s].hits))),
    blocksBuilt: mean(sides.map(s => s.blocksBuilt)), blocksRepaired: mean(sides.map(s => s.blocksRepaired)), npcDeaths: mean(sides.map(s => s.npcDeaths)),
    reasons: Object.fromEntries([...new Set(matches.map(m => m.eliminationReason ?? 'timeout'))].map(r => [r, matches.filter(m => (m.eliminationReason ?? 'timeout') === r).length])) };
}
export function summaryTable(s) {
  const pct = n => `${(n * 100).toFixed(1)}%`;
  return ['| Metric | Result |', '|---|---|',
    `| Matches / timeouts | ${s.matches} / ${s.timeouts} |`,
    `| Length min / mean / max (min) | ${[s.lengthMinS, s.lengthMeanS, s.lengthMaxS].map(v => (v / 60).toFixed(2)).join(' / ')} |`,
    `| 12–20 min finishes | ${s.pacingPass}/${s.matches} |`,
    `| Slot 0 / 1 wins | ${s.slotWins.join(' / ')} (${s.slotWinShares.map(pct).join(' / ')}) |`,
    `| Gold at cap, slot 0 / 1 | ${s.goldAtCapShares.map(pct).join(' / ')} |`,
    `| Worst side at cap | ${pct(s.maxGoldAtCapShare)} |`,
    `| Gold >=95% cap, slot 0 / 1 | ${s.goldNearCapShares.map(pct).join(' / ')} |`,
    `| Gold <=10% cap | ${pct(s.goldNearZeroMeanShare)} |`,
    `| First-gun-loss comebacks | ${s.firstGunComebacks}/${s.firstGunMatches} (${s.firstGunComebackShare === null ? 'n/a' : pct(s.firstGunComebackShare)}) |`,
    `| Loser damaged in >=3 minutes | ${s.palaceStepsPass}/${s.matches} |`,
    `| No palace stall >5 min | ${s.palaceStallPass}/${s.matches} |`,
    `| Both fire every 2 min | ${s.fireWindowPass}/${s.matches} |`,
    `| Longest no-fire / ready no-fire (s) | ${s.maxNoFireS.toFixed(1)} / ${s.maxReadyNoFireS.toFixed(1)} |`,
    `| Mean shots / hits (slots) | ${s.shots.map(v => v.toFixed(1)).join(' / ')}; ${s.hits.map(v => v.toFixed(1)).join(' / ')} |`,
    `| Mean built / repaired / deaths per side | ${[s.blocksBuilt, s.blocksRepaired, s.npcDeaths].map(v => v.toFixed(1)).join(' / ')} |`,
    `| Elimination reasons | ${JSON.stringify(s.reasons)} |`].join('\n');
}

export function runMatch(job, onProgress = () => {}) {
  const paths = pathObserver();
  C.resetRegistriesForTests(); registerCoreSim(); C.freezeRegistries();
  // Swap physical placements and their castle/controller identity together. Slot 0
  // therefore attacks from the east in the reverse leg; wind/terrain seed is unchanged.
  const base = C.getMap(job.map);
  if (!base || base.slots.length !== 2) throw new Error('Sweep requires a registered two-slot duel map');
  const map = { ...base, slots: job.swap ? [...base.slots].reverse() : [...base.slots] };
  const slots = createSlotTable(map, { aiLevel: 5, slots: job.levels.map(aiLevel => ({ aiLevel })) });
  let api, stageGold;
  const spending = new Map(), perSide = [0, 1].map(() => ({ capTicks: 0, nearCapTicks: 0, lowTicks: 0, lastShot: 0, longestNoFireS: 0, readyTicks: 0, longestReadyNoFireS: 0, npcDeaths: 0, blocksDestroyed: 0, blocksCollapsed: 0, blocksBuilt: 0, blocksRepaired: 0, shotsByMinute: [], damageMinutes: new Set(), goldBlockedShotTicks: 0, goldBlockedReplacementTicks: 0, spend: { weapons: 0, jobs: 0 } }));
  const sim = createSim({ map, seed: job.seed, slots, hooks: { onReady(a) { api = a; }, onStage(stage) {
    if (stageGold) {
      for (let i = 0; i < 2; i++) {
        const amount = stageGold.gold[i] - api.state.castles[i].gold;
        if (amount > 1e-8) {
          const kind = stageGold.stage === 'weapons' ? 'weapons' : 'jobs', second = Math.floor(api.tick / T.sim.tickHz);
          perSide[i].spend[kind] += amount;
          const key = `${second}:${i}:${kind}`, e = spending.get(key) ?? { second, slot: i, kind, gold: 0 };
          e.gold += amount; spending.set(key, e);
        }
      }
    }
    stageGold = stage === 'commands' || stage === 'weapons' || stage === 'jobs' ? { stage, gold: api.state.castles.map(c => c.gold) } : null;
  } } });
  const minuteCurve = [], goldTrajectory = [], moraleBandEvents = [], shotEvents = [], gunLossEvents = [];
  let previousPalace = api.state.castles.map(palaceIntegrity), lastPalaceChange = 0, longestPalaceStallTicks = 0, firstGunLoss = null;
  const record = () => ({ second: api.tick / T.sim.tickHz, sides: api.state.castles.map(c => ({ gold: c.gold, palace: palaceIntegrity(c), morale: c.morale, population: c.population, shots: c.stats.shots, hits: c.stats.directHits, guns: api.state.weapons.filter(w => w.slot === c.slot && w.hp > 0).length })) });
  minuteCurve.push(record());
  for (let tick = 0; tick < job.maxMinutes * 60 * T.sim.tickHz && !api.state.outcome; tick++) {
    sim.tick([]);
    const now = api.tick, state = api.state, palace = state.castles.map(palaceIntegrity);
    if (palace.some((v, i) => v !== previousPalace[i])) { lastPalaceChange = now; }
    longestPalaceStallTicks = Math.max(longestPalaceStallTicks, now - lastPalaceChange);
    palace.forEach((v, i) => { if (v < previousPalace[i]) perSide[i].damageMinutes.add(Math.floor((now - 1) / (60 * T.sim.tickHz))); });
    previousPalace = palace;
    const events = sim.drainEvents(), losses = [];
    paths.sample(state, events);
    for (const { type, payload: p } of events) {
      const i = p.slot ?? p.castle ?? p.plot;
      if (type === C.EV.SHOT_FIRED) { const side = perSide[i]; side.longestNoFireS = Math.max(side.longestNoFireS, (now - side.lastShot) / T.sim.tickHz); side.lastShot = now; side.readyTicks = 0; side.shotsByMinute[Math.floor((now - 1) / (60 * T.sim.tickHz))] = (side.shotsByMinute[Math.floor((now - 1) / (60 * T.sim.tickHz))] ?? 0) + 1; shotEvents.push({ second: now / T.sim.tickHz, slot: i, weaponId: p.weaponId }); }
      if (type === C.EV.NPC_DIED) perSide[i].npcDeaths++;
      if (type === C.EV.MORALE_BAND) moraleBandEvents.push({ second: now / T.sim.tickHz, ...p });
      if (type === C.EV.WEAPON_DESTROYED) { const slot = state.weapons.find(w => w.id === p.weaponId)?.slot; if (slot !== undefined) losses.push(slot); }
      if (type === C.EV.BLOCK_DESTROYED) perSide[i].blocksDestroyed++;
      if (type === C.EV.COLLAPSE) perSide[i].blocksCollapsed += p.cells.length;
      if (type === C.EV.BLOCK_BUILT && !p.weapon) perSide[i].blocksBuilt++;
      if (type === C.EV.BLOCK_DAMAGED && p.hp === C.getBlock(p.id)?.hp) perSide[i].blocksRepaired++;
    }
    if (losses.length) { const loss = { second: now / T.sim.tickHz, slot: losses[0], simultaneous: new Set(losses).size > 1 }; gunLossEvents.push(loss); firstGunLoss ??= loss; }
    for (let i = 0; i < 2; i++) {
      const c = state.castles[i], side = perSide[i];
      if (c.gold >= T.economy.goldCap - 1e-6) side.capTicks++;
      if (c.gold >= .95 * T.economy.goldCap) side.nearCapTicks++;
      if (c.gold <= .1 * T.economy.goldCap) side.lowTicks++;
      if (state.weapons.some(w => w.slot === i && w.hp > 0 && w.reload >= C.getWeapon(w.defId).reloadS && canFire(w, c) && c.gold < C.getWeapon(w.defId).fireCost)) side.goldBlockedShotTicks++;
      if (state.weapons.filter(w => w.slot === i && w.hp > 0).length < c.weapons.length && c.gold < C.getWeapon(c.weapons[0].id).cost) side.goldBlockedReplacementTicks++;
      const ready = state.weapons.some(w => w.slot === i && w.hp > 0 && w.reload >= C.getWeapon(w.defId).reloadS && c.gold >= C.getWeapon(w.defId).fireCost && canFire(w, c));
      side.readyTicks = ready ? side.readyTicks + 1 : 0;
      side.longestReadyNoFireS = Math.max(side.longestReadyNoFireS, side.readyTicks / T.sim.tickHz);
    }
    if (now % T.sim.tickHz === 0) goldTrajectory.push({ second: now / T.sim.tickHz, gold: state.castles.map(c => c.gold) });
    if (now % (60 * T.sim.tickHz) === 0) { const sample = record(); minuteCurve.push(sample); onProgress(sample); }
  }
  minuteCurve.push(record());
  const state = api.state, winnerSlot = state.outcome?.winners.length === 1 ? state.outcome.winners[0] : null;
  return { ...job, ticks: state.tick, seconds: state.tick / T.sim.tickHz, winnerSlot, eliminationReason: state.castles.find(c => c.eliminated)?.reason ?? null, outcome: state.outcome, hash: sim.hash(), firstGunLoss, gunLossEvents,
    longestPalaceStallS: longestPalaceStallTicks / T.sim.tickHz, loserDamageMinutes: winnerSlot === null ? 0 : perSide[1 - winnerSlot].damageMinutes.size,
    sides: perSide.map((s, i) => ({ shots: state.castles[i].stats.shots, hits: state.castles[i].stats.directHits, goldAtCapShare: s.capTicks / state.tick, goldNearCapShare: s.nearCapTicks / state.tick, goldNearZeroShare: s.lowTicks / state.tick, longestNoFireS: Math.max(s.longestNoFireS, (state.tick - s.lastShot) / T.sim.tickHz), longestReadyNoFireS: s.longestReadyNoFireS, npcDeaths: s.npcDeaths, blocksDestroyed: s.blocksDestroyed, blocksCollapsed: s.blocksCollapsed, blocksBuilt: s.blocksBuilt, blocksRepaired: s.blocksRepaired, shotsByMinute: Array.from(s.shotsByMinute, n => n ?? 0), damageMinutes: [...s.damageMinutes], goldBlockedShotS: s.goldBlockedShotTicks / T.sim.tickHz, goldBlockedReplacementS: s.goldBlockedReplacementTicks / T.sim.tickHz, spend: s.spend })),
    minuteCurve, goldTrajectory, spendEvents: [...spending.values()], shotEvents, moraleBandEvents, paths: { sides: paths.sides, series: paths.series } };
}

async function main() {
  const options = parseOptions(process.argv.slice(2)), workers = [];
  const outputDir = resolve(options.outputDir ?? 'tests/evidence');
  mkdirSync(outputDir, { recursive: true });
  const matches = options.resume ? JSON.parse(readFileSync(join(outputDir, `sweep-${options.label}-partial.json`), 'utf8')) : [];
  const allJobs = matchJobs(options);
  if (matches.some(m => !allJobs.some(j => j.index === m.index && j.seed === m.seed && j.swap === m.swap && j.map === m.map && String(j.levels) === String(m.levels)))) throw new Error('Resume cohort mismatch');
  const jobs = allJobs.filter(j => !matches.some(m => m.index === j.index));
  const digest = createHash('sha256');
  for (const path of ['src/tuning.js', 'src/sim/sim.js', 'src/ai/controller.js', 'src/ai/targets.js', 'src/npc/brain.js', 'src/plugins/castles/default.sim.js']) digest.update(readFileSync(new URL(`../${path}`, import.meta.url)));
  const sourceSha256 = digest.digest('hex');
  await Promise.all(Array.from({ length: Math.min(options.workers, jobs.length) }, () => new Promise((resolve, reject) => {
    const w = new Worker(new URL(import.meta.url), { workerData: true }); workers.push(w);
    w.on('error', reject);
    w.on('message', message => {
      if (message.progress) { console.log(`progress ${message.index + 1}: minute ${message.progress.second / 60}, palace ${message.progress.sides.map(s => s.palace.toFixed(3)).join('/')}, shots ${message.progress.sides.map(s => s.shots).join('/')}`); return; }
      if (message.ready) { console.log('worker ready'); const job = jobs.shift(); if (job) w.postMessage(job); else { w.terminate(); resolve(); } return; }
      matches.push(message); writeFileSync(join(outputDir, `sweep-${options.label}-partial.json`), JSON.stringify(matches)); console.log(`match ${message.index + 1}: seed ${message.seed}${message.swap ? ' swapped' : ''}, ${(message.seconds / 60).toFixed(2)}m, winner ${message.winnerSlot}, shots ${message.sides.map(s => s.shots).join('/')}`);
      const job = jobs.shift(); if (job) w.postMessage(job); else { w.terminate(); resolve(); }
    });
  })));
  matches.sort((a, b) => a.index - b.index);
  const summary = summarize(matches), table = summaryTable(summary), result = { schema: 1, options, sourceSha256, tickHz: T.sim.tickHz, tuning: { economy: T.economy, blocks: { stone: T.blocks.stone, tower: T.blocks.tower, palace:T.blocks.palace, mount:T.blocks.mount }, palace: T.palace, repairFullS: T.npc.repairFullS, npc:T.npc, ai:T.ai, sim:T.sim }, summary, table, matches };
  mkdirSync(new URL('../tests/evidence/', import.meta.url), { recursive: true });
  writeFileSync(join(outputDir, `sweep-${options.label}.json`), `${JSON.stringify(result, null, 2)}\n`);
  console.log(table);
}
if (!isMainThread && workerData === true) { parentPort.on('message', job => { try { parentPort.postMessage(runMatch(job, progress => parentPort.postMessage({ index: job.index, progress }))); } catch (e) { throw e; } }); parentPort.postMessage({ ready: true }); }
else if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`))) await main();
