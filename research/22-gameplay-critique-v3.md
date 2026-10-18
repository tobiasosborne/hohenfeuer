<!-- owns: independent repair-wave-2 gameplay re-score, reproducible measurements, screen evidence and ranked repair handoff. -->
# 22 — Gameplay critique v3

**2026-10-18: 75/110, up from 60/110 and 52/110. The 70-point target is cleared by five points.** Feedback and functional reliability improve substantially. Reload alternatives are rarely displayed in this proxy’s view. The ease-of-pickup goal remains U until unbriefed playtests; the score is an instrumented assessment.

The design target remains easy to pick up without an encyclopaedic opening. More controls are not the proposed remedy. This review separates an available action, a displayed suggestion, an intervention with a measured consequence, and something an unbriefed person understands.

## 1. Method, cohorts and limits

Read `CLAUDE.md`, DESIGN sections 5–8, research/00, the research/15 sections 7–8 rubric, critiques 16/19, repair reports 20/21 and Beads `.17`–`.19`. The rubric has 22 criteria, five points each. **H** denotes headless measurement, **D** code or tests, **S** inspected screenshots, and **U** a human-dependent judgment that remains unvalidated. A numeric technical/proxy score does not certify its U component.

The defined scored cohorts are 150 unique requested AI records, 30 instructed novice records, and 80 strategy records. The focal 40 records represent 20 worlds in two numeric slot orders. The 60-record level matrix contains the same 20 level-five records for seeds 1–10; those duplicates are excluded from the 150-record aggregate. Unequal-level tests use ten seeds, both physical skill assignments and both numeric orders. Each other biome uses ten distinct seeds, not five worlds counted twice. Reusing seeds supports paired comparisons; these are reproduction seeds, not a held-out generalisation set.

All scored matches run at 30 Hz with a 20-minute observation cap. A timeout is censoring, not an in-game draw. Quantiles interpolate linearly. The novice retains the supplied route, favorable rounded bearing/charge-100 opening, local leave/look/repair/re-man sequence and one paid replacement. It responds to launch warnings using the forecast impact position, which is more information than the HUD's bearing/ETA sentence. It is therefore an optimistic, instructed proxy, not a stranger learning the game. Its R/G surface corresponds to profile 3 rather than the restricted first match.

Reload windows follow v2: successful cannon shot until reload, loss or match end; windows shorter than ten seconds are excluded. A non-aim command type is counted once per window. Zero-motion look commands and leave/re-man bookkeeping are not extra decisions. Five seconds into each eligible reload, the audit compares suggestions with a finite 12-second counterfactual planner. The candidate set includes continuing current input, the proposed actions, up to three independently enumerated local repairs and threatened movement. Normal commands, costs, workers, movement and enemy AI remain active. The utility weights survival, own palace, population, morale, funds, gun health/readiness and masonry; it is a declared defensive horizon, **not an optimal match-winning solver**. Ties are within 0.05 utility points. Attention cost and a human's route choice remain U.

The screen audit additionally runs the production camera/frustum limits and actual cannon GLB triangles through the same intervention picker. This matters: a legal nearby wall behind the camera is not a displayed alternative. Browser replays compare the resulting lines against the real HUD, using the production rig/feel pose and exact command traces. The initial engine-only prompt audit is retained as an opportunity upper bound.

The original `scripts/sweep.mjs` and `scripts/novice.mjs` are byte-identical to the wave-2 manifest. New hooks are supplied in memory by `scripts/critique-v3-hooks.mjs`; environment interventions are isolated in memory. No git command was run and no production source was edited. Raw sweep files are compact summaries, not per-second trajectories. Browser sessions use `tests/lib.mjs`, Chromium/SwiftShader, 1024×768 and device scale 1.

The final sim fingerprint is `37696e670259dd2b29c1add820974042e99b95a55824f9c8a16482a0f813d380`. All **170 raw reproduction records match the repair-wave-2 references** in duration, outcome and final hash; this is 150 unique jobs after removing the repeated level-five matrix subset. All ten AI 5 novice hashes also match `novice-final.json`. All **306 production JavaScript files** match the starting snapshot. The largest JSON evidence file is **1,199,041 bytes**, below the 2 MB limit. [Analysis](../tests/evidence/critique-v3/analysis.json), [source verification](../tests/evidence/critique-v3/source-verification.json).

The planner scores `1,000,000 × ruler alive − 100,000 × eliminated + 10,000 × palace fraction + 100 × population + 20 × morale + 0.01 × gold`, plus living-gun health/readiness and 0.01 per destructible masonry HP. Continuing means retaining current input, not replaying the future novice policy. Its restricted candidate set and 12-second horizon can miss longer-term priorities. Candidate utilities, proposed actions and per-window comparisons remain in the raw novice and screen files.

Reproduction entry points are below; use a copied working directory or archived evidence directory to preserve the recorded artifacts. New critique drivers default to `tests/evidence/critique-v3/`.

