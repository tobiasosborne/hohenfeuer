1. Implemented wave 1 with TDD in the assigned paths.
2. [Sweep harness](/home/tobias/Projects/castle-game/scripts/sweep.mjs) supports 20/60 matches, configurable levels and slot swaps.
3. Saved 40 before and 40 after matches, including gold trajectories and spending.
4. Worst gold-cap occupancy: **67.5% → 0%**.
5. Income: **3/0.1g/s**; stone/tower: **4/8g**; repair materials: **80%**.
6. Repairs take **12s**; palace cells have **80HP**; late cracking reaches **55%**.
7. Palace-progress checks: **40/40**; longest joint stall: **189.8s**.
8. Slot wins: **20–20**; physical west/east wins: **16–24**.
9. First-gun-loss comebacks: **6/8 paired cases**, representing **3/4 independent worlds**.
10. Firing-window checks: **40/40**; longest silence: **70.5s**.
11. Match lengths: **12.06–16.89 minutes**, averaging **14.24**.
12. All **69 unit-test files**, replay determinism checks and production build passed.
13. [Report](/home/tobias/Projects/castle-game/research/17-repair-wave-1.md) includes both tables and provisional scores: **28/60 → 40/60**.
14. All endings were palace defeats; independent re-critique and map recovery follow-ups remain tracked.
15. Five issues closed. No git commands run; Beads sync failed because no Dolt origin is configured.