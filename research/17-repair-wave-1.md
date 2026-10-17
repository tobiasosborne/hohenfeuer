# 17 — Gameplay repair wave 1: simulation, AI and tuning

2026-10-17–18. Scope: `src/sim`, `src/npc`, `src/ai`, tuning, the headless harness, unit tests and evidence. No renderer, player, UI, audio or content-plugin sources were edited. No git commands were run. This is a simulation repair report with provisional rubric scores, not an independent re-critique or a human usability result.

## Method and reproducibility

The critique in research/16 was the hypothesis; research/15 sections 7–8 supplied the rubric and research/16 section 6 supplied the sweep protocol. Both measured waves use **20 seeds × two physical slot orders = 40 level-five general-vs-general forest duels**, fixed at 30 Hz, with a 20-minute simulation limit. Baseline workers loaded their modules before gameplay edits; they completed in the background with those immutable imports. The final sweep uses the repaired implementation.

```
node scripts/sweep.mjs --seeds 20 --swap-slot --label before --workers 10
node scripts/sweep.mjs --seeds 20 --swap-slot --label after --workers 8
# Default: 20 matches = ten seeds in both orders.
node scripts/sweep.mjs --matches 60 --ai-levels 3,5,8 --label levels
# Unequal opponents, reversed in the return leg:
node scripts/sweep.mjs --matches 20 --levels 3,8 --label unequal
```

The 60-match matrix flag is implemented and unit-tested; the measured before/after evidence here is the 40-match level-five experiment. Swapping reverses physical map placements and AI levels while retaining the seed, wind and terrain. The report gives both slot and physical-side results so swapping cannot hide a geographic advantage. Default slots and all ordinary simulation rules remain in effect. The paired return legs are not independent random worlds: they retain each physical castle's random identity. Exact length, reversed winner, per-castle metrics, minute curves and gold trajectories agree in **20/20** pairs. Thus the 40 runs represent **20 independent seeds**, and the comeback denominator also contains paired observations.

Cap occupancy is counted every tick at 2000g (tolerance 0.000001g); near-cap means ≥1900g and near-zero means ≤200g. Gold is recorded each second, palace/population/morale/shots each minute and at elimination. Spend events record actual debits, aggregated by second and stage: weapons versus construction reservations/repair work. Reservations are spending when designated, not a claim that construction finished. Repairs count a block reaching full HP, including repeated repairs of the same cell. Collapse losses are separate from directly destroyed blocks. Hits include any registered solid/person hit, so hit percentage alone does not establish precision on the palace.

Fire gaps include opening and terminal intervals and use actual shot events, not attempted FIRE commands. The readiness counter checks a living gun, reload, ammunition, crew and gold; it does not assume an unobstructed lane. Palace damage-minute counts record reductions in at least three distinct minute buckets; the sampled net-decline count is also audited below. JSON contains individual curves, shots, first gun losses, building/destruction/repair counts, deaths, morale-band events, gold trajectories and spending.

Raw evidence: [before](../tests/evidence/sweep-before.json), [after](../tests/evidence/sweep-after.json), [acceptance](../tests/evidence/repair-wave-1-acceptance.json). Each sweep includes its initial six-file core fingerprint; [the final source manifest](../tests/evidence/repair-wave-1-sources.json) records all pure simulation/content sources for reproduction. The original TB2 results remain historical evidence and were not rewritten.

## Before

| Metric | Result |
|---|---|
| Matches / timeouts | 40 / 2 |
| Length min / mean / max (min) | 0.34 / 10.66 / 20.00 |
| 12–20 min finishes | 13/40 |
| Slot 0 / 1 wins | 23 / 15 (57.5% / 37.5%) |
| Gold at cap, slot 0 / 1 | 22.8% / 22.9% |
| Worst side at cap | 67.5% |
| Gold >=95% cap, slot 0 / 1 | 48.8% / 43.8% |
| Gold <=10% cap | 0.0% |
| First-gun-loss comebacks | 11/33 (33.3%) |
| Loser damaged in >=3 minutes | 11/40 |
| No palace stall >5 min | 21/40 |
| Both fire every 2 min | 19/40 |
| Longest no-fire / ready no-fire (s) | 912.4 / 912.4 |
| Mean shots / hits (slots) | 21.4 / 18.9; 19.1 / 17.4 |
| Mean built / repaired / deaths per side | 7.1 / 73.4 / 17.1 |
| Elimination reasons | {"palace":2,"surrender":21,"ruler":15,"timeout":2} |

