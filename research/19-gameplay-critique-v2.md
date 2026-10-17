<!-- owns: the independent wave-1 gameplay re-score, reproducible evidence and ranked repair handoff. -->
# 19 - Gameplay critique v2

2026-10-18. **60/110, up from 52/110; 10 points short of 70.** The rubric still places this below 65: “loop does not yet hold.” The forest level-5 simulation repairs reproduce exactly. They do not establish satisfactory player pacing, working opponents on every offered map, or three viable ways for the player to win.

The largest available gains are attributable danger/failure (**+4**), pacing and opponent recovery (**+3**), and meaningful ending variety/morale feedback (**+3**). Those are conditional future gains, not points awarded to proposed code. An unarmed match-1 start also needs fixing irrespective of the total.

Design target: “a balance between easy pick up and play and not too encyclopaedic and daunting.” This review rewards the smaller opening control surface. It does not recommend more simultaneous bindings to repair the remaining problems.

## 1. Method, cohorts and limits

Read `CLAUDE.md`, DESIGN sections 5–8, research/00 and research/15–18. Criterion names and groups below follow research/15: **C9–12 is onboarding; D13–16 is feedback**. Scores retain research/16's four-column scorecard; the score column is **v2 (v1)**. Tags: **D** code/test evidence, **H** headless measurements, **S** inspected screenshots, **U** a human-dependent part remains unvalidated. Every numerical score has D/H/S evidence; U is not a fabricated human result.

Scored cohorts: **150 AI-vs-AI matches, 30 embodied novice matches, and 60 strategy trials**. Additional controls include 10 match-1 runs, 30 engine-level novice runs, 10 courtyard-retreat runs, 10 four-minute default-charge probes, and 30 isolated tuning trials. These are not all independent worlds. Forest pairing preserves each physical castle's random stream: 40 paired records represent **20 seeds**, each biome's 10 records represent **five seeds**, and the level matrix uses ten seeds per level. The matrix's level-5 seeds overlap the main forest cohort; do not pool them as independent replication.

All production cohorts use 30 Hz and a **20-minute observation cap**. A censored match is not an in-game draw or forced ending. The charge-119 sensitivity cohort has a separate four-minute cap. Quantiles use linear interpolation; length distributions and standard deviations containing censored records describe observations, not uncensored eventual durations.

The sweep already supported `--map`. Changes to it add an output directory, resumability, an import-safe worker guard, and read-only path telemetry. `scripts/novice.mjs` contains the actual novice policy and the six variants; the frozen earlier command-level implementation is `scripts/novice-engine-probe.mjs`. All **303 `src/**/*.js` files are unchanged**, verified by the [source snapshot](../tests/evidence/critique-v2/source-start.json) and [comparison](../tests/evidence/critique-v2/source-verification.json). No git or Dolt push command was run. Numeric tuning experiments used isolated module-loader substitutions in memory, not source edits.

Reproduction, from the repository root:

```bash
node scripts/sweep.mjs --seeds 20 --swap-slot --label critique2 --workers 8 --output-dir tests/evidence/critique-v2
node scripts/sweep.mjs --matches 60 --ai-levels 3,5,8 --label critique2-levels --output-dir tests/evidence/critique-v2
node scripts/sweep.mjs --matches 20 --levels 3,8 --label critique2-unequal --output-dir tests/evidence/critique-v2
node scripts/sweep.mjs --matches 10 --map desert-duel --label critique2-desert --output-dir tests/evidence/critique-v2
node scripts/sweep.mjs --matches 10 --map ice-duel --label critique2-ice --output-dir tests/evidence/critique-v2
node scripts/sweep.mjs --matches 10 --map volcano-duel --label critique2-volcano --output-dir tests/evidence/critique-v2
node scripts/novice.mjs --policies novice --seeds 10 --levels 2,5,8 --workers 6 --label novice-embodied
node scripts/novice-engine-probe.mjs --seeds 10 --workers 6 --label novice
node scripts/novice.mjs --policies ruler-hiding --seeds 10 --workers 4 --label hiding-covered
node scripts/novice-engine-probe.mjs --policies novice --levels 2 --seeds 10 --max-minutes 4 --charge 119 --label novice-default-aim
node scripts/novice.mjs --policies match1 --seeds 1 --label replay-match1
node scripts/critique-capture.mjs
node scripts/critique-capture.mjs --prompts
node scripts/critique-loss.mjs
node scripts/critique-tuning-probe.mjs --radii 4,0 --seeds 10 --label ruler-tuning
node scripts/critique-tuning-probe.mjs --radii 4 --pop 0.35 --seeds 10 --label joint-tuning
node scripts/analyze-critique.mjs
```

The actual level-matrix run was split into disjoint seed batches for concurrency: seeds 1–5 from the original job, then `--matches 30 --ai-levels 3,5,8 --seed-start 6 --label critique2-levels-tail`. `scripts/merge-critique-levels.mjs` asserts all 60 seed/level/slot/map job identities and the shared core fingerprint before assembling the canonical file. No return-leg result was copied from its partner.

