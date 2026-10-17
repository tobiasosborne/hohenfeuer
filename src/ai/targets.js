// src/ai/targets.js - owns deterministic public target scoring and palace-shield selection.
import { BLOCK, TRAJ } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { vector, geometryAim } from './aim.js';
import { createFlightProjectile, integrateProjectile, weaponAvailable } from '../sim/ballistics.js';
import { blockTarget, firstBlockOnLine, publicView, shooterPosition, visibleTarget, weaponDefinition } from './view.js';

/** Visible rulers share palace's immediate-elimination value until tuning defines ruler. */
export function scoreTarget(target, tactic) {
  const kind = target.kind;
  return (T.ai.targetValue[kind] ?? 0) * (T.ai.tacticWeight[tactic]?.[kind] ?? 1);
}
/** Numeric entity/cell ids break score ties, then slot and kind disambiguate domains. */
export function rankTargets(candidates, tactic) {
  return [...candidates].sort((a, b) => scoreTarget(b, tactic) - scoreTarget(a, tactic)
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) || a.slot - b.slot
    || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
}

/** Public entity positions are feet; aim inside the weapon hull or the person's capsule. */
function entityPosition(entity, kind) {
  const p = vector(entity.pos), height = kind === 'weapon'
    ? weaponDefinition(entity)?.footprint?.[2] ?? T.weaponRules.wallFootprint[2] : T.people.height;
  return { ...p, y: p.y + height / 2 };
}

/** Enumerate only public blocks and entity positions; line-of-fire walls are derived by DDA. */
export function collectTargets(view, slot, weapon) {
  const enemies = (view.castles ?? []).filter(c => c.slot !== slot.id && !c.eliminated
    && ((view.slots ?? []).find(s => s.id === c.slot)?.team ?? c.slot) !== slot.team);
  const enemySlots = new Set(enemies.map(c => c.slot)), candidates = [], shields = new Set();
  for (const castle of [...enemies].sort((a, b) => a.slot - b.slot)) {
    if (!castle.plot) continue;
    for (let index = 0; index < castle.plot.type.length; index++) {
      const block = castle.plot.type[index];
      if (block !== BLOCK.PALACE && block !== BLOCK.MAGAZINE) continue;
      const target = blockTarget(castle, index, block === BLOCK.PALACE ? 'palace' : 'magazine');
      candidates.push(target);
      if (block !== BLOCK.PALACE) continue;
      const hit = firstBlockOnLine(view, shooterPosition(weapon, target.pos), target.pos);
      if (hit && hit.slot === castle.slot && hit.index !== index
        && hit.block !== BLOCK.PALACE && hit.block !== BLOCK.MAGAZINE && hit.block !== BLOCK.FOUNDATION && !shields.has(`${hit.slot}:${hit.index}`)) {
        shields.add(`${hit.slot}:${hit.index}`); candidates.push(blockTarget(castle, hit.index, 'shieldWall'));
      }
    }
  }
  for (const w of view.weapons ?? []) if (enemySlots.has(w.slot) && w.hp > 0)
    candidates.push({ id: w.id, key: `weapon:${w.id}`, slot: w.slot, kind: 'weapon', pos: entityPosition(w, 'weapon') });
  for (const r of view.rulers ?? []) if (enemySlots.has(r.slot) && r.hp > 0) {
    const target = { id: r.id ?? r.slot, key: `ruler:${r.slot}`, slot: r.slot, kind: 'ruler', pos: entityPosition(r, 'ruler') };
    if (visibleTarget(view, shooterPosition(weapon, target.pos), target)) candidates.push(target);
  }
  const people = (view.npcs ?? []).filter(n => enemySlots.has(n.slot ?? n.castle) && n.hp > 0).sort((a, b) => a.id - b.id);
  for (const person of people) {
    const p = vector(person.pos), owner = person.slot ?? person.castle;
    const cluster = people.filter(n => {
      const q = vector(n.pos), dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
      return (n.slot ?? n.castle) === owner && dx * dx + dy * dy + dz * dz <= T.ai.crewClusterM * T.ai.crewClusterM;
    });
    if (cluster.length >= T.ai.crewClusterN) candidates.push({ id: person.id, key: `crew:${person.id}`, slot: owner, kind: 'crewCluster', pos: entityPosition(person, 'crewCluster') });
  }
  return candidates;
}

