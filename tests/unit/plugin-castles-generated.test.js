// tests/unit/plugin-castles-generated.test.js - owns converted castle geometry, navigation and replay acceptance.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as C from '../../src/contracts.js';
import { TUNING as T } from '../../src/tuning.js';
import { GENERATED_CASTLES, CASTLE_METADATA } from '../../src/plugins/castles/generated/index.sim.js';
import { CAMPAIGN_MAPS, CAMPAIGN_METADATA } from '../../src/plugins/maps/campaign/index.sim.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { registerCoreView } from '../../src/plugins/index.view.js';
import { loadCastle } from '../../src/world/castle-load.js';
import { isStandable, neighbors, findPath } from '../../src/npc/path.js';
import { createSim } from '../../src/sim/sim.js';

afterEach(C.resetRegistriesForTests);
const index = ([x, y, z]) => x + C.K.PLOT_W * z + C.K.CELLS_PER_LAYER * y;
const offsets = [[0, 1], [-1, 0], [0, -1], [1, 0]];

test('all 145 converted castles load, are supported, have one palace core and reachable population/mount markers', () => {
  registerCoreSim();
  assert.equal(GENERATED_CASTLES.length, 145);
  assert.equal(new Set(GENERATED_CASTLES.map(d => d.id)).size, 145);
  for (const def of GENERATED_CASTLES) {
    assert.equal(C.validateCastlePlugin(def), true);
    const { plot, palaceCells } = loadCastle(def, { getBlock: C.getBlockByKey });
    assert.ok(palaceCells.length > 0, def.id);
    assert.equal(def.layers.flat().join('').split('M').length-1,
      Math.max(1,CASTLE_METADATA[def.id].types['21']??0)*T.magazine.prefab.reduce((a,b)=>a*b,1),`${def.id}: complete magazine prefabs`);
    const flood = (start, adjacent) => {
      const seen = new Set(start.map(index)), queue = [...start];
      for (let i = 0; i < queue.length; i++) for (const p of adjacent(queue[i])) {
        const n = index(p); if (!seen.has(n)) { seen.add(n); queue.push(p); }
      }
      return seen;
    };
    const cells = [], bottom = [], palace = [];
    for (let y = 1; y < plot.height; y++) for (let z = 0; z < plot.depth; z++) for (let x = 0; x < plot.width; x++) {
      const p = [x, y, z], type = plot.type[index(p)];
      if (type === C.BLOCK.AIR) continue;
      cells.push(p); if (y === 1) bottom.push(p); if (type === C.BLOCK.PALACE) palace.push(p);
    }
    const adjacent = (p, filter) => [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]
      .map(d => p.map((v, i) => v + d[i]))
      .filter(([x,y,z]) => x >= 0 && x < plot.width && z >= 0 && z < plot.depth && y >= 1 && y < plot.height)
      .filter(p => filter(plot.type[index(p)]));
    assert.equal(flood(bottom, p => adjacent(p, t => t !== C.BLOCK.AIR)).size, cells.length, `${def.id}: support`);
    assert.equal(flood([palace[0]], p => adjacent(p, t => t === C.BLOCK.PALACE)).size, palaceCells.length, `${def.id}: one palace`);
    const reachable = flood([def.rulerSpawn], p => neighbors(plot, p).map(e => e.cell));
    const markers = [def.rulerSpawn, def.throne, def.exit, ...def.workSpots];
    for (const [x0,y0,z0,x1,y1,z1] of def.shelters) for (let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++) for(let z=z0;z<=z1;z++) markers.push([x,y,z]);
    for (const m of def.mountSpots) {
      const [x,y,z,f] = m, [dx,dz] = offsets[f];
      assert.equal(plot.type[index([x,y-1,z])], C.BLOCK.MOUNT, `${def.id}: mount foundation`);
      assert.equal(plot.type[index([x,y,z])], C.BLOCK.AIR, `${def.id}: free mount`);
      markers.push([x,y,z], [x+dx,y,z+dz]);
    }
    for (const p of markers) {
      assert.ok(isStandable(plot, p), `${def.id}: standable ${p}`);
      assert.ok(reachable.has(index(p)), `${def.id}: reachable ${p}`);
    }
    assert.ok(def.weapons.length <= T.world.weaponCapDefault, def.id);
    const duel = ['orig-19','orig-20','orig-43','orig-44','orig-67','orig-68'].includes(def.id);
    assert.equal(def.weapons.length, duel ? 1 : Math.max(1,Math.min(CASTLE_METADATA[def.id].wallWeapons, T.world.weaponCapDefault)), `${def.id}: playable battery count`);
    for (const wp of def.weapons) {
      assert.ok(def.mountSpots.some(m => m.join() === [...wp.at,wp.facing].join()), def.id);
      const [dx,dz] = offsets[wp.facing];
      assert.ok(findPath(plot,def.rulerSpawn,[wp.at[0]+dx,wp.at[1],wp.at[2]+dz]),`${def.id}: normal A* budget`);
    }
  }
});