Evidence index: [derived analysis](../tests/evidence/critique-v2/analysis.json), [measurement audit](../tests/evidence/critique-v2/audit.json), [forest](../tests/evidence/critique-v2/sweep-critique2.json), [level matrix](../tests/evidence/critique-v2/sweep-critique2-levels.json), [unequal levels](../tests/evidence/critique-v2/sweep-critique2-unequal.json), [embodied novice](../tests/evidence/critique-v2/novice-embodied.json), [engine controls/variants](../tests/evidence/critique-v2/novice.json), [covered hiding](../tests/evidence/critique-v2/hiding-covered.json), [screenshots manifest](../tests/evidence/critique-v2/shots/manifest.json). Other files named below are in the same evidence directory.

## 2. Reproduced sweep and generalization failures

Length columns are **min / p10 / median / p90 / max**, in minutes. Wins are counts out of N, including censored matches in the denominator. Physical west/east also preserves castle identity; swapping a slot does not exchange the castle's layout or random stream.

| Cohort | N | Length distribution (min) | SD (s) | Finished in 12–20 min | Slot 0/1 wins | West/east wins | Endings |
|---|---:|---|---:|---:|---:|---:|---|
| Forest 5/5, 20 seeds × 2 | 40 | 12.06 / 12.35 / 14.23 / 16.55 / 16.89 | 91.3 | 40/40 | 20/20 | 16/24 | palace 40 |
| Forest level matrix, combined | 60 | 12.00 / 12.06 / 14.24 / 20.00 / 20.00 | 191.4 | 44/60 | 22/22 | 16/28 | timeout 16, palace 44 |
| Forest 3/3 | 20 | 19.42 / 19.86 / 20.00 / 20.00 / 20.00 | 10.3 | 4/20 | 2/2 | 0/4 | timeout 16, palace 4 |
| Forest 5/5, matrix subset | 20 | 12.06 / 12.35 / 14.23 / 16.60 / 16.89 | 88.4 | 20/20 | 10/10 | 8/12 | palace 20 |
| Forest 8/8 | 20 | 12.00 / 12.01 / 12.61 / 14.13 / 14.23 | 54.8 | 20/20 | 10/10 | 8/12 | palace 20 |
| Forest 3/8 | 20 | 11.30 / 11.36 / 12.28 / 13.58 / 14.22 | 56.6 | 10/20 | 10/10 | 0/20 | palace 20 |
| Desert 5/5 | 10 | 11.06 / 11.06 / 13.86 / 18.63 / 18.63 | 147.3 | 8/10 | 5/5 | 0/10 | palace 10 |
| Ice 5/5 | 10 | 15.19 / 15.19 / 20.00 / 20.00 / 20.00 | 115.3 | 2/10 | 1/1 | 2/0 | timeout 8, ruler 2 |
| Volcano 5/5 | 10 | 10.91 / 10.91 / 13.53 / 14.33 / 14.33 | 69.6 | 8/10 | 5/5 | 0/10 | palace 10 |

Cap = 2000 g; near-cap ≥1900 g; near-zero ≤200 g. Cap mean averages side-time fractions; “worst” is the worst individual side. Silence includes the opening and terminal interval. Ready silence requires a living loaded gun, ammunition, sufficient crew and shot funds; it does **not** establish a clear firing lane. Comeback means the side losing the first gun subsequently won, excluding simultaneous first losses and unfinished matches.

| Cohort | Cap mean / worst | Near-cap mean | Near-zero mean | First-gun comebacks / cases | Longest actual / ready silence (s) |
|---|---:|---:|---:|---:|---:|
| Forest 5/5, 20 seeds × 2 | 0.00% / 0.00% | 0.00% | 0.010% | 6/8 | 70.5 / 70.5 |
| Forest level matrix, combined | 0.40% / 24.21% | 0.45% | 1.867% | 8/14 | 707.4 / 707.5 |
| Forest 3/3 | 1.21% / 24.21% | 1.34% | 5.447% | 0/2 | 707.4 / 707.5 |
| Forest 5/5, matrix subset | 0.00% / 0.00% | 0.00% | 0.000% | 4/6 | 70.5 / 70.5 |
| Forest 8/8 | 0.00% / 0.00% | 0.00% | 0.154% | 4/6 | 49.0 / 49.0 |
| Forest 3/8 | 0.00% / 0.00% | 0.01% | 0.585% | 8/10 | 67.0 / 67.0 |
| Desert 5/5 | 24.90% / 60.38% | 41.78% | 0.000% | 10/10 | 1117.6 / 160.8 |
| Ice 5/5 | 42.03% / 80.70% | 57.74% | 0.000% | 0/0 | 1182.4 / 19.1 |
| Volcano 5/5 | 23.72% / 58.72% | 39.77% | 0.000% | 10/10 | 859.8 / 4.1 |

The main forest cohort independently reproduces **40/40 duration, winner and final state hashes**, and the six-file core fingerprint, from `sweep-after.json`. It reproduces the 12.06–16.89 minute range, 14.24 minute mean, 91.3 s SD, 20/20 slot wins, **16/24 physical wins**, 6/8 first-gun comebacks, 70.5 s worst silence and 40 palace endings. Each side averages 34.2 shots, 33.5 registered hits, 14.0 built blocks, 45.6 completed repairs and 13.1 NPC deaths. Registered hits can include friendly impacts; they are not a palace-accuracy statistic.

