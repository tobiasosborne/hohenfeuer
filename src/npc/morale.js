// src/npc/morale.js - owns two-layer morale, projectile credit and spiral guards.
import { BLOCK, ROLE, NPC_STATE, EV, K } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { localCell, indexOf, vector, feet, ticks, ownNpcs, workSpeed } from './model.js';
export { workSpeed } from './model.js';

/** Keep all authoritative accumulators on the castle for normal sim save/hash support. */
function layers(castle) {
  if (!castle.moraleState) {
    const start = typeof castle.morale === 'number' ? castle.morale : T.morale.start;
    castle.moraleState = { fast: start, baseline: start, band: bandOf(start), deaths: [], countedDeaths: {},
      projectiles: {}, lastRallyTick: -ticks(T.morale.rallyCooldownS), rallyArmed: start < T.morale.rallyBelow,
      desertTicks: 0, surrenderTicks: 0 };
  }
  return castle.moraleState;
}
const bandOf = m => T.morale.workBands.findIndex(([minimum]) => m >= minimum);
const clamp = n => Math.min(100, Math.max(T.morale.floor, n));

/** Input adapter: one record describes one projectile, or a batch of individually identified deaths. */
export function queueMoraleInput(castle, input) { (castle.moraleInputs ??= []).push(input); }

function hostile(api, sourceSlot, targetSlot) {
  if (sourceSlot === undefined || sourceSlot === null || sourceSlot === targetSlot) return false;
  const slots = api.state.slots ?? [], source = slots.find(s => s.id === sourceSlot), target = slots.find(s => s.id === targetSlot);
  return !source || !target || source.team !== target.team;
}

/** Feed this from the sim emit callback; raw damage events intentionally give no hit credit. */
export function recordNpcEvent(api, type, payload) {
  if (type === EV.BLOCK_DESTROYED && payload.id === BLOCK.MAGAZINE) {
    const castle = api.state.castles.find(c => c.plot.id === payload.plot), i = castle ? indexOf(castle.plot, payload.cell) : -1;
    const store = castle?.magazines?.find(m => m.cells.includes(i));
    if (store?.stock > 0) {
      const stock = store.stock; store.stock = 0;
      if (T.magazine.explosions) {
        const pos = feet(castle.plot, payload.cell); pos.y += 0.5;
        api.applyBlast({ pos, direct: 0, splash: Math.min(T.magazine.splashMax, T.magazine.splashBase + T.magazine.splashPerLoad * stock),
          radius: Math.min(T.magazine.radiusMax, T.magazine.radiusBase + T.magazine.radiusPerLoad * stock), sourceSlot: payload.sourceSlot });
        api.emit(EV.MAGAZINE_EXPLODED, { plot: payload.plot, cell: payload.cell, stock });
      }
    }
  }
  if (type === EV.NPC_DIED) {
    const castle = api.state.castles.find(c => c.id === payload.castle);
    if (castle && payload.cause !== 'desertion') queueMoraleInput(castle, { deaths: [{ entityId: payload.entityId, role: payload.role }] });
  }
  if (type !== EV.IMPACT || !payload.pos) return;
  const pos = vector(payload.pos), sourceSlot = payload.sourceSlot ?? payload.slot;
  for (const castle of api.state.castles) if (hostile(api, sourceSlot, castle.slot) && indexOf(castle.plot, localCell(castle.plot, pos)) >= 0) {
    const impacts = castle.enemyImpacts ??= [];
    const key = `${sourceSlot}:${payload.projectileId ?? payload.weaponId}:${api.tick}:${pos.x}:${pos.y}:${pos.z}`;
    if (!impacts.some(e => e.key === key)) impacts.push({ key, tick: api.tick, pos: { ...pos } });
    castle.lastEnemyImpactTick = api.tick;
  }
}