```sh
node scripts/sweep.mjs --seeds 20 --swap-slot --compact --label focal --output-dir tests/evidence/critique-v3
node scripts/sweep.mjs --seeds 10 --ai-levels 3,5,8 --compact --label matrix --output-dir tests/evidence/critique-v3
node scripts/sweep.mjs --seeds 10 --levels 3,8 --both-assignments --compact --label unequal --output-dir tests/evidence/critique-v3
node scripts/sweep.mjs --seeds 10 --no-swap-slot --map desert-duel --compact --label desert --output-dir tests/evidence/critique-v3
node scripts/sweep.mjs --seeds 10 --no-swap-slot --map ice-duel --compact --label ice --output-dir tests/evidence/critique-v3
node scripts/sweep.mjs --seeds 10 --no-swap-slot --map volcano-duel --compact --label volcano --output-dir tests/evidence/critique-v3
node scripts/critique-v3-run.mjs --mode novice --seeds 10 --levels 2,5,8 --label novice
node scripts/critique-v3-run.mjs --mode strategy --seeds 10 --label strategies
node scripts/critique-v3-run.mjs --mode environment --seeds 20 --conditions terrain,wind,calm --label environment
node scripts/critique-v3-run.mjs --mode environment --seeds 20 --conditions mirror --label mirror
node scripts/critique-v3-screen-run.mjs
node scripts/critique-v3-proxy-browser.mjs
node scripts/critique-v3-browser.mjs
node scripts/critique-v3-ballista-flight.mjs
node scripts/critique-v3-analyze.mjs
```

The actual novice workload was split into disjoint AI 2 and AI 5/8 batches, then assembled with a 30-identity assertion. Extra causal replays, screen replays and controls are not added to the scored denominators. Early worker/fixture pilots are labelled separately and excluded.

## 2. Reproduced sweeps

Length columns are **min / p10 / median / p90 / max**, in minutes. P/R/S means palace/ruler/surrender. Numeric slot permutations preserve physical castle identity.

| Cohort | N | Length distribution, min | SD, s | In 12–20 | Timeouts | West/east wins | P/R/S |
|---|---:|---|---:|---:|---:|---:|---:|
| Forest 5/5, 20 seeds × two orders | 40 | 8.37 / 12.90 / 14.44 / 15.44 / 17.21 | 107.0 | 36/40 | 0 | 12/28 | 26/10/4 |
| Forest 3/3 | 20 | 8.69 / 14.20 / 17.61 / 18.88 / 19.54 | 180.5 | 18/20 | 0 | 6/14 | 14/2/4 |
| Forest 5/5, matrix subset | 20 | 11.36 / 13.01 / 15.15 / 16.01 / 17.21 | 90.5 | 18/20 | 0 | 8/12 | 14/2/4 |
| Forest 8/8 | 20 | 7.68 / 10.88 / 12.38 / 14.06 / 14.72 | 114.3 | 12/20 | 0 | 10/10 | 6/10/4 |
| Physical west/east 3/8 | 20 | 11.54 / 11.79 / 12.44 / 15.73 / 15.82 | 99.8 | 14/20 | 0 | 0/20 | 4/12/4 |
| Physical west/east 8/3 | 20 | 10.09 / 12.46 / 14.68 / 15.91 / 17.97 | 114.8 | 18/20 | 0 | 14/6 | 14/4/2 |
| Desert 5/5 | 10 | 11.52 / 11.55 / 13.33 / 14.41 / 14.65 | 59.9 | 8/10 | 0 | 4/6 | 9/1/0 |
| Ice 5/5 | 10 | 11.65 / 12.80 / 13.44 / 14.43 / 14.50 | 49.6 | 9/10 | 0 | 1/9 | 10/0/0 |
| Volcano 5/5 | 10 | 11.19 / 11.81 / 12.89 / 14.30 / 14.86 | 60.5 | 8/10 | 0 | 3/7 | 10/0/0 |

The focal claims **26/10/4 endings, zero timeouts, 36/40 in range and 12/28 physical wins all reproduce**. Numeric-slot wins are 20/20. The full matrix is 48/60 in range, with zero timeouts. AI 8 wins 20/20 records when east and 14/20 when west; skill wins in both orientations, with a substantial orientation difference. Across the 150 unique AI jobs, **123/150 (82%)** finish in range, with **93 palace / 39 ruler / 18 surrender**, no timeouts.

| Cohort | Latest first shot, s | Longest actual / ready silence, s | Mean gold-at-cap | Near-zero time |
|---|---:|---:|---:|---:|
| Focal forest | 17.57 | 71.0 / 71.0 | 0.00% | 0.139% |
| AI 3 | 17.57 | 42.5 / 42.5 | 0.00% | 4.388% |
| AI 8 | 17.57 | 54.0 / 54.0 | 0.00% | 0.430% |
| Desert | 15.57 | 73.4 / 3.5 | 0.00% | 19.264% |
| Ice | 16.57 | 118.5 / 3.5 | 0.00% | 7.471% |
| Volcano | 20.57 | 95.0 / 3.5 | 0.00% | 7.104% |

The four-biome, ten-seed start gate is **80/80 sides firing within 90 seconds**, worst 20.57 seconds. The inactive-map and AI 3 failures from v2 are repaired. Focal cap and near-cap time are zero; near-zero means ≤200 gold and is **0.139%**, still far below the rubric’s 10–25% scarcity anchor. Focal means are **34.48 shots, 46.10 repairs and 13.05 built blocks per side**. Biome scarcity is stronger, particularly desert. Ready-silence remains a side-level readiness measure, not proof that every individual gun has a clear lane.

A fresh first-damaging-impact audit finds the first attacker winning **13/20 independent focal worlds (65%)**. This is separate from first-gun loss. The reported **2/8 first-gun comebacks** reproduce, but represent only one comeback in four worlds; seed 11's first gun loss is in the terminal ruler-killing blast, leaving no recovery window.

