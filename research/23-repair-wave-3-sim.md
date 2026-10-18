<!-- owns: wave-three simulation repairs, causal controls, acceptance results and bounded rubric judgments. -->
# 23 — Repair wave 3, simulation lane

2026-10-18. The original scored critique-v3 evidence remains untouched. No git command or Dolt push is part of this lane. Browser and human validation belong to the parallel UI lane.

## Method

Read contracts first, CLAUDE, DESIGN 5–8, scope decisions, the current handoff, research/22 sections 2/3/6/7, research/20 and research/15 sections 7–8. Beads `.23`, `.22`, `.25`, `.26` and `.27` track this work. All changes use normal deterministic simulation and command rules. No duration floor, invulnerability, new control, free construction or economy override is introduced.

Failing tests precede terminal events, interrupted-repair gun memory, surviving-battery navigation, the cross-floor return and the throne candidate. Logs and the observation-only [audit driver](../tests/evidence/repair-wave-3-sim/audit.mjs) are retained in `tests/evidence/repair-wave-3-sim/`. Earlier broader shelter-preference pilots are archived under `pilots/` and excluded from acceptance. The driver adds in-memory read-only hooks to the original sweep/novice entry points and AI memory; it never changes command choices, tuning, physics or random draws. `scripts/critique-v3-*.mjs` remain read-only. Source snapshots in `/tmp/castle-wave3-*` isolate the baseline, event-only, one-anchor and combined candidate conditions; source fingerprints identify the final artifacts.

Each focal or held-out paired cohort has 20 independent seeds in two numeric slot orders, rather than 40 independent worlds. Random identity still follows the physical castle. The novice cohort has separate AI 2/5/8 denominators, with reproduction seeds 1–10 and held-out seeds 11–20. Every match has a 20-minute observation cap; censoring is never counted as an in-game draw.

The plateau definition remains the longest post-120-second window whose **entire** palace range is strictly below 2 percentage points. Counts and maxima refer to eventual losers. Annotations enumerate maximal qualifying windows longer than 180 seconds, not per-second trajectories. They record both sides' actual shot counts, firing recency within a 30-second shot cycle, gun failure, population/ruler crises, repair HP and repair assignments. Flat palace HP is not itself evidence of boredom. The 30-minute human playtest remains unperformed in this lane.

## Terminal shots and state

`PROJECTILE_LOST` is emitted in the removal tick for out-of-map, below-ground or expired projectiles. The payload uses the final integrated sim position, never a fabricated landing. Expiry takes precedence over below-ground, then bounds, matching the old removal predicate order. `weapon.lastImpact` retains the previous real impact: that is the reference mark the UI keeps, and a lost shot supplies no replacement landing mark.

Real `EV.IMPACT.hit` values remain compatible. The additive `hitKind` identifies `own-obstruction`, `enemy-wall`, `palace`, `ground`, `person` or `weapon` from the collision before damage removes its block. Tests exercise all three loss reasons, real interception categories, one terminal event per removal, retained lastImpact and unchanged hash/serialization when the event itself is emitted. UI terminal-caption, signed-axis and chosen-point convergence acceptance remains on shared `.23`.

## Original novice results and causal repairs

The original scored results are retained next to the fixed cohort, not replaced by the seed-6 control:

| Original v3 opponent | Wins | In 12–20 minutes | Timeouts | P/R/S/T | Min / median / max, minutes |
|---|---:|---:|---:|---|---|
| AI 2 | 8/10 | 5/10 | 1 | 6/0/3/1 | 6.26 / 12.18 / 20.00 |
| AI 5 | 4/10 | 6/10 | 1 | 4/0/5/1 | 6.21 / 12.66 / 20.00 |
| AI 8 | 5/10 | 3/10 | 0 | 3/0/7/0 | 8.23 / 10.67 / 13.57 |

