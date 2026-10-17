1. Implemented; `npm test` passes all 42 files. Build and syntax checks pass.
2. Flight scale: 0.125 m/original renderer unit; 5/2048 m/native unit, calibrated for this duel.
3. Native tick: 62 ms; converted gravity: 20.9590 m/s².
4. Cannon K: 1.57510 m/s/charge; quadratic drag k: 0.00961538/m.
5. Full-charge cannon range: 277.65 m; elevation 21.2695°; catapult 36.7383°.
6. `AIM.range / 10` maps to charge, clamped to 1–255.
7. Cannon damage: 16 direct/20 splash; 12.5 m blast uses separate 5/256 footprint scaling.
8. Wind: nine strengths, 507.904-second cycle, direction changes ±59.9414°.
9. Gold: 1500 start/2000 cap; stone 1, tower 2, magazine 75/block; workshop prices added.
10. Palace defeat requires approximately 202 dp; wood 12 HP, windmill 24 HP, tower build 18 s.
11. Ground HP is 60/96; ballista/rocket approximations and support-threshold follow-up: `castle-game-bxe`.
12. AI accuracy: level 10 hits 131/200; level 1 hits 0/400, with height-aware feedback.
13. Forest duel: winner 0, tick 1493 (49.77 s), hash 3619448650, identical twice.
14. TB1: az **893**, range **1016**; fire tick **254**, capture **307**, impact **348**. Main reticle follow-up: `castle-game-sdx`.
15. [Capture evidence](/home/tobias/Projects/castle-game/tests/evidence/19-tb2-capture-green.txt) saved; `castle-game-0cf` and `castle-game-dbt` closed. No git commands run.