The larger baseline differs materially from the four-match critique: only 13/40 finishes were in range, two timed out, and first-gun-loss comebacks were already 11/33. Physical west/east wins were **29/9**, excluding timeouts. The critique's estimated cap percentages describe near-cap behavior; the harness distinguishes exact-cap time from ≥95%-cap time.

## After

| Metric | Result |
|---|---|
| Matches / timeouts | 40 / 0 |
| Length min / mean / max (min) | 12.06 / 14.24 / 16.89 |
| 12–20 min finishes | 40/40 |
| Slot 0 / 1 wins | 20 / 20 (50.0% / 50.0%) |
| Gold at cap, slot 0 / 1 | 0.0% / 0.0% |
| Worst side at cap | 0.0% |
| Gold >=95% cap, slot 0 / 1 | 0.0% / 0.0% |
| Gold <=10% cap | 0.0% |
| First-gun-loss comebacks | 6/8 (75.0%) |
| Loser damaged in >=3 minutes | 40/40 |
| No palace stall >5 min | 40/40 |
| Both fire every 2 min | 40/40 |
| Longest no-fire / ready no-fire (s) | 70.5 / 70.5 |
| Mean shots / hits (slots) | 34.2 / 34.2; 33.5 / 33.5 |
| Mean built / repaired / deaths per side | 14.0 / 45.6 / 13.1 |
| Elimination reasons | {"palace":40} |

Physical west/east wins: **16/24**. Net palace decline in at least three sampled minute transitions: **40/40**. Matches containing morale-band events: **40/40**. The first-gun comeback comparison retains the actual denominator; it is not presented as an improvement over the baseline unless the measured rate increased.

| Acceptance check | Result |
|---|---|
| 40 paired level-five matches | PASS |
| No timeouts | PASS |
| Every side at cap <20% | PASS |
| Loser damage in at least three minutes | PASS |
| No joint palace stall over five minutes | PASS |
| Each slot wins 40–60% | PASS |
| First-gun-loss comeback rate at least 25% | PASS |
| Both sides fire in every two-minute window | PASS |
| Loaded/crewed/funded silence at most 90 seconds | PASS |
| At least 80% finish in 12–20 minutes (critique protocol) | PASS |
| All 40 finish in 12–20 minutes (wave target) | PASS |
| A cannon is unaffordable during sampled midgame | PASS |

The critique protocol requires ≥80% in 12–20 minutes; the final cohort reaches 100%. Seed-one pacing is separately pinned to the same full 12–20-minute design range by its unit test. All listed gates pass.

## Repair 1 — scarcity between sinks

Palace income **6 → 3g/s**, working civilian income **0.25 → 0.1g/s**, stone **1 → 4g**, tower **2 → 8g**, mount **1 → 6g**, repair materials **50% → 80%**. Start gold remains 1500 and cap 2000. Demolition salvage is explicitly **50%**, preventing the repair-fraction change from silently increasing salvage to 80%.

Map-only palace/gate blocks now have an **8g repair-material valuation**. A null construction cost previously meant free palace health; that becomes a free-health treadmill once palace HP is large enough to survive a blast. They remain unavailable as ordinary construction. Automatic repairs preserve a useful shot and, when a blueprint gun is missing/critical, its replacement savings. Explicit priority repairs may spend those savings. Essential supply/access construction can use the reserve when there is no battery able to spend it on a shot. Income statistics count credited gold rather than overflow at cap. Destroyed weapons return **50% of their price as wreck material** to their owner, capped normally; a cannon loss still costs a net 375g to replace. The scarce-income candidate had zero comebacks in ten first-gun cases, motivating paid recovery capital and shared ranging experience. Later diagnosis found that friendly muzzle collisions were a separate, larger failure: the seed-two worker hit produced approximately 63° azimuth bias and 65 charge units of false correction. Raising salvage to 80% did not fix this and was reverted. Crew now leave muzzle lanes; the AI waits for friendly people to clear and excludes own-plot obstructions from enemy aiming feedback. The regression tests reproduce the corrupted-feedback case. See [the diagnosis](../tests/evidence/repair-wave-1-diagnosis-replacement.json).