/** Straight weapons require a clear DDA segment; lobbed weapons can attack covered blocks. */
export function selectTarget(view, slot, weapon, { ballistic = false, breach = false, rulerSlots = null } = {}) {
  if (ballistic) return selectBallisticTarget(view, slot, weapon, breach, rulerSlots);
  const def = weaponDefinition(weapon);
  if (!weaponAvailable(def)) return null;
  const lobbed = def.traj === TRAJ.LOBBED, wind = publicView(view,slot).wind;
  return rankTargets(collectTargets(view, slot, weapon).filter(t =>
    (lobbed || visibleTarget(view, shooterPosition(weapon, t.pos), t))
    && geometryAim(firingPosition(weapon,t.pos),t.pos,def,wind).reachable), slot.aiTactic)[0] ?? null;
}

/** Existing selections survive until destroyed/eliminated or the retarget timer expires. */
export function targetAlive(view, target) {
  if (!target) return false;
  const castle = view.castles?.find(c => c.slot === target.slot);
  if (!castle || castle.eliminated) return false;
  if (target.index !== undefined) return castle.plot.type[target.index] !== BLOCK.AIR;
  const entities = target.kind === 'weapon' ? view.weapons : target.kind === 'ruler' ? view.rulers : view.npcs;
  return (entities ?? []).some(e => (target.kind === 'ruler' ? e.slot === target.slot : e.id === target.id) && e.hp > 0);
}

/** Preserve target identity while reading a moving entity's current public position. */
export function refreshTarget(view, target) {
  if (!target || target.index !== undefined) return target;
  const entities = target.kind === 'weapon' ? view.weapons : target.kind === 'ruler' ? view.rulers : view.npcs;
  const entity = (entities ?? []).find(e => target.kind === 'ruler' ? e.slot === target.slot : e.id === target.id);
  return entity ? { ...target, pos: entityPosition(entity, target.kind) } : target;
}

/** Fixed pitches can arc over a parapet that blocks a direct sight line. Trace public
 * voxels with the production forces; an enemy obstruction is a breach target while
 * keeping the palace aim point. Own obstructions reject that firing lane entirely.
 */
function selectBallisticTarget(view, slot, weapon, breach = false, rulerSlots = null) {
  const def = weaponDefinition(weapon), seenPalaces = new Set();
  if (!weaponAvailable(def)) return null;
  const origin = vector(weapon.pos), distance = target => (target.pos.x - origin.x) ** 2 + (target.pos.z - origin.z) ** 2;
  const candidates = rankTargets(collectTargets(view, slot, weapon).filter(t =>
    (t.kind!=='ruler'||rulerSlots===null||rulerSlots.includes(t.slot)) && (!breach || ['palace','shieldWall','ruler'].includes(t.kind))), slot.aiTactic).sort((a, b) =>
    scoreTarget(b, slot.aiTactic) - scoreTarget(a, slot.aiTactic)
    || (a.kind === b.kind && (a.kind === 'weapon' || a.kind === 'palace') ? distance(a) - distance(b) : 0));
  // publicView supplies the same converted air vector used by the aim solver.
  const air = publicView(view, slot).wind;
  const nearUnexposedRuler = (pos, target) => (view.rulers ?? []).some(r=>r.slot===target.slot&&r.hp>0
    && !rulerSlots?.includes(r.slot) && (pos.x-vector(r.pos).x)**2+(pos.y-vector(r.pos).y-T.people.height/2)**2+(pos.z-vector(r.pos).z)**2<T.ai.rulerCollateralM**2);
  for (const target of candidates) {
    if (target.kind === 'shieldWall') continue;
    if (target.kind === 'weapon' && def.traj === TRAJ.STRAIGHT && !visibleTarget(view, shooterPosition(weapon, target.pos), target)) continue;
    if (target.kind === 'palace') {
      if (seenPalaces.has(target.slot)) continue;
      if (rulerSlots !== null && nearUnexposedRuler(target.pos,target)) continue;
      seenPalaces.add(target.slot);
    }
    const from = firingPosition(weapon,target.pos);
    const solution = geometryAim(from, target.pos, def, air);
    if (!solution.reachable) continue;
    const traced=traceBlocks(view,from,def,solution,air,target.pos.y);
    const hit=traced.hit, feedbackPos=traced.feedbackPos;
    if (hit && hit.slot === slot.id) continue;
    if (rulerSlots !== null && feedbackPos && nearUnexposedRuler(feedbackPos,target)) continue;
    if (hit && (hit.slot !== target.slot || hit.index !== target.index)) {
      if (target.kind === 'ruler') continue;
      if (target.kind === 'weapon') continue; // Breach the palace before chasing a shielded rear gun.
      const castle = view.castles.find(c => c.slot === hit.slot);
      const base={...hit.pos,y:Math.min(hit.pos.y,target.pos.y+T.ai.breachAimAbovePalaceM)};
      const baseFrom=firingPosition(weapon,base),baseAim=geometryAim(baseFrom,base,def,air);
      const baseTrace=baseAim.reachable?traceBlocks(view,baseFrom,def,baseAim,air,vector(castle.plot.origin).y):null;
      const low=baseTrace&&baseTrace.hit?.slot!==slot.id;
      return {...blockTarget(castle,hit.index,'shieldWall'),key:`breach:${target.slot}:${target.cell[2]}`,
        pos:low?base:{...target.pos},feedbackPos:low?baseTrace.feedbackPos ?? feedbackPos:feedbackPos,occluded:true};
    }
    return target;
  }
  // A rear battery can be masked by its own keep after the enemy's front gun
  // is gone. Fire at a visible upper shield instead of idling with crew and ammo.
  const fallback = collectUpperShields(view, slot, weapon);
  for (const target of fallback) {
    const from = firingPosition(weapon, target.pos), solution = geometryAim(from, target.pos, def, air);
    if (!solution.reachable) continue;
    const p = createFlightProjectile(def, { pos: from, charge: solution.dial, elevation: solution.elevation, azimuth: solution.azDeg });
    let hit = null;
    for (let time = 0; time < T.sim.projectileMaxLifeS; time += 1 / T.sim.tickHz / T.sim.substeps) {
      const before = { ...p.pos }; integrateProjectile(p, air);
      hit = firstBlockOnLine(view, before, p.pos);
      if (hit || p.pos.y < target.pos.y && p.vel.y < 0) break;
    }
    if (!hit || hit.slot !== slot.id) return target;
  }
  return null;
}