The apparent zero near-zero time is rounding: **0.00984%**, not literally zero. The sampled minimum treasury is **170.84 g**; **17.65%** of sampled side-seconds are below a 750 g cannon. This supports occasional scarcity, not the rubric's 10–25% near-zero target. The 6/8 comeback result is **3/4 independent seeds**, not eight independent first-blood tests, and gun loss is not the rubric's first-hit metric.

Three results materially qualify research/17:

1. **The original stall question still fails.** After the opening two minutes, 32/40 eventual losers have a continuous sampled span longer than 180 s whose palace HP range is under two percentage points; longest **460 s**. This uses one-second samples and a max-minus-min band, so repair oscillation is not mistaken for forward progress. The wave's weaker “neither palace changes at all for five minutes” statistic passes: maximum joint no-change gap **263.73 s**. Damage in three different minute buckets does not establish a continuously developing crisis.
2. **Low-level AI still goes inert.** Level 3 seed 3, default order slot 1, has **707.43 s actual / 707.47 s ready silence**. Sixteen of twenty level-3 records are censored at 20 minutes. Thus the level-5 70.5 s result does not establish the claimed recovery behavior throughout the difficulty ladder.
3. **Offered maps can be non-contests.** Desert `orig-19` and volcano `orig-67` have **zero initial weapons** and fire **zero shots in all ten records each**. Their opponents win every physical east-side match while slot wins still look perfectly balanced. Ice starts armed (two cannons versus one) but times out 8/10; seed 1's shot split is **34/1** and its quiet side goes **1182.43 s** without firing. The exact remaining ice supply/replacement blockage was not localized in this critique. [Loadout audit](../tests/evidence/critique-v2/map-loadouts.json); [desert](../tests/evidence/critique-v2/sweep-critique2-desert.json), [ice](../tests/evidence/critique-v2/sweep-critique2-ice.json), [volcano](../tests/evidence/critique-v2/sweep-critique2-volcano.json).

The desert/volcano 10/10 “comebacks” are not evidence of contested recovery: only the armed castle can lose a gun, and its opponent never shoots. Likewise, a never-ready castle can have a ready-silence statistic of zero while doing nothing all match. Acceptance must test actual first shots and recovery as well as readiness-gated silence.

Level 8 wins **20/20** unequal-level matches. It is always physically east because the harness swaps controller and castle identity together. That experiment confounds skill with side; reverse the physical assignment before claiming a calibrated difficulty effect.

## 3. Human play proxy and decision density

The scored policy walks the real TB1 route, mans the east cannon, gets E's one-time crew order, uses a rounded palace bearing and initial charge 100, and corrects large observed lateral errors or misses outside the enemy plot. It repeats a shot intercepted by the enemy's shield rather than treating every wall hit as an undershoot. It never uses the production AI target selector or ballistic solver for novice aim.

When damaged, it leaves the cannon, looks at an owned damaged cell within **24 m and voxel line of sight**, issues a priority repair, and returns to the gun; this costs at least **1.5 s**. It may buy **one** replacement cannon after a loss and re-man it locally. It never reassigns individual crews. Every manual shot in the final 30-match cohort is fired while manning the gun: **zero remote manual shots**. A replacement was actually paid for at **277.03 s in AI 5 seed 3**, built, and crewed by three people. Earlier engine-level runs that repaired while manned are retained as administrative upper bounds, not used as the human proxy.

This is an **instructed, favorable aiming proxy**, not an unbriefed newcomer. It knows the route and the intended palace bearing; charge 100 is a useful opening guess. R and G correspond to an unlocked repair/replacement surface, not the real match-1 profile, which hides R until match 2 and G until match 3. Navigation discovery, aiming comprehension and perceived workload require humans.

| Opponent AI | Wins | First enemy hit: median (range), s | First enemy-palace HP loss: median (range), s | Match min / median / mean / max, min | In 12–20 min |
|---|---:|---|---|---|---:|
| 2 | 7/10 | 12.17 (12.13–12.20) | 12.18 (12.13–43.13) | 5.91 / 8.93 / 8.97 / 11.15 | 0/10 |
| 5 | 7/10 | 12.17 (12.13–12.20) | 12.18 (12.13–43.13) | 0.77 / 8.03 / 7.51 / 12.55 | 2/10 |
| 8 | 5/10 | 12.17 (12.13–12.20) | 12.18 (12.13–42.13) | 1.12 / 7.45 / 6.68 / 11.86 | 0/10 |

All 30 runs finish. **All 19 player wins are palace defeats; ten of eleven losses are ruler deaths**, the other a palace defeat. AI 5 seed 6 ends at **46.03 s**, seed 4 at **97 s**. Only **2/30** novice matches fall in 12–20 minutes. This is a legal policy capable of short games, not an estimate of the duration a stranger would experience.

