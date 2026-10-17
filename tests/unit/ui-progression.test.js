// owns: profile persistence, curriculum, prompt retirement and paced unlock announcement contracts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProfile, profileForMatch, visibleFeatures, loadProfile, saveProfile, PROFILE_KEY, createProgression, contextualPrompt } from '../../src/progression.js';

test('first match exposes one cannon and stone, no advanced keys or morale', () => {
  const p = freshProfile(), snapshot = JSON.stringify(p), f = visibleFeatures(p);
  assert.equal(f.match, 1);
  assert.deepEqual(f.weapons, ['cannon']); assert.deepEqual(f.blocks, [1]);
  for (const k of ['KeyE', 'KeyB', 'Space', 'End', 'ArrowUp']) assert.ok(f.keys.includes(k), k);
  for (const k of ['KeyQ', 'KeyR', 'KeyG', 'KeyX', 'KeyF', 'Tab', 'PageUp', 'Digit2', 'Home']) assert.ok(!f.keys.includes(k), k);
  assert.equal(f.hud.morale, false); assert.equal(f.hud.enemyMap, false);
  assert.equal(JSON.stringify(p), snapshot, 'pure query');
});

test('ramp: triage at 2, placement at 3, auto-fire at 4, orders at 5, ten weapons by 10', () => {
  const f2 = visibleFeatures(profileForMatch(2));
  assert.ok(f2.keys.includes('KeyR')); assert.equal(f2.hud.morale, true);
  assert.ok(!f2.keys.includes('KeyG'));
  const f3 = visibleFeatures(profileForMatch(3));
  assert.ok(f3.keys.includes('KeyG')); assert.ok(f3.keys.includes('PageDown'));
  assert.deepEqual(f3.weapons, ['cannon', 'catapult']);
  assert.equal(f3.hud.enemyMap, false, 'enemy map follows match 3');
  assert.ok(!f3.keys.includes('KeyX')); assert.ok(!f3.keys.includes('KeyF'));
  const f5 = visibleFeatures(profileForMatch(5));
  for (const k of ['KeyX', 'KeyQ', 'KeyF', 'Tab']) assert.ok(f5.keys.includes(k));
  assert.equal(f5.hud.enemyMap, true);
  assert.equal(visibleFeatures(profileForMatch(10)).weapons.length, 10);
  assert.equal(visibleFeatures(profileForMatch(10)).blocks.length, 10);
});

test('catapult requires ten cannon shots, not hits or other weapon shots', () => {
  const p = freshProfile(); p.matchesPlayed = 2; p.shotsFired = 20; p.hits = 15;
  assert.deepEqual(visibleFeatures(p).weapons, ['cannon']);
  p.cannonShots = 9; assert.deepEqual(visibleFeatures(p).weapons, ['cannon']);
  p.cannonShots = 10; assert.deepEqual(visibleFeatures(p).weapons, ['cannon', 'catapult']);
});

test('storage is versioned, defensive, bounded and safe when unavailable', () => {
  let data; const storage = { getItem: k => k === PROFILE_KEY ? data : null, setItem: (k,v) => { assert.equal(k, PROFILE_KEY); data = v; } };
  assert.deepEqual(loadProfile(storage), freshProfile());
  const p = profileForMatch(3); p.promptUses.man = 2;
  saveProfile(storage, p); assert.deepEqual(loadProfile(storage), p);
  data = '{'; assert.deepEqual(loadProfile(storage), freshProfile());
  data = JSON.stringify({ version: 1, matchesPlayed: -3, shotsFired: 'infinity', wins: 999, promptUses: { man: 999 }, conceptsUnlocked: ['triage', 'injected'] });
  const s = loadProfile(storage); assert.equal(s.matchesPlayed, 0); assert.equal(s.shotsFired, 0); assert.equal(s.wins, 0); assert.equal(s.promptUses.man, 2); assert.deepEqual(s.conceptsUnlocked, ['triage']);
  assert.doesNotThrow(() => saveProfile({ setItem() { throw Error(); } }, p));
  assert.deepEqual(loadProfile({ getItem() { throw Error(); } }), freshProfile());
});

