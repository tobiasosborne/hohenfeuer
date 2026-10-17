1. Implemented navigation, jobs, NPC brains, morale, logistics, and crews.
2. `npm test`: 42/42 files; NPC checks: 51/51; build and syntax checks pass.
3. Performance advisory: 160 NPCs averaged **2.159 ms/tick**.
4. `weapon.crewPresent` counts NPCs; `rulerManning` adds the ruler; `crewWorkSpeed` stores mean work speed.
5. `sim.js` import: `import { npcTick, moraleTick, npcKinematics, recordNpcEvent, beginNpcImpact, endNpcImpact, npcCommand } from '../npc/index.js';`
6. After `ctx.api = api`: `hooks = { npcTick, moraleTick, npcKinematics, ...hooks }; hooks.npcKinematics?.(api);`
7. Replace emit: `const emit = (type, payload) => { events.push({ type, payload: snapshot(payload) }); recordNpcEvent(api, type, payload); };`
8. Before each blast’s damage: `const npcImpact = beginNpcImpact(api, blast);`
9. After that blast resolves: `endNpcImpact(api, npcImpact);`
10. Replace command kinds: `const commandKinds = Object.freeze(Object.values(CMD).filter(type => type !== CMD.DESIGNATE_WEAPON));`
11. Replace command default: `default: if (!npcCommand(api, cmd)) throw new Error('Unsupported command'); break;`
12. `weapons.js` import: `import { canFire, reloadMultiplier } from '../npc/index.js';`
13. Before spending, gate with `!canFire(weapon, castle)`; after the successful guard: `weapon.ammo -= def.ammoLoads;`
14. Replace reload increment: `weapon.reload = Math.min(def.reloadS, weapon.reload + dt / reloadMultiplier(weapon, ctx.castleOf(weapon.slot)));`
15. [Exact 15-line handoff](/home/tobias/Projects/castle-game/tests/evidence/28-npc-report.txt). No git run; `castle-game-d6q` closed; wiring tracked in `castle-game-utr`.