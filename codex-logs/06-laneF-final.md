1. Delivered 10 source modules and 5 test files; contracts/tuning unchanged; no git run.
2. Blocks: `src/plugins/blocks/core.{sim,view}.js` — all 14 types.
3. Cannon: `src/plugins/weapons/cannon/cannon.{sim,view}.js`.
4. Castle: `src/plugins/castles/default.sim.js` — four towers, palace, magazine, two cannons.
5. Map: `src/plugins/maps/forest-duel.sim.js` — plots 192 m apart.
6. Biome: `src/plugins/biomes/forest.{sim,view}.js`.
7. Entry points: `src/plugins/index.{sim,view}.js`; orchestrator owns freezing.
8. Tests: `plugin-{blocks,castle,forest,registration,weapon-conformance}.test.js` — **22/22 pass**.
9. `npm test` — **28/28 test files pass**.
10. Six red/green evidence pairs saved in `tests/evidence/`.
11. Loader, symmetry, support, headroom, firing, damage, duplicate, hash and index checks pass.
12. Contract adaptations: ladder/door support uses the sim exception; minCrew is derived.
13. Seed and muzzle offset are separate exports; ASCII stairs face north.
14. Exact forest RGB/light values are art defaults; the design supplies colour families.
15. Deferred to renderer/assets: GLB loading, FX/SFX, painted sky/atlas and cosmetic prop assets.