The actual profile-1 control, with no repair or gun placement, wins **7/10 against AI 2**, median **8.77 min**, and loses three rulers. The favorable starting aim matters: with the rounded displayed default charge **119**, the same conservative learning rule reaches an enemy castle hit in **12.40–12.47 s**, but **0/10** runs damage the palace during the four-minute observation. Its rule does not distinguish a rear-wall overshoot from a useful shield hit. This exposes a proxy limitation and the weakness of “first hit” as a learning metric; it is not proof that humans cannot correct the aim. [Default-charge control](../tests/evidence/critique-v2/novice-default-aim.json).

Decision windows start at a successful cannon shot and end when it reloads, is lost, or the match ends. Samples are taken each second; partial windows shorter than 10 s are excluded. A type is counted once per window, not once per keypress or block. The considered alternatives have explicit predicates: a damaged affordable unprioritized repair, a legal useful missing blueprint cell, an affordable replacement site after a loss, an unordered crew, an ammo shortage, shelter under casualties/fire, and movement to safety under fire. The local novice count applies the 24 m/visibility checks and removes crew/ammo/shelter verbs outside its instructed control set. FIRE is not credited as an alternative while reloading. Zero-motion look commands, E leave/re-man bookkeeping and repeated R presses are not extra decisions.

| AI | Reload windows | Engine-level available types, mean | Locally available types, mean | Local non-aim types, mean | Distinct non-aim types actually used, mean |
|---|---:|---:|---:|---:|---:|
| 2 | 247 | 5.37 | 3.21 | 2.21 | 0.83 |
| 5 | 203 | 5.60 | 3.54 | 2.54 | 0.94 |
| 8 | 179 | 5.80 | 3.67 | 2.67 | 0.97 |

Across **629 windows**, mechanical alternatives exist: local medians are **3, 4, 4 types** at AI 2/5/8, or **2, 3, 3 excluding aim**. Executed non-aim variety has median **one** and maximum **one** in every level cohort. This policy mostly chooses repair. It does not prove that people would ignore the alternatives: policy preferences and the heuristic definition of “useful” matter. A2 now has a measured opportunity count; salience, meaningful choice and the full three-role workload remain **U**. Adding more verbs is not supported by these results.

## 4. What the screen actually shows

Used `tests/lib.mjs` with `playwright-core`, software WebGL/SwiftShader, 1024×768, pixel ratio 1. `speed=8` would clamp to 4 and `play=1` creates a local player, not two AIs. Instead, the real skirmish menu selected forest-duel and two level-5 AI slots under the golden clock. A separate `profile=0` menu session played the match-1 command replay against AI 2. No fabricated victory state was used.

| Time | AI 5 vs AI 5 | Match-1 profile vs AI 2 |
|---|---|---|
| 0 | [ai-m00.png](../tests/evidence/critique-v2/shots/ai-m00.png) | [match1-m00.png](../tests/evidence/critique-v2/shots/match1-m00.png) |
| 2 min | [ai-m02.png](../tests/evidence/critique-v2/shots/ai-m02.png) | [match1-m02.png](../tests/evidence/critique-v2/shots/match1-m02.png) |
| 5 min | [ai-m05.png](../tests/evidence/critique-v2/shots/ai-m05.png) | [match1-m05.png](../tests/evidence/critique-v2/shots/match1-m05.png) |
| 10 min | [ai-m10.png](../tests/evidence/critique-v2/shots/ai-m10.png) | [match1-m10.png](../tests/evidence/critique-v2/shots/match1-m10.png) |
| Actual end | [ai-end.png](../tests/evidence/critique-v2/shots/ai-end.png), 13:37 | [match1-end.png](../tests/evidence/critique-v2/shots/match1-end.png), 13:17 |

The AI view is inside cover by minute 5. This is its real first-person position, not an invented spectator angle. It cannot demonstrate that a human notices a repair beat. The player's gun-facing frames also hide most own-castle repair activity. B8 is therefore limited to measured recovery and what these views reveal; perceived pacing is **U**.

The [E prompt](../tests/evidence/critique-v2/shots/match1-man-prompt.png) and [fire prompt](../tests/evidence/critique-v2/shots/match1-fire-prompt.png) are plainly visible. The walking newcomer has one minimap, B, gold/population and labelled income; the gun view adds charge bounds, an approximate calm-air metre estimate and End's impact control. Locked order buttons and the decorative side-button column are absent. Those are visible improvements, not merely code claims.

The [impact view](../tests/evidence/critique-v2/shots/match1-impact.png) makes castle geometry and the landing region readable. The [same distant shot](../tests/evidence/critique-v2/shots/match1-distant-hit.png) offers a much smaller target; individual damage is not reliably legible. Neither gives a measured miss offset. The build prompt exists only while walking, so the gun-centric timeline does not demonstrate discovery of building. NPC role colours are visible, but the gun console does not explain crew/ammunition/path stalls. Flee/shelter icons exist in code; the main forest cohort never reaches the low morale that would exercise them.