The first repair is exactly the demonstrated gun-memory fallback: `ruler.manning ?? pendingOrder?.weaponId`. A warning interrupting an unmanned repair no longer discards its return gun. The navigation regression separately destroys the selected front battery, then requires the ruler to walk to a surviving battery and fire there within 60 seconds. The repaired proxy first tries a visible gun already within the ordinary E radius, including from a damaged ledge; an exact operator-cell route is not a prerequisite for a legal interaction. It otherwise finds a normal stair/ladder path to a surviving operator point, re-mans within the existing interaction radius, orders crew and pays for its shot. It retains the supplied opening, charge 100, bounded impact corrections, local repair sequence, warning evasion and one paid replacement. It does not gain an aiming solver.

## Ruler return trace

The code is in `src/ai/controller.js`; there is no `src/npc/controller.js`.

| Baseline seed | Leadership departure | Mans front gun | Release | Death | Stationary after abandonment |
|---|---:|---:|---:|---:|---:|
| 12 | 710.03 s | 732.07 s | 786.57 s | 862.07 s | 75.50 s |
| 14 | 628.03 s | 650.07 s | 692.57 s | 812.50 s | 119.93 s |

Both baseline replays retain the critique hashes. Seed 12 loses front gun 1 at 786.17 s (its damaged-idle event follows at 786.20 s), then the controller releases it at 786.57 s. Seed 14 voluntarily releases a live gun at 692.57 s: its crew fires again at 707.57 s and the gun is destroyed later, at 716.50 s. These are a gun-loss return and a voluntary retreat, respectively; both leave the ruler stationary. The ruler stays at world `(111.50, 7, 127.50)` until a deliberate ruler-target blast kills it. The same-floor shelter filter excludes the authored ground rooms.

The fix retains a pending return after abandonment, admits destinations on other floors and prefers authored shelter rooms for returning leaders. Ordinary pre-leadership retreats retain their previous destination; a separate regression checks that scope. The physical pathfinder still decides reachability with clamber disabled. The existing MOVE implementation executes the steps; shared `rulerPathMove` handles stair-surface heights and ladder departure for both AI and proxy routes. An isolated leader first walks to and mans its front cannon, then abandons after a nearby impact and traverses the descending stairs to a ground-floor shelter within 30 seconds. The 18-second exposure gate, five-second departure commitment, danger radius, warnings, crew benefit, fall/damage rules and ruler HP are unchanged.

## Physical-side control

These are the original v3 paired controls over the same 20 normal-order worlds; the intervention effects are not additive:

| Condition | West / east wins | Winner flips | Duration changes | Mean absolute duration change | Ending changes |
|---|---|---:|---:|---:|---:|
| Baseline | 6 / 14 | — | — | — | — |
| Terrain reflection only | 6 / 14 | 0 | 0 | 0 s | 0 |
| Wind reflection only | 7 / 13 | 5 | 19 | 129.25 s | 12 |
| Calm wind | 5 / 15 | 3 | 19 | 67.69 s | 5 |
| Full east castle reflection | 9 / 11 | 9 | 19 | 62.24 s | 8 |

The smallest candidate changes only the east throne's local x from 23 to 24 through a starter-castle variant. All voxel layers, human spawn, exits, gun sites, shelters, work markers and population are unchanged. With ruler avoidance still active, the calm initial breach targets reflect exactly in x and agree in y/z. Full mirroring is not implemented; its 10P/9R/1S ending mix is retained as a rejected broader intervention.

## Tuning ledger and public repair state

No tuning number has changed. Wave-two palace HP 96, opening defeat line 20%, quadratic minute-10–15 ramp to 55%, surrender morale 20/45 seconds, population fraction 35%, trained low-level error and warning/exposure rules are retained. Income remains 3 + 0.1 per working civilian, start/cap 1500/2000, stone/tower/mount costs 4/8/6, repair materials 80% over 12 seconds, and salvage 50%. Reloads, shot prices, crew and ammo rules are unchanged.

The UI already receives `castle.jobs` (`kind`, `target`, `progress`, `claimedBy`), NPC `state`/`jobId`, block HP and `castle.lastRepairProgressTick` in the public sim snapshot. A repair's actual HP increments emit `BLOCK_DAMAGED`; completion emits `JOB_DONE`. These fields permit distinguishing workers walking to a repair, active paid progress and a completed repair beat while palace integrity is flat. The sim does not invent progress to animate a plateau.