The strict plateau discrepancy is an aggregation error, not a changed simulation. All 20 fresh normal-order per-side arrays equal the wave-2 low-motion audit. There are **34/40 losing palaces with a >180-second window**, but the losing-side maximum is **332 seconds**, mean **235.95**, median **231**. The reported 508-second span belongs to the **winning east side in seed 6**. The old aggregation counted losers but maximised both sides. Relative to v2's 32/40 and maximum 460, prevalence worsens slightly while the longest losing-side span improves. `.19` remains open with corrected notes. Outside the focal cohort, AI 3 still has 20/20 losing-side spans over three minutes; seed 3 reaches 700 seconds in both orders. Focal improvement does not clear the broader shape problem. [Metric audit](../tests/evidence/critique-v3/plateau-audit.json).

## 3. Novice proxy and decision density

| Opponent | Wins | Match min / median / mean / max, min | In 12–20 | Censored | P/R/S/T endings |
|---|---:|---|---:|---:|---:|
| 2 | 8/10 | 6.26 / 12.18 / 12.52 / 20.00 | 5/10 | 1 | 6/0/3/1 |
| 5 | 4/10 | 6.21 / 12.66 / 13.21 / 20.00 | 6/10 | 1 | 4/0/5/1 |
| 8 | 5/10 | 8.23 / 10.67 / 10.74 / 13.57 | 3/10 | 0 | 3/0/7/0 |

There are **17 wins, 11 losses and two censored matches**; only **14/30** are in range. The wins are ten palace and seven surrender. **No novice ruler dies**, and all manual shots are manned: zero remote manual shots. The warning-aware policy removes the v2 ruler-death pattern, but does not establish unbriefed-human survival or pacing.

| AI | Eligible reloads | Legacy local non-aim types available | Distinct non-aim types issued per reload | Screen-filtered zero / one / two alternatives | Beneficial planner-best action displayed |
|---|---:|---:|---:|---:|---:|
| 2 | 258 | 2.42 | 1.00 | 216 / 42 / 0 | 10/61 |
| 5 | 169 | 2.51 | 1.01 | 142 / 27 / 0 | 5/69 |
| 8 | 178 | 2.73 | 1.13 | 156 / 22 / 0 | 6/79 |

Across **605 reloads**, the policy issues only repair and movement as distinct non-aim types. Its median is one, maximum two. Fresh production-filter snapshots predict **one alternative in 91 windows, two in none, and no alternative in 514**. The restricted planner finds an action better than continuing in 209 windows; the displayed suggestion includes that best set in **21/209 (10.0%)**. Thirteen displayed options finish below continuing under this short defensive utility; that is not proof that they are globally bad choices. No placement legality check fails. The real R-input case separately demonstrates a legal, paid, useful intervention.

These are five-second snapshots of this proxy’s gaze, not every hint a freely looking person could obtain. Some zero-alternative frames show an idle diagnosis instead. The legacy local inventory is an opportunity upper bound; it is not the on-screen prompt. The proxy reads state directly and therefore does not demonstrate uptake of UI guidance. **All 30 camera-audit replays retain their original hashes**; three browser replays (AI 2 seed 4, AI 5 seed 4, AI 8 seed 2) match all **50/50 sampled hint sets and state hashes**, plus all three final hashes. [Per-reload records](../tests/evidence/critique-v3/screen-results.json), [summary](../tests/evidence/critique-v3/screen-summary.json), [browser parity](../tests/evidence/critique-v3/proxy-browser.json).

The AI 5 seed 6 timeout has a localized **proxy bug**. It fires for the last time at 162.03 seconds, leaves the gun at 168, orders a repair at 169, and receives the launch warning at 169.07 while unmanned. Evasion copies the null `ruler.manning`, clears the pending repair and forgets its gun. At the cap the ruler is healthy, only **1.32 m** from a ready gun with **three crew and two loads**, holding **2000 gold**. It has fired eight shots against 49. The morale hold is 1315/1350 ticks, only 1.17 seconds short of its threshold. This is not evidence of an unreachable gun or inert enemy AI.

An isolated one-line control remembers `pendingOrder.weaponId` when unmanned. It re-mans at **175.43 seconds**, fires **28 shots**, and wins by palace at **597.30 seconds (9: 57)**. The control proves the memory failure but still misses the 12-minute lower bound. It is not substituted into the scored cohort. AI 2 seed 7 is separate: it has a **778-second** firing gap between 393.03 and 1171.03 seconds, followed by a late paid replacement and censoring. `.18` and the new `.22` carry these facts. [Interruption trace](../tests/evidence/critique-v3/interruption-trace.json), [memory control](../tests/evidence/critique-v3/policy-gun-memory-control.json).

Per-reload means also exclude ready-but-unmanned silence. They must not be presented as sustained decision density throughout a match containing a 17-minute firing drought.

## 4. What the screen shows

The old seed-6 non-evading policy still loses its ruler at **46.03 seconds**. A warning begins at tick 1292 and death occurs at tick 1381: **2.97 seconds** of lead. The 1024×768 capture reads “Incoming from E / impact in 3.0 s” and offers E + WASD with the aiming cost. The defeat screen names the ruler's killer, cannon, direction and time. Browser/headless final hashes match, Enter preserves seed 6, and local defeat also opens the account while a multi-castle battle continues. These are real replay results, not a fabricated outcome. [Warning](../tests/evidence/critique-v3/warning/actual-danger.png), [loss](../tests/evidence/critique-v3/warning/actual-loss.png), [replay](../tests/evidence/critique-v3/warning/replay.json). Warning comprehension and audio perception remain U.

The current-clock palace captures pass at all four requested times:

| Clock | Published defeat line | Visible HUD |
|---|---:|---|
| 9: 59 | 20% | Palace 98% / defeat below 20% |
| 10: 01 | 20.000363% | 20%, plus the bounded rise-to-55% notice |
| 12: 30 | 28.746112% | 28.7%, with the marker advanced |
| 15: 01 | 55% | Palace 95.6% / defeat below 55%, plus the endpoint notice |