The [frame three seconds before the early loss](../tests/evidence/critique-v2/shots/novice-L5-seed6-before-death.png) and [actual 0:46 defeat screen](../tests/evidence/critique-v2/shots/novice-L5-seed6-loss.png) show the failure-feedback problem. The end screen reports shots, damage and **zero losses**, but not that the ruler died. It offers Continue and Back to title, with no killing-shot account or direct rematch. The generic enemy-fire notice is not a directional threat cue. This replay's browser/headless final hash is exactly **1010707863**. Its [manifest](../tests/evidence/critique-v2/shots/loss-manifest.json) records the actual `ruler` elimination reason.

AI/menu replay durations and gameplay stats agree with headless runs, but their full hashes are not compared as identical: menu slot colours differ from the sweep, and the local slot's inert AI-level metadata differs from `tb1Slots(2)`. These fields participate in the hash. The exact-hash early-loss replay uses matching URL/default slot metadata. An initial capture that accidentally selected the first registered generated map is quarantined under `shots/pilot-wrong-map/` and is not scored.

No stranger study, audio listening test or continuous-video timing study was performed. C9 completion without help, C10 comprehension, C11 prediction of unfamiliar rules, A2/A4 workload, B8 felt recovery and the perceptual parts of D13/D14/F22 cannot be certified from screenshots and scripts alone.

## 5. Full independent scorecard

Scores are **v2 (v1)**. One line of evidence per criterion; filenames refer to the evidence directory above.

| # | Criterion | Score | One-line justification |
|---|---|---:|---|
| 1 | Shot-cycle clarity | 3 (3) | D,S: `match1-fire-prompt.png` labels charge/metres and `match1-impact.png` shows the landing region; correction still requires guessing an offset. |
| 2 | Decision density | 3 (2) | H,U: 629 reloads expose 3.21/3.54/3.67 local types; actual non-aim variety is 0.83/0.94/0.97, with human salience untested. |
| 3 | Interesting trade-offs | 3 (2) | D,H: a cannon is unaffordable in 17.65% of forest side-seconds; strategy wins range 0–70%, with no uniquely dominant plan established. |
| 4 | Role load balance | 2 (2) | H,U: fire-only wins 6/10, turtle 6/10, rebuild/hide 7/10; the novice does not exercise commander choices and human three-role workload remains untested. |
| 5 | Match shape | 3 (2) | H,D: 32/40 losing palaces still have >3-minute spans under 2pp movement, maximum 460 s; the late defeat-line change is not surfaced. |
| 6 | Length and variance | 2 (4) | H,U: forest AI 5 is 40/40 in range, but the level matrix is 44/60 and the legal AI 5 novice only 2/10, with a 46 s ruler loss; human pacing remains untested. |
| 7 | Comeback vs snowball | 4 (2) | H: forest physical wins are 16/24 and first-gun comebacks 6/8, but that is only 3/4 independent worlds and is not a first-hit win-rate study. |
| 8 | Quiet beats | 3 (3) | H,S,U: 45.6 repairs/side occur, but `ai-m05.png` and `match1-m05.png` hide most own masonry; perceived recoverable calm is untested. |
| 9 | First-match onboarding | 3 (2) | D,S,U: E/fire prompts and auto-crew work; full setup also offers unarmed profile-0 starts, and no unbriefed person has completed the test. |
| 10 | Signalling over text | 3 (3) | D,S,U: the two reticle prompts are clear, but building is not demonstrated in the gun-centric timeline and idle-gun causes are not shown. |
| 11 | Rule consistency | 3 (3) | D,S,U: charge units and paid rules are consistent; changing palace defeat thresholds and repair/fear exceptions remain hidden from prediction. |
| 12 | Complexity ramp | 4 (2) | D,S: cannon/stone first; R2, G3, F4, Q/X5, full arsenal by 10; `match1-man-prompt.png` confirms the small surface, but map compatibility is incomplete. |
| 13 | Impact/distance readability | 3 (3) | S,U: `match1-impact.png` is readable; `match1-distant-hit.png` and the seed 6 hill view do not reveal detailed damage; audio comprehension was not tested. |
| 14 | Threat telegraphing | 2 (2) | D,H,S,U: the 0:46 ruler loss has generic fire messaging but no directional/intent account or killing trajectory; actual warning comprehension is untested. |
| 15 | NPC legibility | 2 (2) | D,S: the console shows Cannon (100%) without a crew/ammo/path explanation; exception icons exist but do not explain the measured long gun stalls. |
| 16 | HUD and alert hygiene | 4 (3) | D,S: one early walking minimap, fewer controls, charge/income labels and four message rows are visible; generic notices and absent crisis state prevent a 5. |
| 17 | Economy scarcity | 3 (1) | H: forest cap 0%, minimum 170.84 g and below-cannon funds 17.65%; near-zero only 0.00984%, while inactive biome castles still accumulate gold. |
| 18 | Repair vs rebuild loop | 3 (3) | D,H,S,U: paid 12 s repairs and one completed novice replacement work; visible reward and a compelling rebuild/repair choice are not established by the gun-facing views. |
| 19 | Morale design | 2 (2) | D,H,S: named bands/reasons exist, but forest minimum 44.59 never reaches the sub-40 work band, flee/desert or morale surrender; guards suppress the crisis. |
| 20 | Win-path variety | 1 (2) | H: 40/40 focal AI endings and 19/19 novice wins are palace; the full 150 AI records contain 124 palace, 2 ruler, 0 surrender and 24 censored matches. |
| 21 | AI as opponent | 2 (2) | D,H: forest AI 5 recovers, but AI 3 has 707.5 s ready silence, two offered west castles never fire, and ice times out 8/10. |
| 22 | Fair failure and replay | 2 (2) | D,S,U: `novice-L5-seed6-loss.png` omits the recorded ruler cause, offers no killing-shot account or direct rematch; perceived fairness is untested. |

