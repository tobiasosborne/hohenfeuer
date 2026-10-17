// src/progression.js - owns the local player curriculum, persistent counters and retiring reticle prompts; never sim state.
import { t } from './ui/i18n.js';

export const PROFILE_KEY = 'hohenfeuer.profile.v1';
const CONCEPTS = ['triage', 'placement', 'autoFire', 'orders', 'arsenal6', 'arsenal7', 'arsenal8', 'arsenal9', 'arsenal10', 'catapult'];
const LESSON = { 2: 'triage', 3: 'placement', 4: 'autoFire', 5: 'orders', 6: 'arsenal6', 7: 'arsenal7', 8: 'arsenal8', 9: 'arsenal9', 10: 'arsenal10' };
export const WEAPON_ORDER = Object.freeze(['cannon', 'catapult', 'double-cannon', 'ballista', 'fire-catapult', 'trebuchet', 'rocket', 'arcaballista', 'fat-freda', 'hellfire']);
const BASE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Numpad8', 'Numpad2', 'Numpad4', 'Numpad6', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'Space', 'Numpad0', 'KeyE', 'KeyB', 'End', 'Numpad1', 'Escape'];
const count = (v) => Number.isSafeInteger(v) && v > 0 ? Math.min(v, 1000000000) : 0;

export function freshProfile() {
  return { version: 1, matchesPlayed: 0, shotsFired: 0, cannonShots: 0, hits: 0, wins: 0, conceptsUnlocked: [], promptUses: { man: 0, fire: 0, build: 0 } };
}

export function sanitizeProfile(value) {
  const p = freshProfile();
  if (!value || value.version !== 1) return p;
  for (const k of ['matchesPlayed', 'shotsFired', 'cannonShots', 'hits', 'wins']) p[k] = count(value[k]);
  p.wins = Math.min(p.wins, p.matchesPlayed);
  p.cannonShots = Math.min(p.cannonShots, p.shotsFired);
  p.conceptsUnlocked = CONCEPTS.filter(c => Array.isArray(value.conceptsUnlocked) && value.conceptsUnlocked.includes(c));
  for (const k of Object.keys(p.promptUses)) p.promptUses[k] = Math.min(2, count(value.promptUses?.[k]));
  return p;
}
export function loadProfile(storage) {
  try { return sanitizeProfile(JSON.parse(storage?.getItem(PROFILE_KEY) ?? 'null')); } catch { return freshProfile(); }
}
export function saveProfile(storage, profile) {
  try { storage?.setItem(PROFILE_KEY, JSON.stringify(sanitizeProfile(profile))); } catch { /* private browsing / quota */ }
}

/** Completed matches + 1 is the current match. This query is pure, including its returned arrays. */
export function visibleFeatures(profile) {
  const p = sanitizeProfile(profile), match = p.matchesPlayed + 1;
  const has = (name, n) => match >= n || p.conceptsUnlocked.includes(name);
  const repair = has('triage', 2), placement = has('placement', 3), autoFire = has('autoFire', 4), orders = has('orders', 5);
  const weaponCount = match >= 10 ? 10 : match >= 9 ? 8 : match >= 8 ? 6 : match >= 7 ? 5 : match >= 6 ? 4 : 2;
  const catapult = p.cannonShots >= 10 || p.conceptsUnlocked.includes('catapult') || match >= 10;
  const weapons = WEAPON_ORDER.slice(0, weaponCount).filter(id => id !== 'catapult' || catapult);
  // A qualified catapult is visible in the roster immediately; placement still arrives at match 3.
  const blocks = placement ? [1, 2, 12] : [1];
  if (match >= 6) blocks.push(4, 5);
  if (match >= 7) blocks.push(9);
  if (match >= 8) blocks.push(6, 7);
  if (match >= 9) blocks.push(8);
  if (match >= 10) blocks.push(10);
  const keys = [...BASE_KEYS];
  if (repair) keys.push('KeyR');
  if (placement) keys.push('KeyG', 'Home', 'Numpad7', 'PageUp', 'PageDown', 'Numpad9', 'Numpad3');
  if (autoFire) keys.push('KeyF');
  if (orders) keys.push('KeyQ', 'KeyX', 'Tab');
  if (placement) for (let n = 1; n <= Math.max(blocks.length, weapons.length); n++) if (n <= 9) keys.push(`Digit${n}`);
  return { match, keys, weapons, blocks, repair, placement, autoFire, orders, weaponCycle: placement, restore: placement,
    hud: { gold: true, population: true, weaponCount: placement, wind: true, ownMap: true, aim: true, impact: true, morale: repair, enemyMap: match > 3, jobs: orders, income: true } };
}