Worst per-side cap time is **67.5% → 0.0%**; mean near-zero time is **0.0% → 0.0%**. Mean per-side shot spending is **3075.8g**, and construction/repair debits are **561.6g**. Sampled treasury was below a 750g cannon price for **17.7%** of side-seconds, with a minimum **170.8g**. Readiness lacked shot funds on 0/80 sides and the initial-gun-count replacement counter lacked funds on 2/80 sides. Those counters are supporting evidence, not counts of rejected commands: they also include already-reserved replacements awaiting assembly. The per-second trajectories and spend events retain the actual competing purchases. DESIGNATE_WEAPON debits are in the command/construction ledger; the weapons-stage ledger measures shot costs. Tests cover zero-gold work, paid palace repair, credited income, independent salvage and reserve overrides.

## Repair 2 — a breach and a gradual keep failure

Repair time is **8 → 12s per full block**. After a 120-second opening exchange (roughly five volleys), the general AI concentrates on a palace shield segment, retaining aim learning across individual voxels in the same breach. It chooses the nearer palace face from either direction rather than the lowest-index voxel. Expected shielding impacts are compared with the predicted obstruction point, avoiding a false “undershoot” correction that sent subsequent shells deeper into masonry. Aim memory is scoped to weapon type/target kind.

Palace cells are **6 → 80 HP**: 48 cells have **3840 initial HP**. This is a deliberate pacing calibration, not a newly claimed manual value. A 24-HP experiment with the late four-minute switch preserved long stalls; moving the breach earlier and deferring routine wall repair under fire requires a core that can absorb repeated volleys. Paid repair materials make the larger core a resource decision. Routine non-palace repairs wait for **30 seconds of quiet** around their segment; explicit priority repairs bypass this scheduling gate. Palace repairs continue under fire and still consume materials. Impact history is retained long enough for that policy while morale under-fire drain keeps its original ten-second window. Learned confidence (up to four observations) transfers between aim points and replacement guns of the same type at the same castle instead of restarting blind exploration. Wind changes still reduce confidence. Initial defeat remains below 30%; **minutes 10–15 ramp the threshold to 55%**. A 45% late threshold left probe11 stalled at 45.7% until the limit; 96-HP experiments also left three long repair tails, so the final core is 80HP; an 80-HP candidate still reached minute 20 at 52.4% integrity; those measured tails justify the final 55%. The rule changes the defeat line, not palace HP, and exposes `keepCracking` and `palaceDefeatThreshold` for the UI owner.

The final sweep has **40/40** losers damaged across ≥3 distinct minutes and **40/40** matches without a joint palace stall over five minutes. The minute curves retain repair recovery; they are not forced to be monotone.

## Repair 3 — ordering independence and recovery after first blood

Confirmed sources were directional target-index bias, an unmirrored role-spawn order, and shared randomness consumed in firing/population order. The mirror test checks opposing palace aim points. Scatter now has an independent stream per castle; firing the opposing gun first cannot change this side's projectile. NPC bravery draws likewise cannot shift when the other castle's population changes. A complete intermediate cohort still failed slot balance at **14/26** despite passing every other gate. It exposed a remaining experiment/identity defect: swapping slot numbers reassigned the AI, scatter and bravery streams to different physical castles. Those three domains now resolve slot IDs to canonical physical-castle ranks (x/z/y), derived from simulation state; wind stays global. This preserves the normal forest order's random draws while a reordered slot table retains each physical castle's random identity. A failing permutation test became green, and a swapped-map save/restore test verifies that the mapping is derived from restored positions, not the initial registry map. The final paired outcomes test the actual result; physical-side win rates remain separately visible. [The slot-identity parity audit](../tests/evidence/repair-wave-1-slot-parity.json) confirms that all 20 default-order match records, including final hashes and full metrics, are unchanged by this correction. Default west-facing role positions are mirrored when the authored rooms support the reflection; the test checks all 40 role positions. The slot think offset is **5 → 0 ticks**, so both controllers decide from the same public tick. Wind and collision/tick ordering remain deterministic. The sweep retains the physical-side split above instead of treating a balanced slot table as proof of geographic symmetry.