/** Per-projectile, per-target summary. Caps aggregate across all enemy castles hit by that projectile. */
export function recordProjectileResult(api, result) {
  const { projectileId, sourceSlot } = result;
  if (projectileId === undefined) throw new TypeError('Projectile morale credit requires projectileId');
  const target = api.state.castles.find(c => c.id === result.castle), source = api.castleOf(sourceSlot);
  const key = `${sourceSlot}:${projectileId}`;
  if (target && hostile(api, sourceSlot, target.slot)) {
    const ledger = layers(target).projectiles[key] ??= { targets: {} };
    if (!ledger.palace && result.palaceDamaged) { ledger.palace = true; queueMoraleInput(target, { palaceHits: 1 }); }
  }
  if (!source || !hostile(api, sourceSlot, target?.slot ?? result.castle)) return;
  const ledger = layers(source).projectiles[key] ??= { targets: {}, blocks: 0, npcs: 0 };
  ledger.targets ??= {};
  if (ledger.targets[result.castle]) return;
  ledger.targets[result.castle] = true;
  const ourHits = result.blocksDamaged > 0 && !ledger.ourHit ? 1 : 0;
  if (ourHits) ledger.ourHit = true;
  const prevBlocks = ledger.blocks ?? 0, prevNpcs = ledger.npcs ?? 0;
  ledger.blocks = prevBlocks + (result.blocksDestroyed ?? 0); ledger.npcs = prevNpcs + (result.npcsKilled ?? 0);
  const delta = Math.min(T.morale.enemyBlockCap, ledger.blocks * T.morale.enemyBlock) - Math.min(T.morale.enemyBlockCap, prevBlocks * T.morale.enemyBlock)
    + Math.min(T.morale.enemyNpcCap, ledger.npcs * T.morale.enemyNpc) - Math.min(T.morale.enemyNpcCap, prevNpcs * T.morale.enemyNpc);
  queueMoraleInput(source, { ourHits, delta, enemyWeapons: result.weaponsDestroyed ?? 0,
    damagingHit: result.damagingHit || result.blocksDamaged > 0 || result.npcsKilled > 0 || result.weaponsDestroyed > 0 });
}

/** Bracket a resolved blast in sim.js; this avoids adding attribution fields to damage.js. */
export function beginNpcImpact(api, blast) {
  if (!blast.projectile) return null;
  return { projectileId: blast.projectile.id, sourceSlot: blast.sourceSlot,
    castles: api.state.castles.map(c => ({ id: c.id, type: c.plot.type.slice(), hp: c.plot.hp.slice() })),
    weapons: api.state.weapons.map(w => ({ id: w.id, hp: w.hp })),
    npcs: api.state.npcs.map(n => ({ id: n.id, hp: n.hp })) };
}

/** Resolve each projectile once, including direct person hits and the destruction batch. */
export function endNpcImpact(api, before) {
  if (!before) return;
  for (const old of before.castles) {
    const castle = api.state.castles.find(c => c.id === old.id), p = castle.plot;
    let blocksDamaged = 0, blocksDestroyed = 0, palaceDamaged = false;
    for (let i = 0; i < p.type.length; i++) if (old.type[i] && p.hp[i] < old.hp[i]) {
      blocksDamaged++; if (!p.type[i]) blocksDestroyed++; if (old.type[i] === BLOCK.PALACE) palaceDamaged = true;
    }
    let npcsKilled = 0, weaponsDestroyed = 0, damagingHit = blocksDamaged > 0;
    for (const npc of api.state.npcs) if (npc.castle === castle.id) {
      const previous = before.npcs.find(n => n.id === npc.id);
      if (previous?.hp > npc.hp) damagingHit = true;
      if (previous?.hp > 0 && npc.hp <= 0 && !npc.deserting) npcsKilled++;
    }
    for (const weapon of api.state.weapons) if (weapon.slot === castle.slot) {
      const previous = before.weapons.find(w => w.id === weapon.id);
      if (previous?.hp > weapon.hp) damagingHit = true;
      if (previous?.hp > 0 && weapon.hp <= 0) weaponsDestroyed++;
    }
    if (damagingHit) recordProjectileResult(api, { projectileId: before.projectileId, sourceSlot: before.sourceSlot,
      castle: castle.id, blocksDamaged, blocksDestroyed, palaceDamaged, npcsKilled, weaponsDestroyed, damagingHit });
  }
}

