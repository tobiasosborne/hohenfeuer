1. Implemented parts 1 and 2 within lane A.
2. Core: `rng.js`, `fmath.js`, `hash.js`, `loop.js`.
3. World: `grid.js`, `terrain.js`, `castle-load.js`, `support.js`.
4. Sim: `ballistics.js`, `wind.js`, `sim.js`, `damage.js`.
5. Sim: `weapons.js`, `ruler.js`, `economy.js`, `rules.js`.
6. Added six `tests/unit/sim-*.test.js` files.
7. All **30 lane A cases pass**.
8. DDA passed 10,000 seeded wall shots at 150 m/s.
9. Analytic range, dial inversion and wind calibration pass.
10. Collapse, ruler movement, damage and elimination fixtures pass.
11. Default AI, deterministic hashes and save/restore replay pass.
12. All source syntax checks and purity checks pass.
13. Eight red/green evidence pairs saved; [aggregate results](/home/tobias/Projects/castle-game/tests/evidence/09-sim-all-green.txt).
14. Only local tuning: [terrain wavelength, 64 m](/home/tobias/Projects/castle-game/src/sim/_tuning-local.js); `npm test` passed 27/28 files, failing on missing UI `font.js`.
15. No NPC implementation, browser/performance validation, git commands or edits outside owned paths.