Rally eligibility moves **30 → 50 morale**. Below **70% initial population**, civilian levy runs every **5s** instead of 10s and minimum gun crews take precedence over support quotas. Drafting restores full ordered crews when population permits, preserving minimum runner/mason capacity. Scarce crew fill each gun's firing minimum before a gun receives a third crew member. Excess claims are released after losses rather than leaving a 3/1 allocation that cannot fire the second cannon. Guards on death credit, rally cooldown and morale floors remain active.

Slot wins are **20/20**; first-gun-loss comebacks are **6/8**. Seed three in the normal order lost its front cannon at **274.97s** and won at **861.93s**; [the separate replay excerpt](../tests/evidence/repair-wave-1-first-gun.json) records an enemy impact immediately before that loss. Its gold/gun trajectory shows a paid replacement completed by minute five. The number of first-gun cases is reported explicitly; it is a small conditional sample, not a precise population estimate. The baseline already met the comeback percentage in the broad sample, so the repair's evidence is preserved agency and fairer allocation, not a claim that comebacks were previously impossible.

## Repair 4 — supply and work recovery, not repeated rejected commands

The diagnostic artifact [repair-wave-1-diagnosis.json](../tests/evidence/repair-wave-1-diagnosis.json) captured a live three-person gun with no ammo while its AI held **1695g**. Unreachable roof work had exhausted the discretionary build account; damaged stairs and suspended workers prevented resupply. Repeated FIRE/ORDER_CREW alone could not solve it.

The AI now gives magazines, access and gun recovery their own priority over discretionary rebuilding. Eight designation slots are reserved for one complete magazine, and critical recovery can cancel unclaimed roof reservations from an already-full queue. Failed routes back off per worker rather than blocking all workers from a job. The reproduced seed-eight state had all 64 slots tied up in roofs; seed seven had two masons standing inside missing access-wall cells. Masons fall to surviving support after floor destruction using deterministic gravity and normal fall damage. Workers can climb up to two metres of rubble by lifting before crossing a solid face, with overhead clearance; they clear missing original wall/access footprints instead of blocking reconstruction with their bodies. Every work destination excludes pending construction footprints. Ruler paths exclude these NPC-only climbs. Urgent gun/supply construction preempts ordinary automatic repairs, while explicit priority repairs retain priority. Haulers use reachable legal cells beside a weapon, and crew/workers remain outside weapon footprints and muzzle corridors and clear vacant mounts. Initial guns preserve facing.

Paid spare mount pairs flank the central breach by **8 cells**. Replacements prefer these existing wall batteries instead of repeatedly rebuilding into the killing lane. If a cannon is unaffordable, the AI can buy **one 400g ballista** and continue saving for its **750g cannon**; the temporary gun does not falsely satisfy the original blueprint or consume those savings in routine repairs. All construction and firing use ordinary commands, occupancy/support checks, crew, reload and costs. The cap is unchanged. AI rulers start at their throne as specified, then search authored and derived covered shelters away from the firing lane and walk there when threatened; cover is reassessed after a 30s cooldown using normal movement/collision, with no teleport, healing grant or invulnerability. Intact solid cover blocks blast injury for both AI and human people.

Actual worst firing silence is **912.4 → 70.5s**; funded/loaded/crewed silence is **912.4 → 70.5s**. Both sides satisfy the two-minute window in **40/40** matches. Per-weapon utilization is not claimed: a rear gun may still be masked while its castle's active battery keeps firing.

## Seed-one arc (each run's eventual loser)

| Minute | Before palace | After palace | After gold 0/1 | After shots 0/1 |
|---|---|---|---|---|
| 0 | 100.0% | 100.0% | 1500/1500 | 0/0 |
| 1 | 100.0% | 100.0% | 1487/1437 | 2/2 |
| 2 | 100.0% | 100.0% | 1284/1257 | 5/5 |
| 3 | 100.0% | 99.6% | 1214/1269 | 7/6 |
| 4 | 100.0% | 98.0% | 1021/1167 | 10/9 |
| 5 | 100.0% | 96.6% | 1013/1179 | 12/11 |
| 6 | 100.0% | 94.1% | 933/1101 | 15/14 |
| 7 | 100.0% | 93.9% | 943/1101 | 17/16 |
| 8 | 100.0% | 87.2% | 865/1077 | 20/18 |
| 9 | 100.0% | 84.7% | 856/959 | 22/21 |
| 10 | 100.0% | 84.7% | 778/947 | 25/23 |
| 11 | 100.0% | 84.7% | 782/952 | 27/25 |
| 12 | 100.0% | 74.2% | 700/855 | 30/28 |
| 13 | 87.5% | 68.9% | 698/867 | 32/30 |
| 14 | 73.3% | — | — | — |
| 15 | 73.3% | — | — | — |
| 16 | 72.2% | — | — | — |

