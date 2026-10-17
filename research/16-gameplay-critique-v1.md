# 16 - Gameplay critique v1 (game-design critic, 2026-10-17)

Method: read DESIGN, tuning, sim/npc/ai/player/ui code, research 06/07/09/10/11/15; viewed goldens and frames
of tb2.webm and tb3.webm; ran one headless AI-vs-AI level-5 duel (forest-duel, seed 1, minute-by-minute,
script `/tmp/claude-1000/run.mjs`, ~11 wall-minutes per match) and used the 3 seeds in
`tests/evidence/tb2-pacing-results.json`. Rubric: research/15 section 7 (22 criteria, max 110). Design target
from Tobias: **"a balance between easy pick-up-and-play and not too encyclopaedic and daunting"**; match length
design range 12-20 min (DESIGN 3.8), 12-16 observed.

Caveats. n is tiny (1 detailed run, 3 summary runs). No human played; the "player view" is inferred from code
and frames. The per-slot event attribution in my log is partial (block-destroyed/built payloads lack a clean
slot field); shots, hits, palace, gold, pop, morale, weapons are read from sim state and are reliable.

---

## 1. The loop as it actually is

### 1.1 30 s loop (shot cycle)
Read wind on compass hub (m/s number, red arrow, blue previous) -> walk to a wall cannon, press E -> weapon
view -> turn dial (azimuth tenths of a degree; "range" is really a charge 1-255, no metre scale, correct to
the original but there is no reference for it) -> Space -> watch -> hold End for impact view -> correct.
Reload 22 s at full crew (3 for cannon). Per DESIGN 3.5 and `crew.js`, `reload += dt / reloadMultiplier`, so the
ruler alone is slow; the AI measured 41 shots in 1004 s from 2 cannons = one shot per gun per ~49 s, i.e.
guns idle about 55% of the time even for the AI (crew travel/draft, 3 s fire delay, retarget).
What is good: the instrument is honest (impact view, wind, scatter), the golden frames read well, the
first-person rampart with the brass console is atmospheric. What is missing: no miss readout ("12 m long,
4 m right"), no incoming-fire cue (grep: no warning in hud.js; only a morale-band bell in sfx.js), so the
30 s loop is "aim, wait ~22 s doing nothing", exactly the dead window research/15 principle 2 warns about.

### 1.2 5 min loop
Intended: shoot, get hit, designate repairs, manage crew, shelter. Actual (headless): repair is automatic
(jobs fire when block hp < 50%, 150-300 job-done events per castle), gold is at cap, nothing needs the
ruler. The player's 5-minute loop collapses to the 30 s loop plus optional hobby building.

### 1.3 Match arc: headless table (seed 1, level 5 general vs general, slot 0 left, slot 1 right)

| min | shots s0/s1 | palace s0/s1 | gold s0/s1 | pop s0/s1 | morale s0/s1 | guns s0/s1 | notes |
|---|---|---|---|---|---|---|---|
| 0 | 0/0 | 1.00/1.00 | 1500/1500 | 40/40 | 70/70 | 2/2 | 
| 1 | 2/2 | 1.00/1.00 | 1708/1602 | 40/40 | 73/70 | 2/2 | first volleys on walls |
| 2 | 5/5 | 1.00/1.00 | 1663/1622 | 40/40 | 76/76 | 2/2 | |
| 3 | 7/7 | 0.94/1.00 | 1792/1824 | 40/37 | 75/72 | 2/2 | first palace scratch |
| 4 | 10/9 | 0.94/1.00 | 1825/1198 | 40/27 | 78/64 | 2/1 | **first blood: s1 loses a gun and 13 NPCs** |
| 5 | 12/10 | 0.94/1.00 | **2000**/1373 | 40/27 | 79/68 | 2/2 | s1 replaced gun (-600 g) |
| 7 | 17/15 | 0.94/1.00 | 1913/1665 | 35/21 | 79/66 | 2/2 | |
| 9 | 21/19 | 0.94/1.00 | 2000/1998 | 34/19 | 82/65 | 2/2 | both at cap |
| 10 | 24/20 | 0.94/1.00 | 1959/2000 | 34/16 | 87/62 | 2/1 | s1 loses 2nd gun |
| 12 | 29/**20** | 0.94/1.00 | 1959/2000 | 34/16 | 92/58 | 2/1 | **s1 stops shooting** |
| 14 | 34/20 | 0.94/0.73 | 1959/2000 | 34/13 | 99/48 | 2/1 | palace finally moves |
| 16 | 39/20 | 0.94/0.72 | 1959/2000 | 34/11 | 100/46 | 2/1 | |
| 16.7 | 41/20 | 0.94/0.12 | 1932/2000 | 34/11 | 100/42 | 2/1 | **palace 0.72 -> 0.12 in one minute: end** |

Summary: 1004 s, winner slot 0 by palace (the 3 recorded seeds: 909 s surrender, 756 s palace, 944 s
surrender; slot 0 won 4/4). Direct hits 39/41 and 18/20 (any block counts, so this says "walls get hit",
not "aim is good"). Damage dp 17.9k / 9.0k, almost all on walls. s0 spent 3690 g on shots, s1 1800 g plus
600 g gun replacement; both sit at or near the 2000 g cap for most of the match (s0 cap from min 5, s1 from min 9
to the end = about 85% / 45% of the match at cap, rubric criterion 17 anchor 1 is >30%).

### 1.4 What a human does and sees
- Minute 1: spawn on the palace terrace, no prompt (frame tb2 t=12 s: HUD shows 1500 g, 40 (40), 2 (4) guns,
  a 70% box, two minimaps, a ring of 12 empty rivet buttons at the right edge, German labels). Walks to the
  rampart, finds the cannon, presses E. Learns: aim, fire. Does not learn: crew order (Q), because nothing
  says the gun is idle for lack of crew.
- Minute 3: first enemy shell hits a wall; the player may not notice (no incoming cue); a block shows damage
  state 1-3. Masons repair by themselves. Player decides: shoot again. One decision per ~25 s, all the same.
- Minute 8: nothing changed. Palace 0.94 vs 1.00, gold 2000 (cannot spend: stone is 1 g a block), morale
  high and unremarkable. Decision count 1/min effective.
- Minute 14: either the AI's palace suddenly collapses (win in about 90 s) or, in the mirror case, ours does with
  no warning: palace 0.73 -> 0.12 inside a minute with no escalation before it.
The "building" fantasy (block-by-block designation, green ghost in tb3-6) is delightful to see but nothing
punishes not doing it.

---

## 2. Scorecard (research/15 rubric, evidence tags V/D/H)

| # | Criterion | Score | One-line justification |
|---|---|---|---|
| 1 | Shot-cycle clarity | 3 | Impact view and wind are there (V,D); no miss vector, range dial has no metre reference. |
| 2 | Decision density | 2 | About 1 effective decision/min, nearly all aim; repair/gold need no input (H). |
| 3 | Interesting trade-offs | 2 | Gold unconstraining (cap 85%), stone 1 g; no sink competes with another (H,D). |
| 4 | Role load balance | 2 | Gunner role dominates; foreman is automatic, commander has no clock (H). |
| 5 | Match shape | 2 | Palace 0.94 flat min 3-13 then cliff to 0.12; dead middle about 9 min (H). |
| 6 | Length and variance | 4 | 756/909/944/1004 s all inside 12-20; low variance, narrow outcome spread (H). |
| 7 | Comeback vs snowball | 2 | Side that lost gun+13 NPCs at min 4 never recovered; slot 0 won 4/4 (H). |
| 8 | Quiet beats | 3 | Masons visibly repair but the whole match is "quiet"; no crisis to recover from (H,V). |
| 9 | First-match onboarding | 2 | No prompts, about 20 bindings; crew (Q) and designate undiscoverable (D,V). |
| 10 | Signalling over text | 3 | Green ghost, cost label at reticle good (V); order keys have no in-world cue. |
| 11 | Rule consistency | 3 | Rules are uniform for AI/player; but 5 m dial claim in DESIGN vs charge in tuning, hidden fear gate, hidden draft. |
| 12 | Complexity ramp | 2 | All 10 weapons, 13 blocks, morale and 6 order keys exist from match 1; no staging (D). |
| 13 | Impact/distance readability | 3 | Goldens read; damage states exist; no dust/trail evidence at 190 m (V). |
| 14 | Threat telegraphing | 2 | No incoming cue, no hit-direction, no replay of the killing shot (D). |
| 15 | NPC legibility | 2 | Role tint only; no exception icon, cannot tell why a gun idles (V,D). |
| 16 | HUD and alert hygiene | 3 | Message cap 4/10 s is right; but 12 dead rivet buttons, two minimaps, % box add noise. |
| 17 | Economy scarcity | 1 | Gold at cap 45-85% of the match; nothing unaffordable (H). |
| 18 | Repair vs rebuild loop | 3 | Works and is visible; repair out-paces damage about 3x so it is a treadmill the player never feels. |
| 19 | Morale design | 2 | Reaches 100 (winner) or sags to 42 (loser) without a single flee/desert event surfacing; no reasons/tiers shown beyond a % and a pennant. |
| 20 | Win-path variety | 2 | Palace and surrender occur (4 runs: 2 and 2); ruler kill never. |
| 21 | AI as opponent | 2 | Losing AI stops firing for 6+ min with 2000 g and 1 gun (H); never builds anything new, never hunts the ruler. |
| 22 | Fair failure and replay | 2 | Stats screen only (EN pp.34-35); no replay, loss cliff unexplained. |

Totals: A 9/20, B 11/20, C 10/20, D 10/20, E 8/20, F 4/10. **Total 52/110: "loop does not yet hold"
(<65).** No single A/D/F criterion is at 1, but criterion 17 (E) is at 1 and it is the cheapest fix with the
largest effect. Strengths: (1) atmosphere and first-person castle fantasy, (2) match length is in range and
deterministic, (3) uniform rules for AI and human, visible designations.

Against Tobias's target (pick-up-and-play but not encyclopaedic), criteria 9-12 total 10/20: the game is
**simultaneously too shallow in play (nothing to decide) and too wide in surface (everything exposed)**. That is
the worst combination: the first minutes feel daunting (many verbs, no prompts) while the 14th minute feels
empty.

---

## 3. The 10 biggest problems, ranked by impact on fun

Size: S under a day, M a few days, L a week or more.

**P1. Gold is meaningless (cap 45-85% of the match).** Evidence: s0 at 2000 from minute 5; income 6 g/s +
0.25 g per working civilian vs shot spend 3.7 g/s; stone costs 1 g (tuning `blocks.stone.cost`), a 90-block wall
about 100 g, start 1500. Principle: Meier interesting decisions, Schell lens of economy/scarcity; rubric 17.
Repair (S): `economy.palaceIncomeS` 6 -> 3, `civilianIncomeS` 0.25 -> 0.1 (about 4-5 g/s total), `blocks.stone.cost`
1 -> 4, `mount` 1 -> 6, `tower` 2 -> 8, `economy.repairCostFrac` 0.5 -> 0.8; keep goldCap 2000. Target: gold
within 20% of cap <15% of the match, near zero 10-25%. Retune once with a 3-seed headless pass.

**P2. Dead middle then cliff (no escalation).** Evidence: palace 0.94/1.00 for minutes 3-13, then 0.72 -> 0.12
in under 60 s; repair capacity (6 masons, 8 s/block = 0.75 block/s) is about 3x the damage rate (5.4 blocks per
24 s = 0.22 block/s). Principle: tension curve, Rampart's cycles. Repair (M): (a) `npc.repairFullS` 8 -> 12 and the P1
cost change so repair competes with shooting; (b) AI "breach" behaviour: general/daredevil concentrate
4+ consecutive shots on one wall column that shields the palace (targets.js already tracks `shieldWall`;
add stickiness so retarget only when destroyed or `retargetS` 60 -> 120); (c) a visible "pressure clock": at
minute 10 palace `destroyedBelow` 0.30 -> 0.45 over 5 min, announced as "the keep is cracking" (S, tuning plus
message). Target: palace integrity falls on a monotone staircase, three distinct tension spikes per match.

**P3. First-blood snowball and slot asymmetry.** Evidence: s1 lost a gun and 13 NPCs at min 4 (pop 40 -> 27),
morale 64 vs 78, and never recovered; slot 0 won 4/4 seeds. Principle: Juul on fair failure; rubric 7.
Repair (M): first, a symmetry test: 20 seeds, swap slots, require 40-60% win rate each (likely a plot/terrain or
think-schedule stagger bias, `(tick + slot*5) % 15`); second, a comeback mechanic: the existing rally (+15 on
first damaging hit when M < 30) never fires because M stays 42+; raise `morale.rallyBelow` 30 -> 50 and add
"levy": when pop < 70% of start, civilians draft to crew at 5 s instead of 10 s. Target: first-blood side wins
55-75%.

**P4. Losing AI goes inert.** Evidence: s1 shots frozen at 20 from minute 10 to the end (6.7 min) with 2000 g, 1
live gun, 11-16 people. Principle: rubric 21, Stronghold's "AI as turret". Repair (S-M): log why: probably
crew < ceil(0.6 N)=2 after deaths, or weapon replacement blocked by `weaponCap`/mount spots (`planWeaponReplacement`
only restores the initial blueprint list). Fix: AI order crew every think, draft priority to crew, replace a lost
gun within 30 s when gold >= cost, allow it to buy a 3rd weapon by `weaponCap`. Pass if no castle with a live gun,
gold >= fire cost and 3 live crew goes 90 s without firing.

**P5. No onboarding; everything exposed at once.** Evidence: 10 weapons placeable (G), 13 block types, 7 order keys
(E Q R B G X F plus Home/PgUp/PgDn/digits), morale percent box, two minimaps, German text; tb2 12 s frame has no
prompt. Principle: Koster (a new learner needs one pattern at a time), research/15 3.3; Tobias's target. Repair
(M): the staging plan in section 5 (surface only cannon + stone in match 1; unlock via a local profile, not by
locking rules); contextual first-time reticle prompts (S): "E - man the gun" at 3 m of a gun, "Q - crew" the
first time a manned gun has no crew, "click - build" the first time damage is seen.

**P6. Reload window is dead time; foreman role invisible.** Evidence: 22 s reload; repairs automatic; cost
negligible. Principle: research/15 principle 2, MDA (mechanics produce idle dynamics). Repair (M): make
damage create player-priority work: `R` priority repair gives +50% mason speed and +0 cost to the palace walls,
automatic repair only above 50% hp at the baseline rate (already) but at `repairFullS` 12; add a crack notice
"Wall west cracked (3 blocks)" tied to the reticle direction. Target: at least 2 non-aim decisions per reload
(measure by command count in a scripted-human run).

**P7. No telegraphing, attribution or debrief.** Evidence: no incoming-fire cue in hud.js/sfx.js; loss cliff
0.72 -> 0.12 unexplained; stats only. Principle: Juul, Into the Breach. Repair (S for cue, M for debrief): whistle
sound plus a compass tick showing the bearing of the incoming shell (needs `EV.SHOT_FIRED` of the enemy, which
the sim already emits); on the end screen add "killing shot" replay of the last 6 s from the impact camera and
a timeline of palace integrity. Target: every defeat shows its cause in one sentence.

**P8. NPC states unreadable.** Evidence: people are role-tinted instances only (render notes). Principle: legible
systems (research/15 4.4). Repair (M): above-head icon only when an NPC is blocked/fleeing/idle-for-cause (no
crew, no ammo, path blocked), tint desaturates under fear; the reticle on a gun lists "needs 2 crew / 1 load".
Target: every idle gun is explained at the reticle.

**P9. Morale is a number with no story.** Evidence: s0 morale 100 for 3 minutes (no consequence), s1 42-48
(no flee/desert event ever surfaced, `workSpeed` bands barely reached); research/15 5.4. Principle: RimWorld
mood needs reasons and tiers. Repair (S-M): three bands named (Steadfast/Wavering/Breaking) with the pennant
only (hide the percent for match 1-3, section 5), one-line reason when the band changes ("Crew lost - morale
falling"), and make the bands matter earlier: `workSpeed` 1.1 at >= 70 and 0.8 below 50 (was 40-70 -> 1.0,
20-40 -> 0.8). Target: the loser shows at least one flee or reload penalty before surrender in 80% of runs.

**P10. Win-path monoculture.** Evidence: 4 runs: palace 2, surrender 2, ruler 0; AI never targets the visible
ruler unless line of sight (targets.js); the human ruler on the terrace is unreachable. Repair (S): add a ruler
target value (targets `ruler` 10 for daredevil, `tacticWeight`), give the ruler a tower overlook option the
player can use to snipe, and add an AI ruler position variation (patrols between palace and rampart at low
level, hides in the keep on shelter). Target: ruler kills in 10-20% of runs, none of the three paths above 60%.

---

## 4. Dominant strategies and degenerate cases

- **Is building pointless?** Mostly yes. Because repair is automatic and gold is capped, designating new
  walls has no cost or benefit pressure; AI built 14 blocks total while repairing 150-300 jobs. Its worth appears
  only if P1/P2 land: then a second wall course or a moat-like magazine placement is a real investment.
  Add one meaningful design verb: "shield wall" blocks in front of the palace (the AI already values them as
  targets), cost 8 g each.
- **Is manning the gun yourself always best?** Cannot be shown without a human, but the design says ruler alone
  = 66 s reload vs 22 s with crew, so the right play is: order crew, then aim the guns yourself (aim is the only
  skill input). That is fine, but it makes Q mandatory and unexplained (P5). Auto-fire (F) means the human
  can leave the gun entirely, which is dominant if the AI-level aim is better than the human's; keep sigma
  floors from tuning (`sMinRangeCoef`) and let auto-fire reuse the last aim, not re-solve.
- **Does morale ever matter?** Not in the measured run: morale above 40 the whole time, desertion/flee gates
  (M < 15 / thresholds 10-35) never reached, surrender came from palace or population, not morale. It matters
  only as a lagging indicator. Repair: P9.
- **Can the AI be ignored?** Yes for 12 minutes: AI shots land on walls (95% any-block hit rate) and the palace
  moved 6% in minutes 3-13. A passive human who never fires loses only by the end cliff. Repair: P2(b) plus the
  AI pressure on the palace (breach focus) and the P10 ruler target.
- **Turtle exploit:** high wall + rebuilding with capped gold is unbreakable at 3x repair capacity. Fixed by
  P1/P2.
- **First-blood lock:** P3.
- **Spam of cheap guns:** weapon cap 4 limits it; ballista (400 g, 22 g shot) could dominate crew kills; keep
  ballista out of the unlock tier 1-2 until playtested.

---

## 5. Incremental discovery plan (3 matches, no tutorial) and complexity ramp

Principle: do not lock rules; **choose what the first screen surfaces**. Persist a tiny local profile (wins,
matches, features seen) in `localStorage`.

**Match 1 (vs level 2 AI, barn-door shooter).** Exposed: walk, E man the gun, aim with arrows/mouse, Space, hold
End for impact view, wind compass, gold, population. Loadout: the 2 existing cannons only. Build: only the
stone wall (`B`) and `R` repair at the reticle; no weapon placement (G) shown. Hidden: the morale percent (the
pennant colour stays), shelter X, auto-fire F, Q is replaced by "the first time you man a gun, your crew walks
up on their own" (auto-order on E; the player is never penalised for not knowing Q). Reticle prompts: "E man
the gun", then "Space fire", then the first time damage is seen: "click a cracked wall to repair it". A win by
palace or surrender is announced in plain words.
**Match 2 (level 3).** Surface Q ("crew faster") the first time a gun reloads slower than its base because crew <
N; surface incoming-shell bearing tick and the first morale note. Unlock catapult (lobbed) on the weapon list
once the player has fired 10 cannon shots; first G placement offered after a crack on the wall.
**Match 3 (level 4).** Surface the morale percent when M < 40 once, shelter X when a crew dies, F auto-fire after
the player has manually fired 15 shots. Unlock 2 more weapons (fat-freda, double-cannon).
**Matches 4-10.** Remaining weapons, block types (door, stairs, tower) one at a time, magazine logistics,
ruler snipe; AI tactics (worrier/general/daredevil) shown in the menu as personality names.
**Unlocks by match 10.** All 10 weapons, 9 block types, all keys. Never more than one new surfaced concept per
match; every unlock is a setting in the skirmish menu defaulted to "recommended", so a veteran can open all at
match 1. Keep the German original naming but add English subtitles.

Flagged as encyclopaedic now: 12 rivet "buttons" down the right edge (look interactive, are not), a 70% box with
no label, two minimaps, the 000/000 digit console with a charge value that has no unit, 10 weapon types and
13 block ids visible in build mode, 7 order keys, the fear gate, draft timer and magazine restock which are
invisible but affect play (rule consistency).

---

## 6. Proposed critic-repair loop protocol

Cadence: re-critique at every integration milestone (end of each TB/phase) and after any tuning batch that
touches economy, morale, AI or NPC jobs; plus a lightweight nightly headless run.

Artefacts per critique (all committed under `tests/evidence/critic/<date>/`):
1. `headless-stats.json`: 10 seeds x 2 slot orders x AI level 3, 5, 8 (60 matches, parallel); per match per minute: shots, hits, palace, gold, pop, morale, deaths, blocks lost/rebuilt, winner, reason, time-gold-at-cap fraction, longest no-fire interval per castle.
2. Three videos (tb1, tb2, tb3 style) plus one new 5-minute "scripted human" run that uses Q, designate and R.
3. Goldens (existing set) plus a new HUD golden of match 1, minute 1 and the first-damage frame.
4. This rubric, scored with evidence, in `research/NN-critique-vN.md`; unchanged criteria must cite fresh evidence.

Pass/fail thresholds (a criterion passes at >= 3 unless stated; the hard gates are automatic):

| Criterion | Metric | Pass |
|---|---|---|
| 6 length | share of runs in 12-20 min, variance | >= 80% in range, std dev >= 60 s |
| 7 snowball / symmetry | slot win rate over >= 40 matches; first-blood side win rate | 40-60%; 55-75% |
| 17 economy | fraction of match at >= 95% cap; fraction near zero | < 15%; 10-25% |
| 5 shape | palace integrity monotone steps; max 3-min window with < 2% change | none longer than 3 min |
| 20 win paths | share per path | each path < 60%, ruler >= 10% |
| 21 AI | longest no-fire interval with live gun, gold, crew | <= 90 s |
| 19 morale | runs where loser shows a flee, desert or reload penalty before surrender | >= 80% |
| 2/4 decisions | scripted-human command count outside aim, per reload | >= 2 |
| 9-12 onboarding | stranger test: 3 people, match 1, no help; time to first hit; times Q/designate used | 2 of 3 finish; first hit < 4 min |
| 12 ramp | surfaced concepts per match | <= 1 new per match |
| 14 telegraph | defeat with a one-sentence cause shown | 100% |
| Any A/D/F criterion at 1 | blocker | must be fixed before sign-off |
Target total after repair round 1: >= 70/110; round 2: >= 85.

Rule: repairs go through the same lane/test discipline in CLAUDE.md; each repair names the criterion and
metric it must move, and the next critique reports the delta, not just the score.

First change to make: **P1 plus the symmetry test (S)**: retune the economy so gold binds, because it unlocks
every other decision (building, repair priority, weapon replacement) and the cheapest honest probe of
the P3 asymmetry is the same 20-seed headless harness.