Subscores: **A 11/20, B 12/20, C 13/20, D 11/20, E 9/20, F 4/10 = 60/110**. No A/D/F criterion is assigned 1; E20 is 1. The unarmed-start defect remains a functional blocker even though an aggregate rubric does not express every contextual failure.

Against research/17's provisional subset, this is **33/60 versus 40/60**. Differences: A4 **3→2** (role balance was unmeasured), B5 **4→3** (the original stricter stall test), B6 **5→2** (cross-level and player-policy pacing), E18 **4→3** (working paid repair is not evidence of visible reward), F21 **3→2** (low-level and biome failures). A1/A2/A3/B7/B8/E17/E19 retain its provisional scores. E20's regression to 1 is confirmed. Against research/18, C10 stays 3 rather than its provisional 4: visible E/fire prompts do not establish in-world explanation of the remaining verbs. Its C9=3, C11=3, C12=4 and D16=4 are supported, subject to the human limits above.

The three strongest results are the exact forest reproduction, the visibly reduced opening interface, and removal of treasury saturation during active forest play. The three largest unresolved areas are failure attribution, opponent/start reliability outside the focal cohort, and offensive ending variety. Reload alternatives exist mechanically; their presentation and necessity still need human testing.

## 6. Strategy screen and ending viability

All strategy rows use seeds 1–10 against AI 5 from physical west. They share a windless geometric initial aim for the expert variants; this is **not** the novice aiming policy. The variants are command-level stress tests with generous administrative reach, so a positive result is a candidate for manual-play validation, not proof of an exploit. Fire-only and covered hiding do not use remote repair/build administration. One seed changes the observed win rate by 10 percentage points.

| Policy | Wins | Strictly >60%? | Median length, min | Censored | Weapon orders / completed new guns |
|---|---:|---|---:|---:|---:|
| Turtle and repair | 6/10 | No | 7.17 | 0 | 1 / 1 |
| Buy nothing and fire | 6/10 | No | 8.76 | 0 | 0 / 0 |
| Ballista spam | 0/10 | No | 20.00 | 6 | 21 / 19 |
| Rebuild the killing lane | 7/10 | Yes | 8.56 | 0 | 1 / 1 |
| Paid recovery mounts | 7/10 | Yes | 11.39 | 0 | 17 / 15 |
| Covered ruler / auto-fire | 7/10 | Yes | 9.52 | 0 | 0 / 0 |

Turtle prioritizes up to four damaged blocks every three seconds and restores missing blueprint cells. Fire-only orders the starting cannon once, learns and fires, with no manual repair/build purchases; normal automatic workers remain active. Ballista spam buys toward the four-gun cap and aims its ballistas at enemy crews, preferring exposed crew; it does not merely point every ballista at the palace. Rebuild-lane restores the missing east/keep-facing blueprint region under incoming fire. Recovery-mounts pays for spare mount/support cells and attempts a third cannon, then replaces losses.

Covered hiding fires four ranging shots, delegates the last aim through normal auto-fire, walks down the actual stairs and through the keep door into the authored west shelter room, and stops making corrections. **9/10** rulers reach that room; one dies before retreat. It still loses three rulers overall, so cover is not invulnerability. The earlier courtyard-only retreat won 5/10 and is retained as an explicitly different control, not counted as hiding. None of these policies edits health, gold, crew, positions or simulation rules.

Three policies clear the requested >60% screen at **7/10**: rebuild-lane, recovery-mounts, and covered hiding. Each is just one win above the fire-only control's 6/10. No free-money loop or statistically established dominant strategy was demonstrated. Ballista spam is a strong negative result for this particular policy: **0/10 wins, six censored matches**, despite 21 weapon reservations and 19 completions. Better aim/target policies remain possible; this is not an exhaustive balance proof.

For the focal level-5 cohort, ruler eligibility was sampled using the AI's own straight voxel line-of-sight gate from every live enemy gun, once per second. Result: **0 exposed seconds in 68,316 sampled side-seconds; 0/80 sides ever sampled exposed; every ruler stays at 100 HP even under per-tick HP observation**. This is an AI eligibility measurement, not proof of continuous sub-second or arcing-shot safety. In addition, `controller.js` forces palace/shield targets after 120 s and `targets.js` filters out rulers in breach mode. Merely increasing a ruler target weight cannot bypass either barrier.