Before ends at 16.73 minutes, after at 13.62; full final samples and elimination reasons are in JSON.

## Validation and provisional re-critique

Red/green logs in `tests/evidence/repair-wave-1-*-red.txt` and `*-green.txt` cover the behaviors above. The final full unit run is [repair-wave-1-npm-green.txt](../tests/evidence/repair-wave-1-npm-green.txt); it includes seed-one 12–20-minute pacing, AI match two-run determinism, the TB3 checkpoint replay, physics, NPCs and the other lanes' unit checks. Production build evidence is [repair-wave-1-build.txt](../tests/evidence/repair-wave-1-build.txt). Derived aim/job/path caches contain no authoritative state. Repeated path queries are memoized only until topology changes and return independent path values; nine completed matches matched their pre-cache hashes and complete metrics exactly before the later gameplay revisions (repair-wave-1-cache-parity.json). Physics/AI continue to use fixed ticks and serializable state.

These are provisional **1–5** scores for the requested criteria. “D” is implementation/test evidence and “H” is the sweep; no new human-play or visual claim is implied.

| Criterion | Critique v1 | Provisional | Evidence / limit |
|---|---|---|---|
| A1 shot-cycle clarity | 3 | 3 | Aiming feedback handles an expected shield interception; player miss readout unchanged. |
| A2 decision density | 2 | 3 | Competing spending is demonstrated; human commands per reload remain unmeasured. |
| A3 trade-offs | 2 | 3 | Repair materials, cannon savings and a cheaper temporary battery compete for gold. |
| A4 role load | 2 | 3 | Minimum crews and urgent masonry matter; human role balance needs playtesting. |
| B5 match shape | 2 | 4 | Minute curves and the late cracking threshold replace the old long plateau. |
| B6 length/variance | 4 | 5 | 100.0% in range; standard deviation 91.3s. |
| B7 comeback/fairness | 2 | 4 | Paired outcomes and first-gun denominator are reported; baseline already had comebacks. |
| B8 quiet beats | 3 | 3 | Rebuild/repair recovery is measured; visibility of those beats has not been re-reviewed. |
| E17 scarcity | 1 | 3 | Cap occupancy, affordability and actual spending replace the old treasury saturation. |
| E18 repair/rebuild | 3 | 4 | 12s repairs, 80% materials, paid core health and separate 50% salvage. |
| E19 morale | 2 | 2 | Rally activates below 50 and levy accelerates after losses; reason/legibility UI unverified. |
| F21 opponent | 2 | 3 | Replacements, temporary weapons, supply recovery and ruler cover use ordinary paid commands. |

Win-path variety (E20) is outside the requested scoring subset, but all 40 final endings are palace defeats. That is a regression in this separate criterion (provisional 1 under the rubric), and this wave does not restore three distinct endings. Target pressure, paid core durability and ruler cover must be re-reviewed together in `castle-game-mhl`.

Requested-criteria subtotal: **28/60 → 40/60**. No new 110-point total is awarded: onboarding, readability, alerts and human decision density need independent evidence. `castle-game-mhl` tracks that re-critique.

## Handoff

Closed wave issues: `castle-game-uo7.3`, `.4`, `.5`, `.6`, `.8`. The final measured values live in tuning and this evidence, superseding the historical TB2 pacing expectations. `castle-game-er7` tracks team-aware/cardinal recovery-platform planning for generated/multi-slot maps. The UI/render owners can surface the cracking state and refresh simulation-dependent goldens. No screenshots, browser interaction or human usability result is claimed by this lane. Source outside the assigned paths was left untouched; this report and Beads provide the handoff without editing another lane's files. No git commands were run. Beads updates are local: `bd dolt push` was attempted and failed because this database has no configured origin (see repair-wave-1-beads-sync.txt).