The bar is readable and follows the 20%→55% quadratic rule. The tiny difference from the mathematical 28.75% midpoint is the snapshot's one-tick evaluation offset. These use a real AI 1 clock with a fixed inspection camera, not substituted HUD values; they do not measure whether a moving player understands the accelerating curve. [Four captures and fields](../tests/evidence/critique-v3/palace/palace-timeline.json).

The real R input test again pays **1.28 gold**, creates priority 3 and moves a wall from **24→25→40 HP**, with a visible “Repair 63%” label. This establishes working local input and visible progress; it does not alone establish that prioritisation beats automatic work across normal reloads. [Repair sequence](../tests/evidence/critique-v3/actions/actions.json), [progress](../tests/evidence/critique-v3/actions/actual-repair-progress.png).

Seven isolated saved-state browser fixtures exercise the live simulator's no-crew, no-ammo, no-gold, obstructed, damaged, reloading and ready states. All seven match `idleReason`; all five blocking diagnoses match the HUD, while ordinary manned reload/ready avoid redundant captions. A natural TB1 approach is recorded separately. These fixtures alter diagnostic setup state and are **not** match, strategy or ending evidence. [Idle audit](../tests/evidence/critique-v3/idle-browser.json).

The wind-on readout audit fires 20 shots with each of cannon, catapult and ballista, and changes aim during flight. **All 53 observed signed offsets equal an independent projection using the captured launch reference. Seven ballista shots have no terminal readout.** They leave the world, disappear from the projectile list and produce no impact event. The simulator's bounds/age branch discards them. Correct arithmetic is therefore not 60/60 feedback coverage. The cohort includes own-wall/person interceptions; a short offset against a free-flight reference is not a measured miss from a deliberately chosen enemy target. It does not establish four-shot precision at 190 m. [60-shot audit](../tests/evidence/critique-v3/impact-browser.json), [extra clear-muzzle long miss](../tests/evidence/critique-v3/long-miss.json).

An additional **20 paid, muzzle-cleared ballista shots** at normal duel ranges all produce sign-correct readouts, with both short/long and left/right offsets exercised. Together the calibration and stress cohorts have **73 correct observed captions from 80 shots**, plus seven missing captions. The extra single clear-muzzle maximum-charge shot independently disappears without an impact or readout in 1.33 seconds. These are command-level instrument tests, not an embodied aiming trial. [Ballista flight control](../tests/evidence/critique-v3/ballista-flight.json).

The AI timeline uses real first-person ruler positions at 0, 2, 5, 10 minutes and the actual end. At 5 and 10 minutes, the AI 5 seed-1 view faces a nearby wall inside its own keep; those frames cannot demonstrate visible repair beats. The gun-facing forest view can be largely obscured by a hill; a terrain control with unchanged simulated outcomes does not establish a clear optical sightline. The watch-mode captures also retain WASD/Q/X footer hints, despite the UI report’s broader claim that watch mode advertises no player actions. [Timeline and endings](../tests/evidence/critique-v3/endings-browser.json).

## 5. Full independent scorecard

U flags the human-dependent part of a criterion. Numeric grades are supported technical/proxy judgments on the same scale as v1/v2; they are not claims that the U acceptance has passed.

