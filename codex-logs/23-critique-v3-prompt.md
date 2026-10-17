# Gameplay critique v3 (independent re-score after repair wave 2)

Repo /home/tobias/Projects/castle-game (public GitHub main). Never run git. Read CLAUDE.md, docs/DESIGN.md sections 5-8, research/15 sections 7-8 (rubric, 22 criteria x 5 = 110), research/16 (v1, 52), research/19 (v2, 60; your own protocol from last round: reproduce, novice proxy, screenshots, strategy screen, endings), research/20 (sim lane of wave 2) and research/21 (UI lane of wave 2), and the beads uo7.17-uo7.19 the lanes left open. User target: easy to pick up, not encyclopaedic; this round's target is 70/110.

## Your job
Write research/22-gameplay-critique-v3.md: the same shape as research/19 (method, reproduced sweeps, human proxy and decision density, what the screen shows, full 22-criterion scorecard with v1/v2/v3 columns, strategy screen and ending viability, ranked repairs as beads under castle-game-uo7, verification). Reuse scripts/sweep.mjs, scripts/novice.mjs, scripts/critique-*.mjs and tests/evidence/critique-v2 as the baseline; keep new evidence under tests/evidence/critique-v3/ with raw sweep JSON under 2 MB each (summaries instead of per-second trajectories; the orchestrator gitignores large ones).

Specific checks this round:
1. Reproduce research/20's focal forest cohort (20 seeds x two orders) and the level matrix; confirm or refute 26/10/4 endings, 0 timeouts, 36/40 in range, 12/28 physical wins. Run ten independent seeds on desert, ice and volcano. Run both physical assignments of 3 vs 8.
2. Endings quality, not just counts: for each ruler ending, was the ruler exposed by its own decision (leadership walk, manning a gun) or killed in cover/by collateral? For each surrender, which pressure cause dominated and was it shown on screen (the UI lane's morale line)? Is the 20% -> 55% quadratic defeat line legible from the HUD captures at 9:59, 10:01, 12:30, 15:01?
3. The UI lane's claims: directional warning lead time (3 s on seed 6), reload alternatives being legal and useful, idle-gun reasons correct against the sim's idleReason, impact readout sign correctness across 20 shots on each of three weapons (cannon, catapult, ballista) with wind on. Verify with scripted browser sessions via tests/lib.mjs and SwiftShader; screenshots at 1024x768.
4. Decision density with the novice proxy against AI 2/5/8 (ten seeds each): distinct non-aim decisions actually taken per reload, win rate, match length, and whether the two-alternative prompt would have been correct at each reload (compare the prompt's suggested actions to what a solver says was best).
5. Strategy screen again under the new economy and endings: turtle, fire-only, ballista spam, rebuild lane, recovery mounts, covered ruler, plus two new ones: ruler-sniping (aim for the enemy ruler whenever exposed) and morale pressure (target crews and civilians to force surrender). Report win rates vs AI 5 over ten seeds; flag anything over 60%.
6. Physical west/east asymmetry (12/28 after wave 2, 16/24 before): quantify where it comes from (terrain, wind, castle layout mirror) with an experiment that swaps terrain only, and propose the smallest fix.
7. Ranked repairs: at most 8, each with criterion, expected points, lane and measurable acceptance; file as beads under castle-game-uo7 (`bd create --parent castle-game-uo7 ...`). Close castle-game-uo7.17 if the settled-tree gates you run pass, with the numbers. Mark unjudgeable-without-human criteria U and say what a 30-minute playtest script would need to measure.

## Rules
- Never run git; do not edit src/. You may add scripts/*.mjs, tests/evidence/critique-v3/*, research/22-gameplay-critique-v3.md, and append a section at the top of HANDOFF.md.
- Concrete numbers, one line of evidence per score, no emoji. Where you disagree with a lane's provisional score, say why.
- Finish with a 15-line summary: total, per-group subtotals, three biggest available gains, what could not be measured.