test('32 campaign maps preserve every decoded primary scenario castle and slot count, with all biome views valid', () => {
  registerCoreSim(); registerCoreView();
  assert.equal(CAMPAIGN_MAPS.length, 32);
  for (const map of CAMPAIGN_MAPS) {
    assert.equal(C.validateMapPlugin(map), true);
    const meta = CAMPAIGN_METADATA[map.id];
    assert.deepEqual(map.slots.map(s => s.castle), meta.templates.map(n => `orig-${n}`));
    const reference = new URL(`../../assets-ripped/data/scenarios/${meta.scenario}.json`, import.meta.url);
    if (existsSync(reference)) {
      const source = JSON.parse(readFileSync(reference));
      assert.deepEqual(meta.templates, source.plateau_ids.filter(n => n !== 255));
      assert.deepEqual(meta.originalSlots, source.plateau_ids.flatMap((n,i) => n === 255 ? [] : [i]));
    }
  }
  for (const biome of ['forest','desert','ice','volcano']) {
    assert.equal(C.validateBiomePlugin(C.getBiome(biome)), true);
    assert.equal(C.validateBiomeView(biome, C.getView(C.PLUGIN_KIND.BIOME, biome)), true);
    assert.equal(C.getMap(`${biome}-duel`).slots.length, 2);
  }
});

test('ten distinct converted castles run 600 ticks with two real AIs on their biome maps', () => {
  registerCoreSim(); C.freezeRegistries();
  for (const n of [0,1,19,23,43,46,67,70,88,253]) {
    const id = `orig-${n}`, biome = CASTLE_METADATA[id].biome;
    const base = C.getMap(`${biome}-duel`);
    const map = { ...base, slots: base.slots.map(s => ({ ...s, castle: id })) };
    const slots = map.slots.map((s,id) => ({ id, castleId:s.castle, team:id, color:0,
      controller:C.CONTROLLER.AI, aiLevel:5, aiTactic:C.TACTIC.GENERAL }));
    const sim = createSim({ map, seed: 117+n, slots });
    for (let tick=0;tick<600;tick++) { sim.tick(); sim.drainEvents(); }
    assert.equal(sim.state.tick,600,id);
    assert.equal(sim.state.castles.length,2);
    assert.equal(sim.state.outcome,null,id);
    assert.ok(sim.state.npcs.length >= T.npc.populationMin*2,id);
  }
});

test('complete registry hash repeats with views and registration order changes', () => {
  registerCoreSim(); const first = C.freezeRegistries();
  const kinds = [C.PLUGIN_KIND.BLOCK,C.PLUGIN_KIND.WEAPON,C.PLUGIN_KIND.NPC_TYPE,C.PLUGIN_KIND.CASTLE,C.PLUGIN_KIND.MAP,C.PLUGIN_KIND.BIOME];
  const defs = kinds.map(kind => [kind,C.listPlugins(kind)]);
  C.resetRegistriesForTests(); registerCoreSim(); registerCoreView();
  assert.equal(C.freezeRegistries(),first);
  assert.equal(C.registryHash(),first);
  C.resetRegistriesForTests();
  for (const [kind,plugins] of defs.reverse()) for (const def of [...plugins].reverse()) C.registerPlugin(kind,def);
  assert.equal(C.freezeRegistries(),first);
});

test('isolated Python generator reproduces all shipped content within the 2 MB budget', t => {
  if (existsSync(new URL('../../assets-ripped/data/layouts/plateau.0.json',import.meta.url))) {
    const result = spawnSync('python3',['-I','scripts/rip/castles_to_defs.py','--check'], { cwd:new URL('../..',import.meta.url), encoding:'utf8', timeout:120000 });
    assert.equal(result.status,0,result.stdout+result.stderr);
  } else t.diagnostic('Reference inputs absent in clean checkout; checking shipped manifest and geometry only.');
  const manifest = JSON.parse(readFileSync(new URL('../../tests/evidence/repair-wave-2-sim/castles-generated-manifest.json',import.meta.url)));
  const bytes = manifest.files.reduce((sum,p) => sum+statSync(new URL(`../../${p}`,import.meta.url)).size,0);
  assert.ok(bytes<2_000_000,`${bytes} bytes`);
});