| # | Criterion | v1 | v2 | v3 | Human | One line of evidence |
|---|---|---:|---:|---:|:---:|---|
| 1 | Shot-cycle clarity | 3 | 3 | **4** | — | H,S: 20 cannon, 20 catapult and 20 cleared-ballista captions have correct signed offsets; seven stress-shot exits lack feedback and precise convergence remains open. |
| 2 | Decision density | 2 | 3 | **3** | U | H: 605 reloads use 1.00/1.01/1.13 non-aim types; only 91 show an alternative and 21/209 beneficial planner-best choices are displayed. |
| 3 | Interesting trade-offs | 2 | 3 | **3** | — | H: turtle and pressure win 7/10 versus fire-only 6/10; ballista spam wins 1/10; this finite screen establishes no dominant plan. |
| 4 | Role load balance | 2 | 2 | **2** | U | H: the instructed proxy uses repair and movement inside reloads; fire-only still wins 6/10, while human foreman/commander workload is unmeasured. |
| 5 | Match shape | 2 | 3 | **3** | U | H,S: focal losing-palace plateaus remain 34/40, max 332 s; AI 3 has 20/20, max 700 s; the visible defeat line does not establish a felt arc. |
| 6 | Length and variance | 4 | 2 | **3** | U | H: AI pacing is 123/150 in range with no timeout, but the defined novice is 14/30 with two censors; the repaired-memory control still ends at 9: 57. |
| 7 | Comeback vs snowball | 2 | 4 | **4** | — | H: first damaging attacker wins13/20; first-gun-loss recovery is 1/4 worlds, with one terminal first-loss case and no broad low-morale-comeback proof. |
| 8 | Quiet beats | 3 | 3 | **3** | U | H,S: 46.1 repairs/side and an actual paid repair beat exist, but gun-facing timelines conceal most masonry and felt recovery is untested. |
| 9 | First-match onboarding | 2 | 3 | **3** | U | D,H,S: all offered duels are armed and80/80 AI starts fire by 20.57 s; six onboarding checks pass, but supplied routes do not prove unbriefed completion. |
| 10 | Signalling over text | 3 | 3 | **3** | U | D,S: E/R cues, diagnostics and progress work; the real-view sample has 0 two-option windows and no evidence that newcomers discover most verbs. |
| 11 | Rule consistency | 3 | 3 | **3** | U | D,S: the palace line reads20/20/28.7/55 correctly; pre-population-loss screens still advertise only the20%-morale trigger. |
| 12 | Complexity ramp | 2 | 4 | **4** | — | D,S: cannon/stone first, R2, G3, F4, Q/X5 and the full arsenal by 10; profile0/3/10 browser checks preserve the small opening surface. |
| 13 | Impact/distance readability | 3 | 3 | **4** | U | H,S: wall/palace/person classification, retained references and73 correct observed captions improve feedback; distant detail, audio and precise aiming remain unvalidated. |
| 14 | Threat telegraphing | 2 | 2 | **4** | U | H,S: the seed 6 cue leads death by 2.97 s; all10 focal ruler deaths have matching warnings, with 2.90–3.37 s lead. |
| 15 | NPC legibility | 2 | 2 | **4** | U | D,S: all seven live-simulator idle fixtures match their HUD diagnosis or intentional reload/ready suppression; unbriefed diagnosis remains U. |
| 16 | HUD and alert hygiene | 3 | 4 | **4** | — | D,S: bounded messages, at most two choices and staged controls remain; AI-watch screenshots still advertise inactive WASD/Q/X footer actions. |
| 17 | Economy scarcity | 1 | 3 | **3** | — | H: all requested AI cohorts spend zero time at cap; focal near-zero time is only 0.139%, versus 19.26% in desert, so scarcity remains scenario-dependent. |
| 18 | Repair vs rebuild loop | 3 | 3 | **4** | U | D,S: real R repairs 24→25→40 HP for 1.28 g with priority 3 and visible progress; the initial 60%-HP wall is above the automatic repair threshold. |
| 19 | Morale design | 2 | 2 | **3** | U | H,S: the novice has 14 morale-clock surrenders and one population surrender; real 45 s progress and pressure causes are legible, but recovery comprehension is U. |
| 20 | Win-path variety | 2 | 1 | **4** | U | H: focal 26/10/4 includes eight leadership-exposed ruler records; pressure creates R/S wins, while other biomes remain 29/30 palace and sniping-first finds no target. |
| 21 | AI as opponent | 2 | 2 | **3** | U | D,H: AI 3 ready silence falls to 42.5 s and all biomes fire; both skill orientations favor AI 8, but ruler returns and asymmetric starting breach plans remain flawed. |
| 22 | Fair failure and replay | 2 | 2 | **4** | U | D,S: real losses name cause/source/time, retain decisive events and support same-setup Enter retry; fairness is U and the debrief supplies no difficulty-ladder suggestion. |

**A 12/20, B 13/20, C 13/20, D 16/20, E 14/20, F 7/10 = 75/110.** No A/D/F criterion is at 1. The rubric band is “promising, specific rework required.”

Two lane-provisional grades are not adopted: **B6 stays 3 rather than research/20’s 4**, because individual player-proxy and AI 8 pacing gates remain weaker than the pooled AI result; the proxy bug is separated from actual game balance. **C11 stays 3 rather than research/21’s 4**, because an accurate palace clock does not reveal the separate population loss condition. The UI’s A1/D13=4 remains an intermediate grade: observed offsets are correct, but missing long-miss feedback and unproved chosen-point convergence prevent 5. E18=4 is supported by actual paid progress above the automatic-repair threshold, without claiming human uptake.

The strongest changes are broad AI/start reliability, attributable danger and failure, and visible repair/defeat-clock feedback. The largest remaining gains are meaningful use of existing reload choices, usable aiming across normal hits and long misses, and unbriefed discovery. Adding verbs is not supported by this evidence.

## 6. Strategy screen, ending viability and physical asymmetry

All eight policies use seeds 1–10 against AI 5 from physical west, with ordinary costs, crew, ammunition and damage. The six old policies are retained. Expert construction policies have generous command-level administrative reach; these are stress screens, not demonstrations of human execution. They retain the old non-evading behavior. The conditional sniper switches from its palace policy only when a ruler is exposed. Morale pressure aims at visible/dense crew and civilian groups with a wind-aware solution; its aiming method is stronger than the novice policy.

| Policy | Wins | Strictly >60%? | Median min | Timeouts | New gun orders / built |
|---|---:|---|---:|---:|---:|
| Turtle / repair | 7/10 | Yes | 9.06 | 0 | 1 / 1 |
| Fire only | 6/10 | No | 7.81 | 0 | 0 / 0 |
| Ballista spam | 1/10 | No | 12.48 | 1 | 20 / 20 |
| Rebuild lane | 6/10 | No | 7.81 | 0 | 1 / 1 |
| Recovery mounts | 6/10 | No | 9.15 | 0 | 14 / 14 |
| Covered ruler / auto-fire | 6/10 | No | 9.54 | 0 | 0 / 0 |
| Conditional ruler sniping | 6/10 | No | 7.81 | 0 | 0 / 0 |
| Morale pressure | 7/10 | Yes | 8.76 | 0 | 0 / 0 |

Turtle and morale pressure are the two flagged plans, both 7/10. One seed changes the observed rate by ten percentage points; a one-win advantage over fire-only is not a dominance proof. Covered hiding reaches the authored shelter in 9/10 games and still loses three rulers overall. Ballista spam improves from v2’s 0/10 to 1/10, but retains one timeout despite twenty completed purchases.

The conditional sniper issues **zero ruler-targeted fire orders** and reproduces all ten fire-only hashes exactly. Its fallback destroys or loses the battle before obtaining an exposed ruler target. This does not prove a pressure-first sniper is impossible, but this screen does not demonstrate a distinct sniping plan.

