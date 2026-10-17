// src/ai/targets.js - owns deterministic public target scoring and palace-shield selection.
import { BLOCK, TRAJ } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { vector } from './aim.js';
import { blockTarget, firstBlockOnLine, shooterPosition, visibleTarget, weaponDefinition } from './view.js';

/** Visible rulers share palace's immediate-elimination value until tuning defines ruler. */
export function scoreTarget(target, tactic) {
  const kind = target.kind === 'ruler' ? 'palace' : target.kind;
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
export function selectTarget(view, slot, weapon) {
  const lobbed = weaponDefinition(weapon)?.traj === TRAJ.LOBBED;
  return rankTargets(collectTargets(view, slot, weapon).filter(t => lobbed || visibleTarget(view, shooterPosition(weapon, t.pos), t)), slot.aiTactic)[0] ?? null;
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