test('prompt priority is contextual, exactly three prompts, retired after two successful uses', () => {
  const p = freshProfile();
  const context = { mode: 'walk', target: { kind: 'weapon', own: true, dist: 2, defId: 'cannon' }, wallHit: true };
  assert.equal(contextualPrompt(p, context)?.id, 'man');
  assert.equal(contextualPrompt(p, context)?.text, 'E: Kanone bemannen');
  p.promptUses.man = 2; assert.equal(contextualPrompt(p, context)?.id, 'build');
  assert.equal(contextualPrompt(p, { mode: 'weapon', loaded: true })?.text, 'Leertaste: Feuer');
  assert.equal(contextualPrompt(p, { mode: 'weapon', loaded: false, wallHit: true }), null);
  p.promptUses.fire = 2; p.promptUses.build = 2;
  assert.equal(contextualPrompt(p, context), null);
  assert.equal(contextualPrompt(freshProfile(), { mode: 'walk', target: { ...context.target, own: false } }), null);
});

test('live counters persist, completion is idempotent and changes the next match only', () => {
  const c = createProgression({ profile: freshProfile() });
  c.shot('rocket'); for (let n = 0; n < 10; n++) c.shot('cannon'); c.hit(3);
  assert.equal(c.profile.shotsFired, 11); assert.equal(c.profile.cannonShots, 10); assert.equal(c.profile.hits, 3);
  assert.equal(c.features.match, 1); assert.ok(c.profile.conceptsUnlocked.includes('catapult'));
  assert.equal(c.takeAnnouncement(), 'catapult'); assert.equal(c.takeAnnouncement(), null);
  c.usePrompt('man'); c.usePrompt('man'); c.usePrompt('man'); assert.equal(c.profile.promptUses.man, 2);
  c.finish(true); c.finish(true); assert.equal(c.profile.matchesPlayed, 1); assert.equal(c.profile.wins, 1);
  assert.equal(c.features.match, 1, 'no mid-battle curriculum jump');
  const next = createProgression({ profile: c.profile }); assert.equal(next.features.match, 2); assert.equal(next.takeAnnouncement(), 'triage');
});

test('one scheduled lesson plus the optional cannon milestone each announce once', () => {
  const p = freshProfile(); p.matchesPlayed = 1; p.cannonShots = 9; p.shotsFired = 9;
  const c = createProgression({ profile: p }); assert.equal(c.takeAnnouncement(), 'triage');
  c.shot('cannon'); assert.equal(c.takeAnnouncement(), 'catapult'); assert.equal(c.takeAnnouncement(), null);
  assert.ok(c.features.weapons.includes('catapult'));
});

test('URL/debug fixtures are reproducible and malformed overrides do not expand access', () => {
  assert.deepEqual(profileForMatch(0), freshProfile());
  assert.equal(visibleFeatures(profileForMatch(3)).match, 3);
  assert.equal(visibleFeatures(profileForMatch(10)).weapons.length, 10);
  assert.equal(visibleFeatures(profileForMatch(NaN)).match, 1);
});

test('quick start pins newcomer controls while retaining the real persistent career counters', () => {
  let saved; const storage = { setItem(k,v) { saved = JSON.parse(v); } };
  const p = profileForMatch(10); p.promptUses.man = 2;
  const c = createProgression({ profile: p, storage, matchOverride: 0 });
  assert.equal(c.features.match, 1); assert.equal(c.features.placement, false); assert.equal(c.features.orders, false);
  c.shot('cannon'); c.finish(true);
  assert.equal(saved.matchesPlayed, 10); assert.equal(saved.shotsFired, 11); assert.equal(saved.wins, 1);
  assert.equal(c.features.match, 1);
});

test('the construction palette grows gradually instead of dumping seven block types in match 10', () => {
  let previous = visibleFeatures(profileForMatch(1)).blocks;
  for (let match = 2; match <= 10; match++) {
    const next = visibleFeatures(profileForMatch(match)).blocks;
    assert.ok(previous.every(id => next.includes(id)), 'no relocking');
    assert.ok(next.length - previous.length <= 2, `match ${match}: too many new materials`);
    previous = next;
  }
});

test('match-10 catch-up records the catapult without falsely announcing ten cannon shots', () => {
  const p = freshProfile(); p.matchesPlayed = 9;
  const c = createProgression({ profile: p });
  assert.equal(c.features.weapons.length, 10);
  assert.ok(c.profile.conceptsUnlocked.includes('catapult'));
  assert.equal(c.takeAnnouncement(), 'arsenal10'); assert.equal(c.takeAnnouncement(), null);
});