Morale pressure issues **196 crew-targeted and 13 civilian-targeted fire orders**, none aimed at a ruler or palace. Its seven wins are **four ruler and three population-surrender endings**. The ruler wins comprise two blasts, one projectile and one fall; the two blast wins also cross the population threshold in the same terminal state. Thus four “ruler wins” are not four intentional snipes, and a tie-breaking elimination label is not necessarily a distinct strategic success. [Raw strategy records](../tests/evidence/critique-v3/strategies.json).

The detailed ending audit covers every non-palace focal case: five ruler worlds and two surrender worlds, each repeated in both numeric slot orders. Eleven detailed normal-order replays match their focal hashes, and all paired path/exposure summaries match under physical relabelling. [Ending quality](../tests/evidence/critique-v3/ending-quality.json).

| Ruler case | Paired records | Exposure and decision | Killing shot | Warning lead |
|---|---:|---|---|---:|
| Seed 4 | 2 | Leadership excursion; still manning the front gun | Deliberate ruler target, projectile | 2.90 s |
| Seed 11 | 2 | Leadership excursion; still manning the front gun | Deliberate ruler target, projectile | 3.03 s |
| Seed 12 | 2 | Leadership excursion; no longer manning, ruler remains at the front | Deliberate ruler target, blast | 3.00 s |
| Seed 14 | 2 | Leadership excursion; no longer manning, ruler remains at the front | Deliberate ruler target, blast | 2.93 s |
| Seed 16 | 2 | No leadership excursion; still in the keep and unexposed at launch | Palace-target collateral blast | 3.37 s |

Thus **8/10 ruler records follow an exposed leadership decision; 2/10 are covered collateral deaths**. Half of the leadership records have an additional quality problem: the ruler has stopped manning but remains at exactly the front operator position. The controller's same-floor shelter filter excludes ground-floor shelters from y=7; code and positions implicate that filter, but a return-route trace should validate the proposed repair. Do not describe all ten deaths as intentional snipes or all eight exposed deaths as a successful retreat/risk loop.

Dominant pressure below means the largest current harmful diagnostic weight, not an integrated causal share of morale loss.

All four focal surrenders are population-triggered. Seed 6 ends with population **12<14**, morale **35.45**, hold **0/1350 ticks**; seed 9 with **11<14**, morale **29.85**, hold **0/1350**. The strongest signed pressure is deaths/losses, weights **−1.025** and **−0.8375** respectively. The losing-side pre-terminal screens show losses, so the cause is visible. However, they advertise **“surrender at 20% morale”** while the unshown population threshold is about to decide the match. The end account correctly changes to population loss. Cause visibility and trigger predictability are different results. [Last seed-6 frame](../tests/evidence/critique-v3/shots/ai-seed6-last.png), [end account](../tests/evidence/critique-v3/shots/ai-seed6-end.png).

The 15 proxy surrenders comprise **14 morale-clock cases and one population case**. Dominant current pressure is **palace damage in eight and losses in seven**. The per-case trigger, weight and produced pressure text are listed in [the ending ledger](../tests/evidence/critique-v3/novice-ending-quality.json). Seven are enemy surrenders after a player win: their pressure is not on the local player's morale line, and the winning screen has no cause account. The eight local surrender losses have the local pressure surface and loss account. An actual AI 2 seed 3 replay shows **losses / surrender 44/45 s**, morale 11%, population 15 (above 14), and palace 96.2% before surrender; its final browser hash matches the scored proxy. This is a distinct morale defeat, not population or palace defeat. [Actual clock](../tests/evidence/critique-v3/shots/morale-clock-last.png), [replay](../tests/evidence/critique-v3/morale-browser.json).

All seven morale-pressure victories were causally replayed with matching hashes. The four ruler deaths all follow AI leadership excursions: seed 1 is manning the front gun, seed 2 is no longer manning it, seed 5 falls, and seed 9 is walking to a rear gun. The three surrender wins, seeds 3/7/8, are population-triggered at 12/11/12 survivors; losses dominate with weights −0.825/−1.0375/−0.825. None is a morale-clock victory. This supports a people-attrition plan, with several different formal endings, and qualifies the meaning of its 7/10 win rate. [Strategy ending audit](../tests/evidence/critique-v3/strategy-quality.json).

All environment controls pair the same **20 normal-order seeds** with the focal baseline. Terrain-only reflects both heightfield arrays across world X and retains plot placements, wind, controller and random identities. Wind-only reflects the complete wind direction schedule; calm sets speed to zero while retaining its timing. The full east-castle mirror reflects authored anchors, weapon ordering/facings and metadata as well as cells. These effects are not additive causal percentages.

| Condition | West/east wins | Winner flips vs baseline | In 12–20 | P/R/S |
|---|---:|---:|---:|---:|
| Original | 6/14 | 0/20 | 18/20 | 13/5/2 |
| Terrain only reflected | 6/14 | 0/20 | 18/20 | 13/5/2 |
| Wind only reflected | 7/13 | 5/20 | 17/20 | 9/9/2 |
| Zero wind speed | 5/15 | 3/20 | 19/20 | 11/9/0 |
| Full east castle reflection | 9/11 | 9/20 | 17/20 | 10/9/1 |

Terrain reflection changes **no winner, ending or duration**; 18/20 worlds also retain the complete side statistics and minute curves. Wind changes five winners but moves west’s aggregate share only from 30% to 35%; removing wind gives 25%. Full authored reflection moves west to **45% (9/20)**, but also changes the ending mix to 50% palace / 45% ruler / 5% surrender. It is a diagnostic, not an accepted repair preserving the focal gates. [Environment records](../tests/evidence/critique-v3/environment.json), [mirror](../tests/evidence/critique-v3/mirror.json).

