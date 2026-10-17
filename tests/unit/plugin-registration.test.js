// tests/unit/plugin-registration.test.js - owns core registry lifecycle and weapon-folder conformance.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import * as C from '../../src/contracts.js';
import { TUNING } from '../../src/tuning.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { registerCoreView } from '../../src/plugins/index.view.js';
import { FOREST_DUEL_SEED } from '../../src/plugins/maps/forest-duel.sim.js';
import { createTb1Script } from '../../src/tb1-script.js';

afterEach(C.resetRegistriesForTests);

const validators = {
  [C.PLUGIN_KIND.BLOCK]: C.validateBlockPlugin, [C.PLUGIN_KIND.WEAPON]: C.validateWeaponPlugin,
  [C.PLUGIN_KIND.CASTLE]: C.validateCastlePlugin, [C.PLUGIN_KIND.MAP]: C.validateMapPlugin,
  [C.PLUGIN_KIND.BIOME]: C.validateBiomePlugin,
};
const viewValidators = {
  [C.PLUGIN_KIND.BLOCK]: C.validateBlockView, [C.PLUGIN_KIND.WEAPON]: C.validateWeaponView,
  [C.PLUGIN_KIND.BIOME]: C.validateBiomeView,
};

test('entry points register every sim def and view while leaving freeze to the orchestrator', () => {
  assert.equal(C.listPlugins(C.PLUGIN_KIND.BLOCK).length, 0, 'imports do not register plugins');
  registerCoreSim(); registerCoreView();
  assert.equal(C.isFrozen(), false);
  assert.equal(C.registryHash(), null);
  assert.equal(C.listPlugins(C.PLUGIN_KIND.BLOCK).length, Object.keys(C.BLOCK).length);
  for (const [kind, validate] of Object.entries(validators)) {
    const defs = C.listPlugins(kind);
    assert.ok(defs.length > 0, kind);
    for (const def of defs) {
      assert.equal(validate(def), true);
      assert.equal(Object.isFrozen(def), true);
      if (viewValidators[kind]) {
        const key = kind === C.PLUGIN_KIND.BLOCK ? def.key : def.id;
        assert.equal(viewValidators[kind](key, C.getView(kind, key)), true);
      }
    }
  }
  const hash = C.freezeRegistries();
  assert.equal(C.isFrozen(), true);
  assert.equal(C.registryHash(), hash);
  assert.match(hash, /^[0-9a-f]{8}$/);
  assert.throws(registerCoreSim, /frozen/);
  assert.throws(registerCoreView, /frozen/);
});

test('a second complete sim or view registration throws before freeze', () => {
  registerCoreSim(); registerCoreView();
  assert.throws(registerCoreSim, /duplicate/);
  assert.throws(registerCoreView, /duplicate/);
});

test('registryHash is stable across fresh registrations and independent of view registration', () => {
  const hashes = [];
  for (let run = 0; run < 3; run++) {
    C.resetRegistriesForTests();
    registerCoreSim();
    if (run !== 0) registerCoreView();
    hashes.push(C.freezeRegistries());
    assert.equal(C.registryHash(), hashes[run]);
    assert.equal(C.freezeRegistries(), hashes[run]);
  }
  assert.equal(hashes[0], hashes[1]);
  assert.equal(hashes[1], hashes[2]);
});

test('every weapon folder has exactly one import line and one registration call in each index', () => {
  const folders = readdirSync(new URL('../../src/plugins/weapons/', import.meta.url), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
  assert.ok(folders.length > 0);
  for (const side of ['sim', 'view']) {
    const source = readFileSync(new URL(`../../src/plugins/index.${side}.js`, import.meta.url), 'utf8');
    const matches = [...source.matchAll(/^import\s+\{\s*(\w+)\s*\}\s+from\s+['"]\.\/weapons\/([^/]+)\/([^/]+)\.(sim|view)\.js['"];?\s*$/gm)];
    assert.equal(matches.length, folders.length, `${side}: one weapon per import line`);
    assert.deepEqual(matches.map(m => m[2]).sort(), folders);
    for (const folder of folders) {
      const [match] = matches.filter(m => m[2] === folder);
      assert.equal(matches.filter(m => m[2] === folder).length, 1, folder);
      assert.equal(match[3], folder);
      assert.equal(match[4], side);
      assert.equal(source.match(new RegExp(`\\b${match[1]}\\(\\);`, 'g'))?.length, 1, `${folder} registered once`);
      assert.ok(existsSync(new URL(`../../src/plugins/weapons/${folder}/${folder}.${side}.js`, import.meta.url)));
    }
  }
});

const simUrl = new URL('../../src/sim/sim.js', import.meta.url);
test('real core plugins boot deterministic duel sims and their cannon fires, lands and damages blocks', { skip: !existsSync(simUrl) && 'Lane A sim has not landed' }, async () => {
  registerCoreSim(); C.freezeRegistries();
  const { createSim } = await import(simUrl.href);
  const opts = { map: 'forest-duel', seed: FOREST_DUEL_SEED };
  const a = createSim(opts), b = createSim(opts);
  assert.equal(a.state.castles.length, 2);
  assert.equal(a.state.weapons.length, 4);
  const inward = a.state.weapons.find(w => w.slot === 0 && w.aim.az === C.FACING.E * 90 * TUNING.aim.azUnitsPerDeg);
  assert.ok(inward);
  const walkA = createTb1Script(), walkB = createTb1Script();
  for (let tick = 0; tick < 30 * C.K.TICK_HZ && a.state.rulers[0].manning !== inward.id; tick++) {
    a.tick(walkA.next(a.state)); b.tick(walkB.next(b.state));
  }
  assert.equal(a.state.rulers[0].manning, inward.id);
  a.drainEvents(); b.drainEvents();
  const events = [];
  for (let tick = 0; tick < 6 * C.K.TICK_HZ; tick++) {
    const commands = tick === 0 ? [{ type: C.CMD.FIRE, slot: 0, tick: a.state.tick, seq: 0, weaponId: inward.id }] : [];
    a.tick(commands); b.tick(commands);
    events.push(...a.drainEvents()); b.drainEvents();
  }
  assert.equal(a.hash(), b.hash());
  assert.equal(a.state.castles[0].stats.ammoCosts, TUNING.weapons.cannon.fireCost);
  assert.equal(events.filter(e => e.type === C.EV.SHOT_FIRED).length, 1);
  assert.ok(events.some(e => e.type === C.EV.IMPACT && e.payload.hit === 'block'));
  assert.ok(events.some(e => e.type === C.EV.BLOCK_DAMAGED || e.type === C.EV.BLOCK_DESTROYED));
  assert.equal(a.state.projectiles.length, 0);
});
