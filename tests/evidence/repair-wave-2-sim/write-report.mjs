// Owns the final repair-wave-two simulation report assembled from validated acceptance evidence.
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('./',import.meta.url),a=JSON.parse(readFileSync(new URL('acceptance.json',root),'utf8'));
if(!a.focal||!a.matrix||!a.unequal||!a.novice||!a.metricAudit.complete)throw Error('Complete cohorts and replay audit are required');
const f=a.focal,m=a.matrix,u=a.unequal,n=a.novice;
const pct=(x,y)=>`${(100*x/y).toFixed(1)}%`,minutes=x=>(x/60).toFixed(2),fmt=x=>Number(x).toFixed(1);
const row=(name,s)=>`| ${name} | ${s.matches} | ${minutes(s.lengthMinS)} / ${minutes(s.lengthMeanS)} / ${minutes(s.lengthMaxS)} | ${s.pacingPass}/${s.matches} | ${s.timeouts} | ${fmt(s.firstShotMaxS)} | ${fmt(s.maxNoFireS)} / ${fmt(s.maxReadyNoFireS)} |`;
const table=[row('Forest 5/5, 20 worlds × two orders',f),...[3,5,8].map(l=>row(`Forest ${l}/${l}`,a.matrixByLevel[l])),...Object.entries(a.unequalByPhysicalAssignment).map(([l,s])=>row(`Physical west/east ${l}`,s)),...['desert','ice','volcano'].map(b=>row(`${b} 5/5`,a.biomes[b]))].join('\n');
const nova=JSON.parse(readFileSync(new URL('novice-final.json',root),'utf8')).matches;
const moraleEnds=nova.filter(r=>r.reason==='surrender'&&r.finalSurrender.some(s=>s.holdTicks>=s.holdRequiredTicks&&s.population>=s.popThreshold));
const warned=f.rulerIntent.map(d=>{const raw=JSON.parse(readFileSync(new URL('sweep-focal.json',root),'utf8')).matches.find(r=>r.seed===d.seed&&r.swap===d.swap);const t=raw.threatEvents.find(t=>t.castle===d.slot&&t.projectileId===d.projectileId);return t?d.second-t.second:null;});
const untested=warned.filter(x=>x===null).length,lead=warned.filter(x=>x!==null);
const currentInputs=Object.entries(a.sourceFingerprints).map(([k,v])=>`- ${k}: \`${v}\``).join('\n');
const text=`<!-- owns: repair wave 2 simulation method, acceptance evidence, tuning and scoped provisional critique. -->
# 20 — Repair wave 2: simulation, NPCs, AI and playable loadouts

2026-10-18. This lane changed only its assigned simulation/content/scripts/tests, this report and the shared handoff. No git or Dolt push command was run. The browser and human study belong to the UI lane.

## Method

Red tests preceded the event, loadout, recovery, targeting and harness repairs. Named red/green logs are in [the evidence directory](../tests/evidence/repair-wave-2-sim/). Calibration probes are retained with their labels; interrupted partial cohorts are diagnostics, not final acceptance samples. The final [acceptance aggregation](../tests/evidence/repair-wave-2-sim/acceptance.json) checks cohort identities, including all 60 equal-level jobs and all 40 unequal-level jobs. Compact sweep files retain shots, first-gun losses, spending totals, minute curves, pressure/clock crossings, threat/death attribution and long-gap reasons. Each raw sweep JSON is under 2 MB.

There are 20 independent focal forest seeds, each replayed in two slot orders: 40 records, **not 40 independent worlds**. The level matrix uses ten independent seeds at levels 3/5/8, both orders. Its level-five records are the matching 20-record subset of the focal cohort. Unequal-level trials separately reverse physical skill assignment and numeric slot order: ten seeds × two west/east assignments × two slot orders. Each other biome has ten independent seeds; the critique's ten-record biome baselines used five worlds in two orders. Repeated seeds support comparisons across conditions; they are not independent additional wind worlds.

The harness interprets \`--levels 3,8\` as physical west/east. \`--levels 8,3\` reverses that assignment; \`--both-assignments\` runs both, and \`--reverse-only\` can reproduce return legs. AI/scatter/NPC random identity still follows physical castles. No rule, health, income or position override is used in the acceptance sweeps.

Late training changes affect levels 3–4 only. Tests compare every level-5–10 aim distribution at observations 0–64 exactly, and [fresh level-five/eight replays](../tests/evidence/repair-wave-2-sim/upper-level-parity.json) retain hashes and recorded metrics. The focal raw file retains its earlier low-motion scalar; the acceptance aggregation replaces that scalar with the corrected audit, without changing shots, outcomes or hashes. The [low-motion audit](../tests/evidence/repair-wave-2-sim/sweep-lowmotion-audit.json) replays all 20 normal-order focal worlds: every final hash, shot, sampled curve and result matches. Paired palace minute curves also match under physical relabelling. Source fingerprints are retained for each cohort rather than presenting different calibration builds as one frozen run.

Reproduction examples (use a separate output directory to preserve the evidence):

\`\`\`sh
node scripts/sweep.mjs --seeds 20 --swap-slot --compact --label focal --output-dir /tmp/wave2-repro
node scripts/sweep.mjs --seeds 10 --ai-levels 3,5,8 --compact --label matrix --output-dir /tmp/wave2-repro
node scripts/sweep.mjs --seeds 10 --levels 3,8 --both-assignments --compact --label unequal --output-dir /tmp/wave2-repro
node scripts/sweep.mjs --seeds 10 --no-swap-slot --map ice-duel --compact --label ice --output-dir /tmp/wave2-repro
node scripts/novice.mjs --policies novice --levels 5 --seeds 10 --compact --label novice --output-dir /tmp/wave2-repro
\`\`\`

## Before and after the acceptance gates

The before column comes from [critique v2](19-gameplay-critique-v2.md), preserving its definitions and denominators.

| Gate | Before | After |
|---|---|---|
| Offered armed starts | Desert orig-19 and volcano orig-67 unarmed; ice 2 vs 1 | Forest 2 vs 2; other duels 1 vs 1, matching front stations and paid spare sites |
| First paid shot, four biomes | Two physical sides never fire | ${Object.values(a.biomes).reduce((v,s)=>v+s.firstShotsPass,0)}/80 sides within 90 s; maximum ${fmt(Math.max(...Object.values(a.biomes).map(s=>s.firstShotMaxS)))} s |
| Longest desert / ice / volcano actual silence | 1117.6 / 1182.4 / 859.8 s | ${['desert','ice','volcano'].map(b=>fmt(a.biomes[b].maxNoFireS)).join(' / ')} s |
| Level matrix timeouts | 16/60 | ${m.timeouts}/60 |
| Level matrix in 12–20 min | 44/60 | ${m.pacingPass}/60 (${pct(m.pacingPass,60)}) |
| AI3 longest actual / ready gap | 707.4 / 707.5 s | ${fmt(a.matrixByLevel[3].maxNoFireS)} / ${fmt(a.matrixByLevel[3].maxReadyNoFireS)} s |
| Focal endings | Palace 40; ruler 0; surrender 0 | Palace ${f.reasons.palace??0}; ruler ${f.reasons.ruler??0}; surrender ${f.reasons.surrender??0} |
| Focal pacing | 40/40 in 12–20 min | ${f.pacingPass}/40 (${pct(f.pacingPass,40)}); ${minutes(f.lengthMinS)}–${minutes(f.lengthMaxS)} min |
| Focal slot wins | 20 / 20 | ${f.slotWins.join(' / ')} |
| Focal physical west/east wins | 16 / 24 | ${f.physicalWins.join(' / ')} |
| First-gun comebacks | 6/8 paired records, 3/4 worlds | ${f.firstGunComebacks}/${f.firstGunMatches} paired records; ${f.independentFirstGunComebacks}/${f.independentFirstGunCases} worlds |
| Focal first shots / worst actual gap | Armed; 70.5 s worst gap | ${f.firstShotsPass}/80 within 90 s; ${fmt(f.maxNoFireS)} s worst gap |
| Focal endings before seven minutes | None | ${f.endingsBefore7} |
| Losing-palace <2 pp plateau >3 min | 32/40, maximum 460 s | ${f.lowMotionOver3Min}/40, maximum ${f.lowMotionMaxS} s |

Physical results remain visible: balanced slot wins do not prove geographic balance. First-gun recovery is a small conditional sample, and meets the requested 25% floor without showing an improvement over wave 1.

| Cohort | N | Length min / mean / max (min) | 12–20 min finishes | Timeouts | Latest first shot (s) | Worst actual / ready silence (s) |
|---|---:|---|---:|---:|---:|---|
${table}

The level-eight controller wins ${a.unequalByPhysicalAssignment['3,8'].physicalWins[1]}/20 records when physically east and ${a.unequalByPhysicalAssignment['8,3'].physicalWins[0]}/20 when physically west. Each assignment has ten independent worlds and paired numeric slot orders. This supports a skill effect in both orientations while retaining the physical-side difference.

Across the ${a.requestedAI.matches} unique requested AI records, **${a.requestedAI.pacingPass}/${a.requestedAI.matches} (${pct(a.requestedAI.pacingPass,a.requestedAI.matches)})** finish in 12–20 minutes, with ${a.requestedAI.timeouts} timeouts. Default-level AI trials plus the legal novice comprise **${a.defaultAI5IncludingNovice.pacingPass}/${a.defaultAI5IncludingNovice.matches} (${pct(a.defaultAI5IncludingNovice.pacingPass,a.defaultAI5IncludingNovice.matches)})** in range. Including every novice and AI record gives ${a.allIncludingNovice.pacingPass}/${a.allIncludingNovice.matches} (${pct(a.allIncludingNovice.pacingPass,a.allIncludingNovice.matches)}). These are separate aggregates; the table does not hide fast individual cohorts behind the focal result.

No requested AI match ends before seven minutes. The legal novice is an instructed, favorable command policy, not an unbriefed person. It keeps the original rounded bearing/charge-100 opening and bounded impact correction, local repair/look/re-man sequence, and one paid replacement. New launch warnings trigger ordinary leave/move/return commands along the rampart, **away from the forecast impact**; repeated warnings cause another move rather than indefinite waiting at the refuge. It never uses the AI aiming solver for novice shots. Final result: ${n.pacingPass}/10 in range, ${n.wins}/10 wins, ${n.timeouts} timeout, ${n.remoteManualShots} remote manual shots, endings ${JSON.stringify(n.reasons)}. That individual cohort remains weaker than the aggregated pacing result and requires the follow-up described below. Morale-clock surrender is real in ${moraleEnds.length} novice records with population still above its surrender line.

## What changed and why

**Playable content.** The converter now provides a mounted cannon when conversion would otherwise leave a castle unarmed, and a complete magazine bay when no ammo workshop survives conversion. It authors a ground route to supply. The six offered generated duel castles get one front cannon and two unarmed front spare stations at mirrored positions/heights. Spares require normal paid construction. Their surrounding geometry remains distinct; each duel core now has the same 48-cell capacity as forest, rather than a 12-cell core. All 145 castles pass support, palace connectivity, marker and gun/operator-route checks. The [generator manifest](../tests/evidence/repair-wave-2-sim/castles-generated-manifest.json) and [conversion policy](../src/plugins/castles/CONVERSION.md) document the authored additions.

The [human command route](../tests/evidence/repair-wave-2-sim/playable.json) walks, climbs, mans, orders E's automatic crew and fires on both physical sides of every duel, without G or teleports. Its slowest paid shot is 15.5 s. This is command-equivalent E/Space evidence, not a claim that browser input or unbriefed discovery was tested here.

**Recovery.** Ice orig-44 had no magazine. The later [650-second ice snapshot](../tests/evidence/repair-wave-2-sim/ice650.json) showed one surviving mason imprisoned in an initially sealed standable pocket and another trapped inside a ledge with a zero-speed falling state. A 750 g replacement was reserved but never built. Population extras now require connectivity to the authored spawn. Descents clear the supporting ledge horizontally before lowering the body, including one-cell steps; cancelling a route mid-step can no longer strand the body inside its floor. Workers above a missing ladder rung can descend safely to surviving rungs. They clear missing-rung occupancy so it can be rebuilt. Ladder/tower access is included in urgent recovery, and gun construction outranks routine floor/decorative work. Worker-specific unreachable backoff is respected during preemption.

The AI distinguishes an actual castle shot from an attempted FIRE. It does not keep firing with zero ammunition. After a real firing drought it may pay for a useful spare even if an inaccessible original gun is still alive. Replacement sites must have a feasible enemy firing lane. The blueprint, cap, crew, supply and gold rules remain normal shared gameplay rules. Trained low-level crews retain observed correction and bounded late uncertainty; levels 1–2 retain their original wide error, and levels five and higher are unchanged by the final training adjustment.

**Endings and causal state.** Sustained palace damage and casualties now affect the slow morale layer as well as fast impulses; the old baseline-rate bound made a 45-second morale surrender structurally unreachable before 19:12. The surrender threshold is 20, aligned with the work-band boundary, and the hold remains 45 s. The existing floor, capped rolling death penalty, one-projectile credit, rally cooldown and explicit quiet/shelter recovery remain. A depleted shaken ruler can walk to support its front crew using normal movement and the existing leadership/reload benefit; it accepts a real exposure risk. Stair and ladder routes are executed physically, including the difference between a stair voxel base and the surface supporting the body.

Targeting tracks continuous public line of sight and permits an intentional ruler opportunity after 18 s. The focal ruler results include **8 deliberate ruler-target records (4 worlds)**, exposed for 25.47–162.5 s, and **2 incidental records (1 world)**. They are not all labelled snipes. At launch the simulation runs the production projectile forces and collision predictor with captured scatter and current wind/geometry, without RNG consumption, and emits \`EV.RULER_THREAT {castle,fromCastle,fromWeapon,projectileId,impactPos,etaTicks}\` within the 6 m radius. Moving bodies, changing geometry or later wind can change the eventual impact. \`EV.RULER_DIED\` carries the actual source and cause, including a projectile-induced roof collapse. Of the ten focal ruler defeats, ${10-untested} have a matching launch warning${lead.length?`, with ${fmt(Math.min(...lead))}–${fmt(Math.max(...lead))} s recorded lead time`:''}.

Each public castle exposes \`surrender: {morale,moraleThreshold,holdTicks,holdRequiredTicks,population,popThreshold}\` and \`pressure: [{cause,weight}]\`. The fixed vocabulary in \`src/npc/morale.js\` is **palace-damage, deaths, under-fire, no-gun, rally, quiet, shelter**. Weights are signed diagnostic influences; recent rally is an impulse and the death row includes the rolling penalty window. They are not an algebraic derivative of the two-layer displayed morale. Both \`palaceDefeatThreshold\` and \`keepCracking\` remain public. All four focal surrenders are population-driven; the novice clock crossings separately demonstrate genuine morale surrender and rally-driven hold resets.

**Stall API.** Every weapon carries \`idleReason\` and \`idleDetail\`, refreshed every tick. \`EV.WEAPON_IDLE\` is emitted on reason changes. The seven contract reasons are no-crew, no-ammo, no-gold, obstructed, damaged, reloading and ready. Details include crew \`{present,required}\`, ammo \`{haulerEnRoute}\`, a plot-local blocking \`cell\` (and optional person id), or shot funds. Tests exercise every reason and transition. UI presentation and the human stall-explanation study remain with the UI lane.

## Tuning ledger

| Parameter | Wave 1 / critique v2 | Final |
|---|---:|---:|
| Palace HP per cell | 80 | 96 |
| Generated offered-duel core cells | 12 | 48 |
| Opening palace defeat line | 30% | 20% |
| Cracking ramp, minute 10 to 15 | Linear, 30→55% | Quadratic, 20→55%; 28.75% at 12:30 |
| Morale surrender / hold | 10 / 45 s | 20 / 45 s |
| Population surrender fraction | 25% | 35% (strictly fewer than 14 of 40) |
| Extra stressed baseline rate | 0 | 0.4 × palace/casualty stress per second |
| Persistent palace / casualty stress rates | 0 / 0 | 0.65 / 0.5, after 15% palace damage / 25% losses |
| No-gun / quiet / recent rally window | Absent | −0.15/s / +0.05/s / 10 s |
| Ruler nearby-impact retreat radius | 10 m | 4 m |
| Ruler exposure / forecast radius | Absent | 18 s / 6 m |
| Ruler target score / collateral avoidance | Palace-equivalent 10 (tactic weighted) / absent | Explicit 14 / avoid unexposed-ruler breach impacts within 3 m |
| Leadership trigger | Absent | M<45, population<60%; normal movement and crew benefit |
| Leadership departure commitment | Absent | 5 s before reassessing recent local impacts |
| AI3 trained range / bearing floor cap | 3.2768% / 0.512° | 1.2% / 0.30° |
| Observed correction remembered from level | 4 | 3 |

The core/early defeat-line changes address the measured fast accurate-player and small-map resolutions; the late 55% endpoint remains. Income is still **3 g/s + 0.1 g per working civilian**, start/cap **1500/2000**, stone/tower/mount costs **4/8/6**, repair materials **80%**, full-block repair time **12 s**, and wreck/demolition salvage **50%**. Shot costs and reloads are unchanged. [The tuning artifact](../tests/evidence/repair-wave-2-sim/tuning.json) records before/after and the unchanged economy. This is not a claim of universally improved repair or palace-motion pacing: the corrected strict plateau result is worse than critique v2.

## Validation, provisional scores and remaining work

Full \`npm test\` and production build logs are [here](../tests/evidence/repair-wave-2-sim/npm-final.log) and [here](../tests/evidence/repair-wave-2-sim/build-final.log). The full suite includes AI determinism, save/restore, purity and the TB3 two-run checkpoint replay. The old isolated AI match fixture had no magazine and exhausted both two-load buffers; it now has ordinary complete supply rather than relying on incidental ruler death. Palace-priority and tuning assertions were updated to the intentionally changed defeat line. The separate generator byte check passes. Browser goldens were not recaptured in this lane.

| Requested criterion | Critique v2 | Provisional | Evidence and limit |
|---|---:|---:|---|
| B5 match shape | 3 | 3 | Endings/pressure develop, but corrected flat-palace windows remain ${f.lowMotionOver3Min}/40 and max ${f.lowMotionMaxS} s. |
| B6 length and variance | 2 | 4 | Cohort table and explicit aggregates above; favorable novice remains ${n.pacingPass}/10 individually. |
| F21 AI opponent | 2 | 3 | Paid recovery, trained correction, both skill orientations and physical ruler decisions; the local-proxy stalemate is retained. |
| E19 morale | 2 | 3 | Real 45-second clock, pressure causes, rally resets and normal crew guards; visual comprehension needs the UI study. |
| E20 win paths | 1 | 4 | 26/10/4 focal mix; eight ruler records intentional; palace still 65%, above the rubric's strongest anchor. |
| C9 first-match onboarding | 3 | 3 | Functional armed-start blocker removed; scripted routes do not establish unbriefed completion. |

Only these six provisional scores are assigned; there is no new 110-point total. Remaining per-cohort pacing/local-proxy work is **castle-game-uo7.18**, and the strict palace-plateau regression is **castle-game-uo7.19**. Independent human comprehension/pacing remains untested, and team-aware north/south recovery remains under **castle-game-er7**. The latter is not on the four west/east biome gates and remains open with notes. \`castle-game-uo7.13\` retains the UI/human-study half; this lane supplies its stall API. The strict palace-motion regression is preserved for the next critique rather than replaced with the weaker any-change metric.

### Source fingerprints

${currentInputs}
`;
writeFileSync(new URL('../../../research/20-repair-wave-2-sim.md',root),text);
console.log(`Wrote research/20-repair-wave-2-sim.md (${text.length} characters)`);