The physical skew is concentrated in the new endings: palace finishes split **12 west / 14 east**, while all ten ruler and four surrender records are east wins. The 36,864 authored castle cells are already exactly x-reflection symmetric. The ruler spawn, throne and exit are one cell off a true reflection. In an isolated zero-wind state at tick 0, with breach selection explicitly enabled, the AI’s ruler-avoidance rule chooses aims that differ by **2 m vertically and 1 m along Z**. Disabling only that rule makes them mirror; retaining the rule and moving only the east ruler/throne from local **x=23 to x=24** also makes the aims mirror exactly. This localises a deterministic interaction between the asymmetric ruler anchor and the new collateral-avoidance test. [Geometry/anchor audit](../tests/evidence/critique-v3/layout.json), [initial target experiment](../tests/evidence/critique-v3/initial-target-symmetry.json).

**Smallest proposed fix:** mirror the east starter throne anchor by one cell, preserving terrain, wind and the intended ruler-avoidance rule. The one-field candidate fixes initial targeting symmetry; it has not received a full outcome sweep. The full-metadata experiment changes other anchors and weapon ordering too, so it cannot prove the one-field win rate. Validate that candidate on held-out seeds and both numeric orders before adopting it. The 6/20 baseline west share has a 95% Wilson interval of about **14.5–51.9%**; the observed skew alone is not a population-level proof of bias. `.26` owns this validation.

## 7. Ranked repairs and Beads

Eight repair tasks are filed under `castle-game-uo7`, as requested. Expected points are conditional and overlapping improvements are not additive. Source changes belong to future lanes; this critique edits no production code.

1. **Make reload guidance reflect useful actions on the actual player screen — `castle-game-uo7.21`.** Criterion: A2, A4, E18. Expected points: +2 (A2/A4); E18 conditional. Lane: UI/player; sim only if counterfactuals justify it. Acceptance: Compare displayed suggestions against the documented bounded solver at every eligible reload in 10 seeds each versus AI 2/5/8; publish zero/one/two-option counts, legal failures and beneficial-best coverage. Validate renderer parity in SwiftShader. Three unbriefed five-reload sessions: at least two people discover and choose two distinct non-aim intervention types and explain cost/exposure. No new binding or compulsory repair chore.

2. **Resolve novice pacing tails without hiding them in aggregate AI results — `castle-game-uo7.22`.** Criterion: B6. Expected points: +1. Lane: Sim/AI/player policy audit. Acceptance: Explain every timeout and sub-8-minute proxy result using command, position, idle-reason and target traces. Test a concrete repair on seeds 1-10 and a held-out 11-20 set per affected cohort; at least 80% finish in 12-20 minutes, with no timeout. Preserve the focal ending mix, paid recovery and first-shot gates. No minimum-duration timer or invulnerability; validate the navigation correction with human play.

3. **Report shots that leave the map and make offsets usable for aiming — `castle-game-uo7.23`.** Criterion: A1, D13. Expected points: +2, conditional on aiming/perception acceptance. Lane: Sim/contracts and UI/player. Acceptance: Every one of a repeated 20-shot-per-weapon cohort receives an honest impact or bounds/expiry explanation within two seconds of terminal removal; never invent a landing point. Preserve immutable launch references and signed axes when aim changes during flight. Distinguish own obstruction, enemy wall interception and palace damage. A no-solver four-shot calm-wind policy converges on a chosen 190 m-class target in at least 8/10 seeds, and two of three people classify direction/impact within two seconds.

4. **Show the population surrender threshold before the fatal volley — `castle-game-uo7.24`.** Criterion: C11, E19. Expected points: +1 (C11). Lane: UI. Acceptance: In fresh SwiftShader replays of seeds 6 and 9, before the terminal shot, the existing morale/pressure surface shows the current population against the actual strict-below-14 threshold when near danger. Keep the 20% / 45 s morale clock correct and make simultaneous ruler/population elimination respect the recorded reason. Two of three playtesters predict the active loss trigger without external explanation.

5. **Give leadership rulers a usable route back from the rampart — `castle-game-uo7.25`.** Criterion: F21, E20. Expected points: +1 (F21, shared with physical-balance work). Lane: AI/NPC. Acceptance: Trace departure, release or loss of the gun, and return in seeds 12/14. A leader no longer manning with a reachable ground-floor shelter must traverse normal stairs/ladder movement to it; demonstrate the route within 30 seconds in an isolated physically valid case. Preserve mortal risk, paid crew rules, warnings and a genuine ruler-target opportunity. Rerun 20 paired focal seeds and report intentional versus collateral endings and pacing.

6. **Validate the smallest repair for physical west/east skew — `castle-game-uo7.26`.** Criterion: B7, F21. Expected points: +1 maximum, shared with ruler-return work. Lane: Sim/map/AI. Acceptance: Report paired winner/duration changes for terrain-only, wind-only and full castle-reflection controls, retaining physical RNG identity. Implement only the smallest supported candidate, then test 20 held-out seeds in both slot orders: each physical side 40-60%, both 3/8 skill assignments still favor AI 8, and pacing/endings/fire gates preserved. Do not mistake numeric-slot balance for physical balance or sum non-additive ablation effects.

