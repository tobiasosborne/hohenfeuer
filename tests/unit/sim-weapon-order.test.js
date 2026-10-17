// tests/unit/sim-weapon-order.test.js - owns scatter independence from opposing fire order.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/contracts.js';
import { registerCoreSim } from '../../src/plugins/index.sim.js';
import { createStreams } from '../../src/core/rng.js';
import { createWeapon, fireWeapon } from '../../src/sim/weapons.js';
test('opponent firing order never changes a side\'s scatter draws', () => {
  C.resetRegistriesForTests();registerCoreSim();C.freezeRegistries();const def=C.getWeapon('cannon');
  function run(order){
    const rng=createStreams(17), castles=[0,1].map(()=>({gold:2000,stats:{shots:0,ammoCosts:0}})), rounds=[];
    const guns=[0,1].map(slot=>({...createWeapon(def,{id:slot,slot,pos:{x:slot*192,y:7,z:23},facing:1}),crewPresent:3}));
    const ctx={state:{tick:0,weapons:guns},castleOf:i=>castles[i],rng:n=>rng.get(n),emit(){},spawnProjectile(p){rounds.push(p);}};
    for(const i of order)assert.equal(fireWeapon(ctx,guns[i]),true);
    return rounds.sort((a,b)=>a.sourceSlot-b.sourceSlot).map(p=>({pos:p.pos,vel:p.vel}));
  }
  assert.deepEqual(run([0,1]),run([1,0]));
});

test('renumbering map slots preserves each physical castle random streams and bravery', async () => {
  const { createSim } = await import('../../src/sim/sim.js');
  C.resetRegistriesForTests(); registerCoreSim(); C.freezeRegistries();
  const base = C.getMap('forest-duel');
  function sample(reverse) {
    const rows = [];
    const map = { ...base, slots: reverse ? [...base.slots].reverse() : [...base.slots] };
    const sim = createSim({ map, seed: 17, hooks: { onReady(api) {
      for (const castle of api.state.castles) rows.push({ x: castle.plot.origin.x,
        draws: ['ai', 'scatter', 'npc'].map(kind => Array.from({ length: 4 }, () => api.rng(`${kind}:${castle.slot}`)())) });
    } } });
    sim.tick([]);
    return { rows: rows.sort((a,b) => a.x-b.x), people: sim.state.castles.map(c => ({ x:c.plot.origin.x,
      bravery:sim.state.npcs.filter(n => n.slot===c.slot).map(n=>n.bravery) })).sort((a,b)=>a.x-b.x) };
  }
  assert.deepEqual(sample(false), sample(true));
});

test('a restored swapped map keeps its physical random-stream ownership', async () => {
  const { createSim, restoreSim } = await import('../../src/sim/sim.js');
  const { createSlotTable } = await import('../../src/ai/slots.js');
  C.resetRegistriesForTests(); registerCoreSim(); C.freezeRegistries();
  const base = C.getMap('forest-duel'), map = { ...base, slots: [...base.slots].reverse() };
  const hooks = { aiThink(_view, _slot, rng) { rng(); return []; } };
  const first = createSim({ map, seed: 17, slots: createSlotTable(map, { aiLevel: 5 }), hooks });
  for(let i=0;i<30;i++)first.tick([]);
  const restored = restoreSim(first.serialize(), { hooks });
  for(let i=0;i<30;i++){first.tick([]);restored.tick([]);}
  assert.equal(first.hash(), restored.hash());
});