Morale minima: **44.59** across all sides; **45.54** for eventual losers; median loser minimum **56.76**. None goes below 40. The surrender rule needs **M≤10 for 45 s**, at least 34.59 points below the observed global minimum. The separate population surrender condition is **population <10** out of 40; the observed minimum is exactly 10, so it never triggers either. That is how all 40 focal endings remain palace despite damage, deaths and morale-band messages.

There is also a structural timing barrier in `src/npc/morale.js`: fast morale is floored at 8, baseline starts at 70 and can fall at only 0.05 points/s, and displayed morale is `0.7*fast + 0.3*baseline`. Even granting an immediate fast-morale collapse to 8, reaching M=10 requires baseline≤14.67, or at least **1106.67s (18:27)**. Adding the 45s surrender hold gives an optimistic lower bound of **1151.67s (19:12)**, later than every focal forest finish (latest 16:53). Relaxation, hits and rally can only delay this bound. The palace-low morale drain also begins below 50% integrity, while the late palace defeat line rises to 55%, further shortening its opportunity. Population surrender is a separate condition and is not subject to that morale-clock bound.

The smallest tested joint intervention changes **two existing numbers**: `ai.rulerDangerM: 10→4` and `rules.surrenderPopFrac: 0.25→0.35`. Income 3 g/s, stone 4 g, tower 8 g, repair 12 s, palace 80 HP, and the 30→55% cracking ramp remain unchanged. These are experimental candidates, not applied repairs.

| In-memory experiment, ten independent seeds | Palace / ruler / surrender | Earliest ending | In 12–20 min | First-gun comebacks |
|---|---:|---:|---:|---:|
| Retreat radius 4 m only | 7 / 3 / 0 | 7:34 | 7/10 | 1/3 |
| Retreat disabled, radius 0 m | 0 / 10 / 0 | 7:22 | 6/10 | 1/3 |
| Radius 4 m + population surrender below 35% | 5 / 3 / 2 | 7:34 | 7/10 | 2/3 |

[Radius experiment](../tests/evidence/critique-v2/ruler-tuning.json); [joint experiment](../tests/evidence/critique-v2/joint-tuning.json). The joint candidate produces **30% ruler and 20% surrender endings**, with no 50 s AI-only blowout. It also misses the 80% pacing gate in this ten-seed sample. It therefore needs a larger paired replication and further pacing adjustment before being called a repair. Disabling retreat replaces one monoculture with another. Ruler endings under breach-only targeting are not proof of an intentional sniping strategy; target eligibility/intent still needs review.

The population change makes the trigger **<14 survivors**. Replaying only that terminal condition over the 20 baseline trajectories qualifies **2/20 worlds (10%)**, first at about 746 s and 968 s. If surrender must specifically be morale-driven, the smallest tested integer threshold yielding any 45 s qualification is **55**: **3/20 worlds (15%)**, earliest 743 s; 54 yields 0 and 56 yields 6/20, earliest 488 s. The morale calculation requires 46 consecutive one-second samples, spanning 45 seconds; crossing time remains approximate at this sampling resolution. These are first-ending counterfactuals, not a joint simulation with the ruler change. A threshold 55 surrender would occur while the current work-band display still calls a castle Steady, so changing the number without matching cause/band feedback would worsen C11/E19.

## 7. Ranked repairs and Beads issues

All eight items are children of **castle-game-uo7**, created with `bd create --parent`; ordinary blocking dependencies were not substituted for parent-child links. Expected points are conditional reviewer estimates. C9 overlaps between items 1 and 6 and must not be counted twice. Source paths below belong to future repair lanes; they were not edited by this critique.