/** Stable URL/debug fixtures: 0 = newcomer; 3/10 = the corresponding current match with prior cannon practice. */
export function profileForMatch(n) {
  const p = freshProfile();
  if (!Number.isInteger(n) || n < 1 || n > 1000) return p;
  p.matchesPlayed = n - 1;
  if (n >= 3) p.shotsFired = p.cannonShots = 10;
  // A fixture has already seen its tier; capture only the requested HUD state.
  p.conceptsUnlocked = Object.entries(LESSON).filter(([m]) => Number(m) <= n).map(([, c]) => c);
  if (n >= 3) { p.conceptsUnlocked.push('catapult'); p.promptUses = { man: 2, fire: 2, build: 2 }; }
  return p;
}

/** Return one actionable prompt at most. Uses count successful actions, never frames or key repeats. */
export function contextualPrompt(profile, context, lang = 'de') {
  const p = sanitizeProfile(profile), c = context, target = c.target;
  const prompt = id => p.promptUses[id] < 2 ? { id, text: t(`prompt${id[0].toUpperCase()}${id.slice(1)}`, lang) } : null;
  if (c.mode === 'weapon' || c.mode === 'impact') return c.loaded && c.affordable !== false && c.hasAmmo !== false ? prompt('fire') : null;
  if (c.mode !== 'walk') return null;
  if (target?.kind === 'weapon' && target.own && target.dist <= 3 && (!target.defId || target.defId === 'cannon')) {
    const man = prompt('man'); if (man) return man;
  }
  return c.wallHit && !c.building ? prompt('build') : null;
}

/** A battle pins its starting match number; finish cannot unlock the next lesson mid-battle. */
export function createProgression({ profile = freshProfile(), storage = null, matchOverride = null } = {}) {
  const p = sanitizeProfile(profile), careerMatch = p.matchesPlayed + 1;
  const overridden = Number.isInteger(matchOverride) && matchOverride >= 0 && matchOverride <= 1000;
  const match = overridden ? Math.max(1, matchOverride) : careerMatch;
  let finished = false;
  const pending = [];
  const persist = () => saveProfile(storage, p);
  const unlock = c => { if (!p.conceptsUnlocked.includes(c)) { p.conceptsUnlocked.push(c); pending.push(c); persist(); } };
  if (LESSON[match]) unlock(LESSON[match]);
  if (match >= 10 && !p.conceptsUnlocked.includes('catapult')) {
    p.conceptsUnlocked.push('catapult'); persist(); // announced with the full-arsenal lesson
  }
  return {
    get profile() { return sanitizeProfile(p); },
    get features() {
      const source = overridden ? profileForMatch(match) : p;
      return visibleFeatures({ ...source, matchesPlayed: match - 1, shotsFired: Math.max(source.shotsFired, p.shotsFired), cannonShots: Math.max(source.cannonShots, p.cannonShots) });
    },
    shot(defId) { p.shotsFired++; if (defId === 'cannon') p.cannonShots++; if (p.cannonShots >= 10) unlock('catapult'); persist(); },
    hit(n = 1) { p.hits += count(n); persist(); },
    usePrompt(id) { if (Object.hasOwn(p.promptUses, id)) { p.promptUses[id] = Math.min(2, p.promptUses[id] + 1); persist(); } },
    finish(won) { if (finished) return; finished = true; p.matchesPlayed++; if (won) p.wins++; persist(); },
    takeAnnouncement() { return pending.shift() ?? null; },
  };
}