/** Tick step eight: impulses, continuous rows, relaxation, baseline, then morale effects. */
export function moraleTick(api, castle) {
  const s = layers(castle);
  if (s.lastTick === api.tick) return;
  s.lastTick = api.tick;
  if (castle.morale < T.morale.rallyBelow) s.rallyArmed = true;
  s.deaths = s.deaths.filter(d => api.tick - d.tick < ticks(T.morale.deathWindowS));
  for (const input of castle.moraleInputs ?? []) {
    let delta = input.delta ?? 0;
    for (const death of input.deaths ?? []) {
      if (s.countedDeaths[death.entityId]) continue;
      s.countedDeaths[death.entityId] = true;
      const penalty = death.role === ROLE.CIVILIAN ? T.morale.civilianDeath : T.morale.crewDeath;
      const used = s.deaths.reduce((n, d) => n + d.amount, 0), amount = Math.max(penalty, T.morale.deathCap - used);
      if (amount < 0) { s.deaths.push({ tick: api.tick, amount }); delta += amount; }
    }
    delta += (input.palaceHits ?? 0) * T.morale.palaceHit + (input.ourHits ?? 0) * T.morale.ourHit
      + Math.min(T.morale.enemyBlockCap, (input.enemyBlocks ?? 0) * T.morale.enemyBlock)
      + (input.enemyWeapons ?? 0) * T.morale.enemyWeapon + Math.min(T.morale.enemyNpcCap, (input.enemyNpcs ?? 0) * T.morale.enemyNpc);
    if ((input.ourHits > 0 || input.damagingHit) && s.rallyArmed && api.tick - s.lastRallyTick >= ticks(T.morale.rallyCooldownS)) {
      delta += T.morale.rally; s.lastRallyTick = api.tick; s.rallyArmed = false;
    }
    s.fast = clamp(s.fast + delta);
  }
  castle.moraleInputs = [];
  castle.enemyImpacts = (castle.enemyImpacts ?? []).filter(e => api.tick - e.tick < ticks(T.morale.underFireWindowS));
  let rate = api.tick - (castle.lastEnemyImpactTick ?? -ticks(T.morale.underFireWindowS)) < ticks(T.morale.underFireWindowS) ? T.morale.underFireS : 0;
  let integrity = castle.palaceIntegrity ?? 1;
  if (castle.initialPalaceHp > 0) integrity = castle.palaceCells.reduce((hp, i) => hp + (castle.plot.type[i] === BLOCK.PALACE ? castle.plot.hp[i] : 0), 0) / castle.initialPalaceHp;
  if (integrity < T.palace.moraleDrainBelow) rate += T.morale.palaceLowS;
  const civilians = ownNpcs(api, castle).filter(n => n.hp > 0 && !n.deserting && n.role === ROLE.CIVILIAN);
  if (castle.shelter && civilians.length > 0 && civilians.filter(n => n.state === NPC_STATE.SHELTER).length / civilians.length >= T.morale.shelterFrac) rate += T.morale.shelterS;
  s.fast = clamp(s.fast + rate * K.DT);
  s.fast = clamp(s.fast + (s.baseline - s.fast) * K.DT / T.morale.tauFastS);
  const difference = s.fast - s.baseline, maxMove = T.morale.baselineRateS * K.DT;
  s.baseline = clamp(s.baseline + Math.max(-maxMove, Math.min(maxMove, difference)));
  castle.morale = T.morale.wFast * s.fast + T.morale.wBase * s.baseline;
  const band = bandOf(castle.morale);
  if (band !== s.band) { s.band = band; api.emit(EV.MORALE_BAND, { castle: castle.id, morale: castle.morale, band }); }
  s.desertTicks = castle.morale < T.npc.desertBelow ? s.desertTicks + 1 : 0;
  s.surrenderTicks = castle.morale <= T.rules.surrenderMorale ? s.surrenderTicks + 1 : 0;
  if (s.surrenderTicks >= ticks(T.rules.surrenderS)) castle.surrendered = true;
  castle.workSpeed = workSpeed(castle);
}