1. **Ensure every offered first-match start can fire — `castle-game-uo7.16` (P1, bug).** Moves C9, **+1**. **Sim/content:** `src/plugins/maps/desert-duel.sim.js`, `src/plugins/maps/volcano-duel.sim.js`, generated `orig-19.sim.js`/`orig-67.sim.js`, and their generator `scripts/rip/castles_to_defs.py` as appropriate. **Player:** `src/progression.js`/setup eligibility only if needed. Acceptance: profile 0 on all four duel maps reaches a paid shot through real E/Space controls within 90 s on a scripted route, with a reachable armed loadout and G still hidden. Prefer a playable starter cannon to another opening binding.
2. **Telegraph danger and explain the decisive loss — `castle-game-uo7.9` (P1, bug).** D14 **2→4**, F22 **2→4**, **+4**. **UI/render:** `src/main.js`, `src/ui/hud.js`, `src/ui/flow.js`, `src/ui/menu-draw.js`, `src/ui/i18n.js`, `src/audio/sfx.js`, `src/render/fx.js`. **Player:** `src/player/feel.js`. Acceptance: the AI 5 seed 6 replay gets a directional warning before impact and an accurate ruler-death account with time/source; every novice defeat has one causal sentence, a short decisive-event account, and one-action retry preserving setup. Check warning comprehension with people.
3. **Recover firing and pacing across levels/maps — `castle-game-uo7.12` (P1, task).** B6 **2→4**, F21 **2→3**, **+3**. **Sim/npc/ai/tuning:** `src/ai/controller.js`, `targets.js`, `build.js`, `src/npc/brain.js`, `jobs.js`, `src/tuning.js`; coordinate `castle-game-er7` and item 1. Acceptance: rerun the 60-match matrix, both physical assignments of unequal levels, and ten independent seeds per biome. Each castle fires within 90 s; no unexplained actual gap >120 s or ready gap >90 s. Report crew/ammo/mount causes even if readiness never occurs. Timeouts <10%; at least 80% of default-AI/player/map matches in 12–20 min without early ruler blowouts.
4. **Restore distinct, legible endings — `castle-game-uo7.11` (P1, task).** E20 **1→3**, E19 **2→3**, **+3**. **Sim/npc/ai/tuning:** `src/ai/controller.js`, `targets.js`, `src/npc/morale.js`, `src/sim/rules.js`, `src/tuning.js`. **UI/render:** `src/main.js`, `src/ui/overlay.js`, `i18n.js`. Acceptance: at least 20 independent seeds × two orders at AI 5; ruler and surrender each 10–30%, paired with pacing and comeback gates. Explain pressure/rally/surrender causes on screen and demonstrate an intentional ruler opportunity, not just collateral endings. Use section 6's two-number candidate as a starting experiment, with its measured pacing failure retained.
5. **Make existing reload alternatives visible and consequential — `castle-game-uo7.10` (P1, task).** A2 **3→4**, A4 **2→3**, E18 **3→4**, **+3**. **UI/render:** `src/main.js`, `src/ui/hud.js`, `overlay.js`. **Player:** `src/player/interact.js`, `src/progression.js`. **Sim/npc/tuning:** `src/npc/jobs.js`, `src/tuning.js` only if policy ablation shows priorities lack consequences. Acceptance: preserve at least two local non-aim alternatives after damage; in three human five-reload sessions, two people identify repair, build/replacement and safety without external instruction, choose two distinct non-aim intervention types across the session, and explain their cost/exposure consequence. Show repair progress. Do not manufacture chores or award repeated R spam.
6. **Teach triage and diagnose stalled guns — `castle-game-uo7.13` (P2, task).** C9/C10/D15, **up to +3**, overlapping item 1's C9. **UI/render:** `src/main.js`, `src/ui/hud.js`, `overlay.js`, `i18n.js`. **Player:** `src/player/interact.js`, `src/progression.js`. Acceptance: the reticle distinguishes missing crew, ammunition, funds and obstruction; first damage suggests one reachable action. Three unbriefed newcomers: two finish, first enemy hit <4 min, and all can explain a deliberately stalled gun. The orchestrator already closed `castle-game-me0` for browser/golden acceptance; this item adds human discovery and stall diagnosis without reopening that work.
7. **Show the changing palace defeat line — `castle-game-uo7.14` (P2, task).** B5/C11, **+2**. **UI/render:** `src/main.js`, `src/ui/hud.js`, `console.js`, `i18n.js`; **player:** no new key. Acceptance: 1024×768 captures at 9:59, 10:01, 12:30, 15:01 expose integrity and the actual defeat line, with one bounded notice. A player can state how near the keep is to defeat. Recheck the <2pp/three-minute stall metric rather than only any-damage/five-minute gaps.
8. **Make impact feedback a usable aiming instrument — `castle-game-uo7.15` (P2, task).** A1/D13, **+2**. **UI/render:** `src/main.js`, `src/ui/hud.js`, `minimap.js`, `src/render/fx.js`. **Player:** `src/player/camera.js`, `feel.js`; coordinate authored sights with `castle-game-hoq`. Acceptance: actual 190 m shots and 1024×768 captures let a viewer distinguish short/long and left/right within 2 s of impact, identify a wall hit versus palace damage, retain the previous reference, and converge within four calm-wind shots across ten seeds without a solver in the player policy or another match-1 binding.

A conditional route from 60 to 70 is items 2 (+4), 3 (+3) and 4 (+3), with item 1's playable-loadout prerequisite also completed. This is not an instruction to ignore the other rows or to award points before the evidence exists. [Issue descriptions and IDs](../tests/evidence/critique-v2/issues.json).

## 8. Verification and handoff

`npm test`: **456 passed, 0 failed, 0 skipped**. Production build passed. The sweep helper's **three tests pass**; the probe checks pass **two tests**, including deterministic match-1 replay and a real repair sequence that requires leaving the gun, a damaged visible target within 24 m, and zero remote manual shots. Matrix assembly asserts all 60 unique jobs. SwiftShader timeline, prompt and early-loss capture scripts report no page errors. [Unit log](../tests/evidence/critique-v2/unit.log), [build](../tests/evidence/critique-v2/build.log), [sweep checks](../tests/evidence/critique-v2/sweep-tests.log), [probe checks](../tests/evidence/critique-v2/probe-tests.log).

Existing golden baselines were not replaced. This review does not certify audio, realtime responsiveness under uncontended hardware, an unbriefed-human onboarding result, first-hit snowball rates, or the exact cause of ice's armed-but-idle battery. Those limits are distinct from the measurements above. The Beads repairs, rather than undocumented follow-ups, own the remaining work. `castle-game-mhl` is completed by this report; `HANDOFF.md` records the evidence and next step.
