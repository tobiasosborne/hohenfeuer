// owns: read-only morale, ruler visibility and outcome-path observations for critique v2.
import { TUNING as T } from '../src/tuning.js';
import { shooterPosition, visibleTarget } from '../src/ai/view.js';
import { palaceIntegrity } from '../src/sim/rules.js';

export function pathObserver() {
  const sides = [0, 1].map(() => ({ minMorale: 100, minPopulation: Infinity, rulerMinHp: 100, rulerExposedS: 0, longestExposureS: 0, movingS: 0, below40S: 0, fleeEvents: 0, desertEvents: 0 }));
  const series = [], streak = [0,0], previous = [];
  return { sides, series, sample(state, events = []) {
    for (const c of state.castles) {
      const s = sides[c.slot], r = state.rulers.find(r => r.slot === c.slot);
      s.minMorale = Math.min(s.minMorale, c.morale); s.minPopulation = Math.min(s.minPopulation, c.population);
      s.rulerMinHp = Math.min(s.rulerMinHp, r.hp);
      if (c.morale < 40) s.below40S += 1 / T.sim.tickHz;
    }
    for (const e of events) {
      const s = sides[e.payload.slot ?? e.payload.castle];
      if (s && /flee|fled/i.test(e.type)) s.fleeEvents++;
      if (s && /desert/i.test(e.type)) s.desertEvents++;
    }
    if (state.tick % T.sim.tickHz) return;
    const row = { second: state.tick / T.sim.tickHz, sides: [] };
    for (const c of state.castles) {
      const s = sides[c.slot], r = state.rulers.find(r => r.slot === c.slot);
      const target = { slot: c.slot, kind: 'ruler', pos: {...r.pos, y:r.pos.y + T.people.height/2} };
      const exposed = r.hp > 0 && state.weapons.some(w => w.slot !== c.slot && w.hp > 0 && visibleTarget(state, shooterPosition(w,target.pos),target));
      if (exposed) s.rulerExposedS++;
      streak[c.slot] = exposed ? streak[c.slot] + 1 : 0; s.longestExposureS = Math.max(s.longestExposureS,streak[c.slot]);
      const p = previous[c.slot]; if (p && Math.hypot(p.x-r.pos.x,p.y-r.pos.y,p.z-r.pos.z) > .1) s.movingS++;
      previous[c.slot] = {...r.pos};
      row.sides.push({ morale:c.morale, population:c.population, palace:palaceIntegrity(c), rulerHp:r.hp, rulerPos:{...r.pos}, exposed,
        fleeing:state.npcs.filter(n => (n.slot ?? n.castle) === c.slot && n.hp > 0 && n.state === 'flee').length });
    }
    series.push(row);
  }};
}