function traceBlocks(view,from,def,solution,air,landingY) {
  const p=createFlightProjectile(def,{pos:from,charge:solution.dial,elevation:solution.elevation,azimuth:solution.azDeg});
  const h=1/T.sim.tickHz/T.sim.substeps;
  for(let time=0;time<T.sim.projectileMaxLifeS;time+=h){
    const before={...p.pos};integrateProjectile(p,air,h);const hit=firstBlockOnLine(view,before,p.pos);
    if(hit)return {hit,feedbackPos:{x:before.x+(p.pos.x-before.x)*hit.t,y:before.y+(p.pos.y-before.y)*hit.t,z:before.z+(p.pos.z-before.z)*hit.t}};
    if(p.pos.y<landingY&&p.vel.y<0)break;
  }
  return {hit:null,feedbackPos:null};
}

function collectUpperShields(view, slot, weapon) {
  const targets = [];
  for (const castle of view.castles ?? []) {
    if (castle.slot === slot.id || castle.eliminated || (view.slots ?? []).find(s => s.id === castle.slot)?.team === slot.team) continue;
    // One exposed high block per column, with nearest columns first. These are
    // ordinary paid shots at public masonry, never shots through own walls.
    const p = castle.plot;
    if (!p) continue;
    for (let z = 0; z < p.depth; z++) for (let x = 0; x < p.width; x++) {
      for (let y = p.height - 1; y >= Math.floor(vector(weapon.pos).y); y--) {
        const index = x + p.width * z + p.width * p.depth * y;
        if (p.type[index] && p.type[index] !== BLOCK.FOUNDATION) { targets.push(blockTarget(castle, index, 'shieldWall')); break; }
      }
    }
  }
  const from = vector(weapon.pos);
  return targets.sort((a,b) => b.pos.y - a.pos.y || (a.pos.x-from.x)**2+(a.pos.z-from.z)**2 - (b.pos.x-from.x)**2-(b.pos.z-from.z)**2 || a.id-b.id).slice(0, 4);
}


function firingPosition(weapon,target) {
  const from = shooterPosition(weapon,target);
  if (!weapon.muzzle) from.y = vector(weapon.pos).y + T.weaponRules.wallFootprint[2] / 2;
  return from;
}
/** Choose a feasible owned gun for a public target; loaded guns and lower fire costs
 * win ties deterministically. The controller also calls selectTarget per weapon. */
export function selectWeaponForTarget(view, slot, target, weapons = view.weapons ?? []) {
  const wind = publicView(view,slot).wind;
  return weapons.filter(w => w.slot === slot.id && w.hp > 0 && weaponAvailable(weaponDefinition(w))
    && geometryAim(firingPosition(w,target.pos),target.pos,weaponDefinition(w),wind).reachable)
    .sort((a,b) => {
      const ad = weaponDefinition(a), bd = weaponDefinition(b);
      return Number(b.reload >= bd.reloadS) - Number(a.reload >= ad.reloadS) || ad.fireCost - bd.fireCost || a.id - b.id;
    })[0] ?? null;
}
