// src/npc/model.js - owns shared NPC coordinate and contract adapters.
import { BLOCK, getBlock, getWeapon, getCastle, K } from '../contracts.js';
import {sin,cos,DEG} from '../core/fmath.js';
import { TUNING as T } from '../tuning.js';

const coreKeys = Object.fromEntries(Object.entries(BLOCK).map(([k, id]) => [id, k.toLowerCase()]));
const coreDefs = Object.fromEntries(Object.entries(coreKeys).map(([key, name]) => {
  const id = Number(key), passable = id === BLOCK.AIR || id === BLOCK.DOOR || id === BLOCK.LADDER;
  return [id, Object.freeze({ id, ...T.blocks[name], solid: !passable, passable,
    walkOn: !passable && id !== BLOCK.ROOF, climbable: id === BLOCK.LADDER })];
}));
/** Registered plugin flags take precedence; core fallback supports a bare SimApi fixture. */
export function blockDef(id) {
  const def = getBlock(id);
  if (def) return def;
  return coreDefs[id] ?? null;
}
/** Plot-local [x,y,z] index, or -1 outside. */
export function indexOf(p, c) {
  return c[0] >= 0 && c[0] < p.width && c[1] >= 0 && c[1] < p.height && c[2] >= 0 && c[2] < p.depth
    && c.every(Number.isInteger) ? c[0] + p.width * c[2] + p.width * p.depth * c[1] : -1;
}
/** Decode DESIGN's x/z/y index. */
export function cellOf(p, i) {
  const y = Math.floor(i / (p.width * p.depth)), z = Math.floor((i - y * p.width * p.depth) / p.width);
  return [i % p.width, y, z];
}
export const typeAt = (p, c) => { const i = indexOf(p, c); return i < 0 ? null : p.type[i]; };
export const vector = p => Array.isArray(p) ? { x: p[0], y: p[1], z: p[2] } : p;
export const localCell = (p, pos) => { const v = vector(pos); return [Math.floor(v.x - p.origin.x), Math.floor(v.y - p.origin.y), Math.floor(v.z - p.origin.z)]; };
/** NPC positions are feet at the horizontal cell centre. */
export const feet = (p, c) => ({ x: p.origin.x + c[0] + 0.5, y: p.origin.y + c[1], z: p.origin.z + c[2] + 0.5 });
export const distanceSq = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z);
export const manhattan = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
export const ticks = seconds => Math.round(seconds * K.TICK_HZ);
export const ownNpcs = (api, castle) => api.state.npcs.filter(n => n.castle === castle.id).sort((a, b) => a.id - b.id);
export const ownWeapons = (api, castle) => api.state.weapons.filter(w => w.slot === castle.slot).sort((a, b) => a.id - b.id);
export const rulerOf = (api, castle) => api.state.rulers?.find(r => r.slot === castle.slot) ?? null;
export const weaponDef = weapon => getWeapon(weapon.defId) ?? { ...T.weapons[weapon.defId], ammoLoads: 1 };
export const castleDef = castle => getCastle(castle.defId);

/** Morale bands plus local ruler leadership; used for repairs, construction and reloads. */
export function workSpeed(castle, npc = null, ruler = castle.npcRuler) {
  const m = typeof castle.morale === 'number' ? castle.morale : T.morale.start;
  let speed = T.morale.workBands.find(([floor]) => m >= floor)?.[1] ?? T.morale.workBands.at(-1)[1];
  if (npc && ruler?.hp > 0 && distanceSq(npc.pos, ruler.pos) <= T.npc.leadershipM * T.npc.leadershipM) speed += T.npc.leadershipBonus;
  return Math.min(T.npc.workSpeedCap, speed * (npc?.workMul ?? 1));
}

/** Facing is fixed mount orientation, independent of the weapon's adjustable aim. */
export function operatorCell(weapon, castle) {
  if (weapon.operatorCell) return [...weapon.operatorCell];
  const placement = castle.weapons?.find(w => w.instance === weapon.id || w.pos && distanceSq(vector(w.pos), weapon.pos) === 0);
  const facing = weapon.facing ?? placement?.facing ?? 0;
  const c = localCell(castle.plot, weapon.pos), offsets = [[0, 1], [-1, 0], [0, -1], [1, 0]];
  const [dx, dz] = offsets[facing & 3];
  return [c[0] + dx, c[1], c[2] + dz];
}

// Derived scan invalidation is disposable, like path caches; saves rebuild it on demand.
const damageVersions = new WeakMap();
export function markJobScanDirty(plot) { damageVersions.set(plot, (damageVersions.get(plot) ?? 0) + 1); }
export function jobScanVersion(plot) { return damageVersions.get(plot) ?? 0; }

/** A temporary cheaper gun does not fulfil the original battery blueprint. */
export function missingWeaponCost(initial = [], live = []) {
  const missing=initial.map(w=>w.defId ?? w.weapon ?? w.id);
  for(const w of live)if(w.hp>0){const i=missing.indexOf(w.defId ?? w.weapon ?? w.id);if(i>=0)missing.splice(i,1);}
  const costs=missing.map(id=>weaponDef({defId:id})?.cost).filter(Number.isFinite);
  return costs.length?Math.min(...costs):0;
}

/** Conservative short muzzle corridor shared by standing goals and AI fire safety. */
export function blocksWeaponMuzzle(weapon,person) {
  if(weapon.hp<=0||person.hp<=0)return false;
  const p=vector(weapon.pos),q=vector(person.pos),dx=q.x-p.x,dz=q.z-p.z;
  if(Math.abs(dx)>T.weaponRules.muzzleClearanceM+2||Math.abs(dz)>T.weaponRules.muzzleClearanceM+2)return false;
  const def=weaponDef(weapon),r=(person.radius ?? T.people.npcRadius)+(def.shot?.radius ?? def.projRadius ?? 0)+T.weaponRules.muzzleSafetyPadM;
  const angle=(weapon.aim?.az ?? (weapon.facing ?? 0)*90*T.aim.azUnitsPerDeg)/T.aim.azUnitsPerDeg*DEG;
  const x=sin(angle),z=-cos(angle),along=dx*x+dz*z,side=Math.abs(dx*z-dz*x);
  const offset=T.weaponRules.wallFootprint[0]/2+2*(def.shot?.radius ?? def.projRadius ?? 0),y=p.y+T.weaponRules.wallFootprint[2]/2;
  return along>offset-r&&along<offset+T.weaponRules.muzzleClearanceM+r&&side<r
    &&q.y+(person.height ?? T.people.height)>y-r&&q.y<y+T.weaponRules.muzzleClearanceM;
}