7. **Resolve frequent losing-palace plateaus using the correctly scoped metric — `castle-game-uo7.27`.** Criterion: B5, B8. Expected points: +2 conditional on demonstrated shape and recovery. Lane: Sim pacing plus UI/human validation. Acceptance: Keep the same post-120 s max-minus-min <2 pp definition and scope both count and maximum to eventual losers. Annotate long windows with actual firing, gun/population/ruler crises and visible repair; conduct the 30-minute playtest before equating flat palace HP with boredom. If dead middles are confirmed, reduce the count below v2's 32/40 while keeping the maximum at or below 332 seconds and preserving pacing/endings. Demonstrate a recoverable, visible repair beat.

8. **Run the unbriefed onboarding and comprehension study left open by the repair lanes — `castle-game-uo7.28`.** Criterion: C9, C10; human validation for A2/A4/B8/C11/D13/D14/E18/F22. Expected points: +2 (C9/C10), not automatic credit for other U rows. Lane: Human playtest / UI. Acceptance: Record first action/first hit times, requests for help, match completion, non-aim choices over five reloads, warning reaction latency, idle-reason diagnosis, predicted palace/population/morale triggers, and one-action retry. At least two of three finish without coaching and hit the enemy within four minutes. Counterbalance one four-shot weapon trial; log qualitative overload and quiet-beat ratings. Publish failures as well as successes and keep unsupported judgments U.

The physical-side and leader-return items share at most one F21 point. The reload item can add A2/A4 points; an additional E18 point needs demonstrated prioritisation/reward. The three largest available gains are therefore **reload/role/repair quality, up to +3; aiming/readability, +2; onboarding/discovery, +2**. These are conditional future gains, not credit awarded to proposed changes. [Filed descriptions](../tests/evidence/critique-v3/issues.json).

## 8. Verification, human limits and handoff

The settled tree passes **498 unit tests, zero failures/skips**, production build, browser smoke, flow and six onboarding checks. All **48 golden poses compare at zero pixels** without replacing any baseline: 33 completed in the first pass and 15 passed on retry after a screenshot timeout under concurrent load. The original two critique-probe tests pass. `.17` is closed with these fresh numbers. [Verification](../tests/evidence/critique-v3/verification.json), [unit log](../tests/evidence/critique-v3/unit.log), [golden retry](../tests/evidence/critique-v3/goldens-retry.log).

U remains for unbriefed discovery/completion, perceived workload and trade-offs, felt match shape/recovery, comprehension of unfamiliar rules and warnings, perceptual impact/audio quality and fair-failure judgment. Scripts do not certify those results. Nor does this loaded SwiftShader run measure uncontended real-time responsiveness. A finite policy screen is not an exhaustive strategy search or proof of dominance.

A **30-minute script per newcomer**, repeated with three people, should measure:

| Time | Procedure and recorded measure |
|---|---|
| 0–3 min | Start quick play with only the win/survival goal. No coaching. Record first movement, gun discovery, E/crew understanding and every request for help. |
| 3–15 min | Continue the match; record first enemy hit, shot corrections, every non-aim decision across five reloads, cue noticed versus ignored, warning-to-action latency, crises and short workload/quiet-beat ratings. Do not tell the player to use a particular alternative. |
| 15–20 min | Finish or record censoring, then present saved crew/ammo/funds/obstruction states. Ask why the gun is idle and what action is legal. Record accuracy and time, using the appropriate progression profile. |
| 20–25 min | Four calm-wind shots at a chosen 190 m-class target, with one weapon counterbalanced across participants. Record wall-versus-palace identification, short/long and left/right interpretation within two seconds, and convergence. Listen to audio here. |
| 25–28 min | Present the four palace clocks and near-population/morale surrender states. Ask for the current defeat margin and the next likely loss trigger before revealing the outcome. |
| 28–30 min | Ask for the cause of a real loss, retry without instruction, and a short account of overload, waiting, useful repair and what the player would do differently. |

The minimum discovery gate is two of three finishing without coaching and reaching a first enemy hit within four minutes. At least two should choose two distinct non-aim intervention types across the five-reload sample and explain the cost/exposure consequence. Publish failures and assistance rather than replacing them with a successful scripted route. Thirty minutes is per person, not three complete studies compressed into one session.

All 306 source files and the two baseline driver scripts are unchanged. Every JSON evidence file is below 2 MB. No golden was replaced. Diagnostic fixture pilots and the first screenshot timeout are retained separately; they are not counted as passes or games. No git command or Dolt push was run. `castle-game-uo7.18` and `.19` remain open with the new diagnosis/corrected metric; `.21`–`.28` own the ranked repairs. `castle-game-uo7.20` is completed by this report and the new top section of `HANDOFF.md`.

1. Total: 75/110 (+15 from v2); target 70 exceeded by 5.
2. A — Loop and decisions: 12/20.
3. B — Pacing: 13/20.
4. C — Onboarding and discovery: 13/20.
5. D — Feedback and legibility: 16/20.
6. E — Systems: 14/20.
7. F — Opponent and failure: 7/10.
8. Focal: 26 palace / 10 ruler / 4 surrender; 0 timeouts; 36/40 in range.
9. Physical wins: 12 west / 28 east; full authored mirror gives 9/11 over 20 worlds.
10. Novice wins versus 2/5/8: 8/10, 4/10, 5/10; only 14/30 matches in range.
11. Reloads: 605; 91 one-option views, 0 two-option views; 21/209 beneficial best choices shown.
12. Largest available gain: existing reload/role/repair choices, up to +3.
13. Next available gain: aiming and impact readability, +2.
14. Next available gain: unbriefed onboarding/discovery, +2.
15. Unmeasured: human comprehension, workload, felt recovery, audio, fairness and unconstrained strategy quality.
