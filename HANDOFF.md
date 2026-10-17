# HANDOFF — Critique v3 running on codex astra (2026-10-18 10:40 AEDT, orchestrator)

## What was done
Critique v2 (research/19, 60/110) committed as 4f5a0e7. Repair wave 2 ran as two codex lanes with disjoint file ownership after the orchestrator added EV.RULER_THREAT, EV.WEAPON_IDLE and IDLE_REASON to src/contracts.js (9347fbf). UI lane (research/21) landed as 8d981ec; sim lane (research/20) landed as f0a29d9 after a green 498-test run on the settled tree (89 s), browser smoke and ui-flow. DESIGN.md sections 5-6 now state the measured numbers (defeat line 20% -> 55% quadratic in minutes 10-15, surrender morale 20 / population 35%, start 1500 / cap 2000, repair materials 80%). Worklog docs/worklog/2026-10-18.md covers the day.

## Remaining
Critique v3 is running (launched 08:17, `codex exec -C . -m gpt-6-astra -c model_reasoning_effort=xhigh -s danger-full-access --skip-git-repo-check -o codex-logs/23-critique-v3-final.md - < codex-logs/23-critique-v3-prompt.md`). It writes research/22-gameplay-critique-v3.md (draft present since 09:30), scripts/critique-v3-*.mjs and tests/evidence/critique-v3/. Done means codex-logs/23-critique-v3-final.md exists. Goldens (48 poses) were verified green on the settled tree at 08:10 and uo7.17 closed; LICENSE is MIT; README is the contributor front page; docs/SETUP.md is the new-machine guide.

## Recovery (if the box, the network or this session dies mid-run)
Every 15 minutes while codex runs, the orchestrator pushes a snapshot of the untracked critique files (report draft, scripts, evidence JSON/logs without the 34 MB `shots/`, and the codex log) to branch `wip/critique-v3` on origin, in a commit on top of main, without touching the main index or working tree. To recover on this box: nothing to do, the files are in the working tree; `codex exec resume --last` continues the same codex session if `~/.codex/sessions` survived, otherwise relaunch the command above with this line appended to the prompt: "A draft of your report and evidence already exist in research/22-gameplay-critique-v3.md and tests/evidence/critique-v3/; continue from them, do not redo finished sweeps." To recover on another machine: clone, `git checkout wip/critique-v3`, follow docs/SETUP.md, then relaunch with the same appended line. The wip branch is deleted once the real commit lands on main. Claude session transcript: ~/.claude/projects/-home-tobias-Projects-castle-game/3930dbc1-3943-44a2-bbae-2b570bf3708f.jsonl (`claude --resume`).

Earlier remaining text: Goldens on the settled tree (48 poses) are being verified by the orchestrator; any sim-induced change is inspected and recaptured before uo7.17 closes. Critique v3 brief is codex-logs/23-critique-v3-prompt.md (launch on codex astra with danger-full-access). Open lanes work: uo7.18 (novice pacing tail), uo7.19 (strict palace plateaus 34/40), human-study halves of uo7.10/uo7.13/uo7.15, er7. LICENSE undecided.

## Key techniques
Two codex lanes can run concurrently if ownership is disjoint and shared contracts are added by the orchestrator first; each lane codes against the interface with fallbacks. Commit each lane on its own paths as it lands (`git add <lane paths>`), then run the full gates once on the settled tree. GOLDENS_ONLY=a,b verifies single poses under load. Raw sweep trajectories over 2 MB stay out of git (.gitignore patterns under tests/evidence/critique-*).

## Issues touched
Closed by lanes: uo7.9, uo7.11, uo7.12, uo7.14, uo7.16. In progress: uo7.17 (orchestrator). Open: uo7.10, uo7.13, uo7.15 (human halves), uo7.18, uo7.19, er7, uo7.1, ko3.1, ko3.2, ot9.5, hoq, hyr, sdx, m7d, ryk, v7s, yfq, iq8, bxe, utr, kqn.

## Next step
When codex-logs/23-critique-v3-final.md appears: read it and research/22; gitignore any evidence file over 2 MB; commit research/22 + scripts/critique-v3-*.mjs + evidence + codex-logs/23-critique-v3-final.md; `npm run beads:export` and commit .beads/issues.jsonl; update this section; run `npm test`, `npm run test:browser`, `node tests/ui-flow.mjs`; message peer session sublimite-23 (uds:/run/user/1000/cc-socks/2029333.sock) before `npm run goldens` (48 poses, about 10 min; they pause their dispatches for 10 min); recapture only goldens whose change is explained; confirm the game runs (`npm run build` + browser smoke, ideally from a fresh clone); push; delete `wip/critique-v3`; then brief repair wave 3 from the ranked beads (sim lanes on codex sol, UI on codex astra). Earlier next step: Finish the golden verification, close uo7.17, launch critique v3 (`codex exec ... -m gpt-6-astra -s danger-full-access -o codex-logs/23-critique-v3-final.md - < codex-logs/23-critique-v3-prompt.md`), then brief repair wave 3 from its ranked list. Check `~/.claude/scripts/claude-usage` before any Claude agent (weekly 41% / Fable 40% at 07:49).

## Previous Sessions
The earlier handoffs follow unchanged.

---

<!-- owns: current repair-wave-2 simulation handoff and preserved UI/earlier session records. -->
# HANDOFF — Repair wave 2, simulation lane (2026-10-18)

## What was done
Completed the assigned sim/content repairs and closed `castle-game-uo7.16`, `.12` and `.11`. Report: [research/20-repair-wave-2-sim.md](research/20-repair-wave-2-sim.md). Final evidence: [acceptance.json](tests/evidence/repair-wave-2-sim/acceptance.json) and [23/23 passing gates](tests/evidence/repair-wave-2-sim/gates.json).

Every offered duel has a reachable, fairly armed starter kit; all 145 converted castles have a cannon and magazine. The offered generated duels have matching front guns, paid spare sites and 48-cell palace capacity. Ice's later stall was traced to an initially sealed NPC spawn pocket and a mason trapped inside a cancelled descending step. Reachable spawning, safe ledge/ladder descent, access repair priority, gun-first construction and paid feasible recovery fix those cases. Idle reasons, launch warnings, killing-source attribution, public surrender clocks and fixed pressure causes are implemented.

Focal 20 worlds × two orders: **26 palace / 10 ruler / 4 surrender**, 36/40 in 12–20 min, slot wins 20/20, physical west/east 12/28, first-gun comebacks 2/8 paired records (1/4 worlds), max actual/ready firing gap 71 s. Eight ruler records intentionally target rulers after 25.47–162.5 s exposure; two are incidental. All ten have launch warnings 2.9–3.4 s before death. No focal ending is before seven minutes.

The 60-record level matrix reaches 48/60 in range and zero timeouts. Both physical assignments of 3 vs 8 are separately tested: 32/40 in range, zero timeouts. Four biomes × ten independent seeds have 80/80 sides firing within 20.57 s and no actual gap above 118.5 s. Across 150 unique AI records, 123/150 (82%) are in range, zero timeouts. Including the instructed legal novice gives 129/160 (80.6%) with one timeout. Human movement/man/crew/fire command routes on all eight physical starts reach a paid shot within 15.5 s, without G or teleporting.

Full settled-tree `npm test -- --test-concurrency=4`: **77 files pass, zero failures/skips**, including determinism and the TB3 two-run checkpoint replay. Production build passes. These later logs supersede the transient sim-wide failures recorded in the preserved UI handoff below; browser/golden integration is still separate. No git commands or Dolt push were run.

## Remaining
`castle-game-uo7.18` tracks individual-cohort tails: AI8 is 12/20 in range and the favorable local novice is 6/10, with a seed-6 timeout and seed-10 fast palace win. Those are explicitly shown rather than hidden behind aggregate gates. `castle-game-uo7.19` tracks the strict losing-palace plateau regression: corrected 34/40 over three minutes, max 508 s, versus critique-v2 32/40 and 460 s. B5 stays at provisional 3. Human comprehension and discovery remain with the UI lane; `.10`/`.13` retain their human-study acceptance. `castle-game-er7` remains open for team-aware north/south recovery, which is not on these west/east duel gates. `.17` owns settled shared-tree browser/golden integration.

## Key techniques
The simulation remains pure, fixed-step and deterministic. All weapons/repairs/replacements use ordinary costs, caps, crew, supplies and commands. Low-level training now retains observed correction and caps trained error at 0.30 degrees / 1.2%; levels 1–2 keep their broad error and every level-5–10 aim distribution remains exact. Fresh level-five/eight replays retain hashes and metrics; all 20 normal-order focal replay hashes and paired palace curves match. The corrected low-motion counter includes plateaus crossing the opening exclusion and preserves the max-minus-min definition.

Wave-1 income 3/.1, costs 4/8/6, repair .8/12 s and salvage .5 remain unchanged. Palace cells are 96 HP; the opening defeat line is intentionally **20%**, with a quadratic minute-10–15 ramp to the unchanged 55% endpoint (28.75% at 12:30). The UI should read the published field. Surrender is morale<=20 held 45 s or population<35%; actual morale-clock endings occur in the novice, while the focal surrender records are population-driven. Pressure vocabulary: palace-damage, deaths, under-fire, no-gun, rally, quiet, shelter. All tuning and before/after evidence are in research/20 and tuning.json.

## Issues touched
Closed `.16`, `.12`, `.11`; completed the sim half of `.13` and left the shared UI/human issue open. Updated `.14` with the measured final palace line and `er7` with deferred scope. Created `.18` for individual pacing/proxy tails and `.19` for strict palace plateaus. Updated `.17` with current unit/build evidence. Persistent knowledge is in `bd remember` under `gameplay-repair-wave-2-sim`.

## Next step
Orchestrator reviews research/20 alongside the UI report, preserves the intentional 20%/quadratic tuning choice, and runs `.17` browser/golden checks on the settled source tree. Run the specified unbriefed-human sessions before awarding human comprehension points. Continue `.18`/`.19` from their pinned seeds and corrected definitions; cardinal/team recovery remains `er7`. Git stays with the orchestrator.

## Previous Sessions
The UI and earlier handoffs follow unchanged.

---

<!-- owns: repair-wave-2 UI handoff and links to reproducible evidence. -->
# HANDOFF — Repair wave 2, UI lane (2026-10-18)

## What was done
Implemented directional ruler danger with ETA and a bounded short sound; cause-specific defeat sentences, up to three decisive events and Enter retry preserving setup; at most two legal contextual reload alternatives; visible paid repair progress; idle-gun reason/action diagnostics; the published palace defeat line and bounded notices; pressure/surrender progress on morale; two-second signed impact offsets with retained aim/impact references. Match-1 gates and retiring prompts remain intact. Gameplay now uses authored weapon Sight positions; broader sight calibration remains separate. All new strings have German and English entries in `src/ui/i18n.js`.

Evidence and the requested provisional rubric subset are in [research/21-repair-wave-2-ui.md](research/21-repair-wave-2-ui.md). Actual AI5 seed6 has a warning at about 0:43 before its attributed 0:46 ruler loss; browser/headless replay, one-key retry and early local defeat in a multi-castle battle pass. Actual R repair goes 24→25→40 HP with 1.28 gold of materials. Actual clock captures at 9:59/10:01/12:30/15:01 display the current published line. UI/player/render: 157 tests pass; build, browser smoke, flow and all six onboarding checks pass. All 48 final snapshot poses compare at zero pixels after inspected refinements (20 new poses, 11 prior baselines replaced); `goldens-final.json` and the source hashes record the scope. Shared-tree integration remains `.17`.

## Remaining
`.10` and `.13` still require their specified unbriefed human sessions; the unchanged novice proxy does not observe the HUD. `.15` retains the precise 190 m convergence acceptance: ten calm seeds hit the castle within four shots, but that is not proof of precise chosen-point convergence. `.11` is still sim-lane owned. `.17` owns settled shared-tree integration and reconciling the palace base: the final captured sim used a 20% base and quadratic ramp, while the UI brief said 30%. The UI reads the field correctly rather than hiding this difference. The full shared-tree/snapshot test runs contain simulation-wide failures documented in research/21; no global-green or human-comprehension claim is made.

## Key techniques
The new pure modules are `src/ui/battle-feedback.js` and `src/player/interventions.js`; drawing is `src/ui/battle-draw.js`. Threat IDs deduplicate visual/audio cues; per-projectile launch snapshots protect overlapping-shot feedback. Optional sim fields hide cleanly. Actual picker/ghost/designation rules, live costs and job priority filter reload suggestions; weapon meshes and fixed HUD regions prevent misleading or overlapping world labels. The end account groups casualties from one blast. No sim, NPC, AI, tuning, map or contracts file was edited. Visual fixtures use `setPose` HUD overrides, never sim-state stubs. A recorded temporary source snapshot separates reproducible UI validation from concurrently changing simulation inputs; `shared-tree-differences.json` records that boundary.

## Issues touched
Closed `castle-game-uo7.9` and `castle-game-uo7.14` with evidence. Implemented the UI portions of `.10`, `.13`, `.15` and `.11`, leaving their unfulfilled acceptance explicit. Updated `castle-game-hoq` with the Sight hookup and kept its calibration open. Created `castle-game-uo7.17` for final shared-tree checks. No git commands or `bd dolt push` were run.

## Next step
Orchestrator integrates both lanes and runs `.17` on the settled source tree, then conducts the unbriefed-user sessions and a precise aiming trial. Preserve the distinction between actual replay/repair/clock captures, arbitrary-field goldens and human evidence. Previous sessions follow unchanged.

---

<!-- owns: the current critique handoff and preserved earlier session records. -->
# HANDOFF — Gameplay critique v2

Updated 2026-10-18. Report: [research/19-gameplay-critique-v2.md](research/19-gameplay-critique-v2.md).

## What was done
Independent full score: **60/110**, up 8 from v1 and 10 short of 70. Completed all 150 requested AI matches, 30 embodied novice matches, 60 strategy trials, controls and isolated tuning probes. Captured and inspected SwiftShader 1024×768 timelines, prompts, impact views and a real 46-second ruler loss. All 303 src JS files remain unchanged; no git or Dolt push commands were run.

## Remaining
Eight ranked repairs are in Beads. Desert and volcano west starts are unarmed while match-1 disables placement. AI3 has a 707.5-second ready silence; ice times out 8/10. Human onboarding/workload/audio and first-hit snowball are unvalidated. The two-number ending candidate yields 5 palace/3 ruler/2 surrender in ten seeds but only 7/10 finish in 12–20 minutes; it is not a completed repair.

## Key techniques
Paired worlds are not independent seeds. All 40 focal forest outcomes/durations/hashes match wave1 exactly; physical wins are 16/24 despite 20/20 slot wins. The original low-motion check still finds 32/40 losing-palace stalls over three minutes (460 elapsed seconds maximum). Scored novice data is `novice-embodied.json`; `novice.json` retains the earlier engine controls and strategies, and `hiding-covered.json` corrects courtyard retreat to actual covered hiding. The embodied policy uses leave/look/repair/re-man, local visibility/range, one paid replacement, and zero remote manual shots. Matrix batches assert all 60 job identities. The morale floor/baseline-rate bound prevents automatic morale surrender before 19:12, later than all focal forest finishes. See `tests/evidence/critique-v2/analysis.json` and `audit.json`. Full npm test: 456 pass; build, three sweep checks, two probe checks and browser captures pass.

## Issues touched
`castle-game-mhl` completed with reason `research/19`. Created children `castle-game-uo7.9` through `.16`; descriptions and acceptance tests are copied into `tests/evidence/critique-v2/issues.json`. Existing `er7`, `me0` and `hoq` were not modified. The orchestrator had already closed `me0`; its browser/golden work is separate from the unperformed human study.

## Next step
Orchestrator reviews research/19 and assigns the eight repair issues. Fix playable starting loadouts, attributable danger/failure and broader AI recovery; re-test ending candidates with pacing guards. Re-score after implementation and run the three-person unbriefed first-match study. Git remains with the orchestrator.

## Previous Sessions
Earlier handoffs follow unchanged.

---

# HANDOFF — Repair wave 1 landed, critique v2 running (2026-10-18 04:00 AEDT, orchestrator)

## What was done
Repair wave 1 (codex sol, research/17) committed as f069da7 after a green 456-test run (192 s): economy scarcity, breach and keep cracking, slot symmetry, supply/gun recovery, headless sweep harness (`node scripts/sweep.mjs --seeds 20 --swap-slot`). Onboarding (research/18) committed as 1932f4e with 28 goldens stable at 0 px (d940f70). Worklog docs/worklog/2026-10-18.md and README status updated. Beads closed: me0, ec7, plk, ot9.2, ot9.3, ot9.4, uo7.3-uo7.6, uo7.8.

## Remaining
Critique v2 (castle-game-mhl) is running on codex astra from codex-logs/20-critique-v2-prompt.md; it writes research/19-gameplay-critique-v2.md, scripts/novice.mjs, tests/evidence/critique-v2/ and files the next repair beads under castle-game-uo7. Win-path variety regressed in wave 1 (all 40 endings are palace defeats); the critique must quantify the ruler and surrender paths. Goldens may need recapture after sim changes (see Next step). LICENSE undecided.

## Key techniques
Sim-dependent goldens (tb*, hud-match*) are replayed from scripted command streams, so sim tuning changes legitimately move them; accept only after inspecting test-results/*.actual.png and recapture with `rm tests/goldens/<name>.png && npm run goldens` three times for stability. Codex workspace-write cannot open sockets (Wine, X11, Playwright); run browser gates on the main thread or launch codex with danger-full-access (user-approved). Quota: `~/.claude/scripts/claude-usage`; keep Fable within 2 points of weekly and both under the per-day ceiling before launching any Claude agent.

## Issues touched
Closed me0, ec7, plk, ot9.2, ot9.3, ot9.4. In progress mhl (critique v2). Open follow-ups: er7, uo7.1, ko3.1, ko3.2, ot9.5, hoq, hyr, sdx, m7d, ryk, v7s, yfq, iq8, bxe, utr, kqn.

## Next step
When codex-logs/20-critique-v2.log finishes: read codex-logs/20-critique-v2-final.md and research/19, commit research/19 + scripts/novice.mjs + evidence, push, then brief repair wave 2 from the ranked list (sim/ai lanes on codex sol, UI lane on Opus or codex astra depending on quota).

## Previous Sessions
The earlier handoffs follow unchanged.

---

# HANDOFF — Repair 5 onboarding (2026-10-18)

## What was done
Local career profile, pure feature ramp, three retiring reticle prompts, E auto-crew, UI/input/command gates, quick start at AI 2, HUD cleanup and profile fixtures are implemented. Details and ramp table: research/18-onboarding.md. Source changes stayed in UI/player/main and the new progression module; simulation and renderer files were not edited. No git commands were run.

## Remaining
Browser flow, after screenshots and legitimate HUD golden replacements are tracked by castle-game-me0. This runner denies localhost listen (EPERM) and Chromium crashpad sockets. No existing golden PNG was replaced; the repair issue stays in progress pending visual acceptance. Modern poses are excluded from the onboarding capture helper while the render session works.

## Key techniques
The same pure visibleFeatures result gates labels, key/mouse input, palettes and emitted commands. E emits ORDER_CREW before MAN_WEAPON; actual successful uses retire prompts. Career counts persist separately from ephemeral URL/debug fixtures. Goldens keep their script command streams. npm test passes 68 files in 513.827 s; the final UI suite passes 113 tests and build passes. A real sim/reticle/E/fire route repeats identically at tick 254, hash 2233218174. Evidence is tests/evidence/onboarding/.

## Issues touched
castle-game-uo7.7 implements the repair and depends on castle-game-me0 for remaining acceptance. Beads records remain local because the Dolt database has no configured origin.

## Next step
Run tests/ui-onboarding.mjs and tests/evidence/onboarding/capture.mjs on a socket-enabled SwiftShader runner, inspect actuals, accept only named HUD changes and the three new poses, run browser/ui-flow/goldens gates, then add after images to research/18-onboarding.md and close both issues.

## Previous Sessions
The earlier handoffs follow unchanged.

---

# HANDOFF — TB4a simulation weapon plugins

Updated 2026-10-17 by Codex. The user prohibited every git command; none was run.

## What was done
All ten core weapons register with sim and kit-v1 view definitions; zeppelin and bomb register as unavailable map-only stubs. Shared paid salvos support independent scatter/fan spread and cumulative due-tick bursts (double cannon 0/9, Hellfire 0/17/34/51/67). Rocket uses fixed native speed 1000, thrust 45, charge burn ticks, falling mass 55+2R and a 24/28 payload after burnout. Ballista sweeps through at most three people without restarting flight; fire burns/spreads only through burnable voxels on the fire RNG stream. AI solves charge with each weapon's fixed pitch/propulsion, filters infeasible targets and allows lobbed arcs over sight-line walls.

Placement accepts all ten playable ids via castle loading, CMD.DESIGNATE_WEAPON and the existing AI replacement planner. The narrow NPC integration checks all nine ground supports, the 3x3x2 footprint and pending reservations, keeps masons outside pending weapon bodies, and uses the existing 30 s ground build time. Only npc/designations.js and the work-goal/build-duration lines in npc/jobs.js changed in the NPC lane. sim/sim.js also delegates piercing count bookkeeping and continues the unconsumed collision segment. Contracts, renderer, player/UI, tools and assets were not edited by this session.

Validation: all targeted plugin/aim/effect/placement checks, the 29-file regression suite and build pass. Full npm test passes all 55 files with 0 failures/skips in 662.891 s, including the two-run checkpoint replay; the final focused aim/GLB-node checks also pass. Seed-1 level-5 default duel ends at tick 30117 = 1003.9 s (16.73 min), winner 0, palace, shots 41/20, hash 2991818321. Duration is unchanged from TB3; no palace values were changed. Evidence: tests/evidence/tb4-*. The exact 15-line numerical report is tests/evidence/tb4-report.md; the complete definitions and nominal ranges are tb4-weapon-numbers.json.

## Remaining
castle-game-iq8: first-class hashed fixed pitch/control/muzzle/availability fields in the orchestrator-owned contract. castle-game-v7s: expose all playable ids in main.js's cannon-only selector and scope the controller's transferred wind-bias entries by defId. castle-game-bxe now records only original ballista elevation controls, strict half-support condition and optional exact rocket child scatter/timing; the powered rocket surrogate has been removed. Zeppelin/bomb flight and drop mechanics remain deliberately unimplemented stubs.

## Key techniques
The validated legacy elevDeg bands remain because the contract rejects a 36.73828125-degree lobbed band. Fixed physics comes from weapon tuning. Stubs export AVAILABILITY and use a shared unavailable onFire sentinel rejected before payment/designation/AI aim. Burst, fire and propulsion records use normal sim serialization. All weapon model paths are assets/kit-v1/<id>.glb; absent or malformed models use the existing cannon-box fallback. Authored throwing meshes are named lowercase arm. Detailed adaptations and original-model simplifications are in src/plugins/weapons/README.md.

## Issues touched
castle-game-dwy tracks TB4a; follow-ups castle-game-iq8, castle-game-v7s and castle-game-bxe.

## Next step
Orchestrator can review the sim lane and the parallel kit/render/UI changes together. The user forbids git in this lane; no git commands were run. Beads records are local because bd dolt push reports that its origin remote is not configured.

## Previous Sessions
The earlier handoffs follow unchanged.

---

# HANDOFF — kit v1 weapon assets

Updated 2026-10-17 by Codex. No git commands were run, as explicitly requested.

## What was done
`tools/blender/kit_v1_weapons.py` generates clean-room catapult, trebuchet, ballista, hellfire, double-cannon, fire-catapult, rocket, arcaballista, fat-freda and zeppelin GLBs, individual 512px procedural atlases and 256px thumbnails. It merges ten weapon entries into the current kit-v1 manifest. The authored contact sheet is `assets/kit-v1/thumbs/weapons-contact-sheet.png`; original study views and same-scale comparisons are under `assets-ripped/compare-v1/weapons/`, with an index contact sheet. The original `kit_v1.py`, `kit_v1_textures.py`, renderer and view definitions were left untouched. The existing verifier now counts manifest entries and checks the additional weapons rather than requiring exactly 58 GLBs.

Validation passes: ten weapon GLBs via `validate_glb.py`, the full 68-GLB kit, 40 three r186 aim poses, the clean-room test, and the production build. All 31 authored GLB/atlas/thumbnail/contact files regenerate byte-identically; unrelated manifest fields remain unchanged. Evidence is `tests/evidence/kit-v1-weapons.txt` and `assets/kit-v1/weapons-validation.json`.

## Remaining
No remaining asset work in this request. Runtime weapon registration and behavior belong to the parallel plugin session. These Blender inspection frames are separate from SwiftShader gameplay goldens.

## Key techniques
One metre per Blender unit, exported +Y-up / forward -Z. Each GLB has three meshes and Base/Yaw/Pitch/Muzzle/Sight nodes. New `Pitch.extras.pivot` is numeric `[0,0,0]`; its first child is the zero-offset arm/barrel mesh, because three r186 resets that child's translation. Joint coordinates are node translations plus `pivot_m`; descriptive text uses `joint_description`. `--validate` invokes the existing byte-level GLB validator and the real three r186 loader/renderer over 40 aim poses. Reference imports are confined to separate `--study`/`--compare` modes with no export calls. Cycles timing text is removed from rendered PNGs for repeatability. The zeppelin follows the requested 12 m length; original reference envelope is about 14 m. Rocket uses the requested tube rack rather than the reference single housing.

## Issues touched
`castle-game-d61` owns the assets. Triangles: catapult 784; trebuchet 456; ballista 339; hellfire 1376; double-cannon 944; fire-catapult 850; rocket 918; arcaballista 1152; fat-freda 800; zeppelin 978. All below 1500.

The issue is closed locally. `bd dolt push` could not sync because this database has no `origin` remote configured. No git commands were run.

## Next step
Consume the merged manifest or the ten kit-v1 GLB paths in the parallel weapon views. Rebuild with the new weapon script after regenerating the older base kit, whose original script owns its base manifest. Usage and the r186 pivot correction are documented in `tools/blender/README.md`.

## Previous Sessions
The earlier handoffs follow unchanged.

---

# HANDOFF — TB3 designation slice

Updated 2026-10-17 by Codex. The user explicitly prohibited every git command; none was run.

## What was done
Paid block and cannon designations, cancellation/refunds, supported/free/occupied/cap rules, demolition salvage, mason build safety and fear handling, first-person B/G placement, number/wheel selection, cost/reserved HUD messages, AI rebuild eligibility, and dynamic block/cannon rendering are implemented. The only render file changed is the new src/render/ghost-view.js. src/tb3-script.js walks the real stairs and designates five rampart blocks.

## Remaining
Visual acceptance is pending under castle-game-ec7: this sandbox denies Vite localhost listen and Chromium socket setup with EPERM. A parallel render session wrote both TB3 PNGs at 21:21 AEDT. I inspected them; the ghost and cost line are visible. The built pose had the local ruler obscuring the wall, so its camera was adjusted north on the rampart with showRuler:false and requires recapture. No WebM was produced here. The new poses are in tests/goldens/poses.json. The headless build finishes at tick 754 with exactly five block costs spent. The AI replay ends at tick 30117 (1003.9 s), winner 0, hash 2755937710, 136 designations, 14 builds, and 101 equal checkpoints over two runs. npm test passed all 48 files (0 failures/skips) in 761.0 s; the final shared-cap controller regression passes separately in evidence50. The parallel look runner also passed browser smoke (12-look-browser.txt). Unit/build evidence and the final match result are recorded in tests/evidence/30..50-tb3-*.

## Key techniques
Site occupancy uses the full body bounds of all living people, including enemy NPCs and heads/edges. Build work rechecks support and occupancy every tick. Mason destinations exclude every pending build cell, preventing workers from parking inside another job. Cannon reservations round-trip through save/restore and finish with WEAPON_PLACED and BLOCK_BUILT. Demolition preserves facing/shape and uses economy.demolishRefundFrac when supplied, otherwise the existing economy.repairCostFrac (0.5); tuning.js was outside ownership and was not edited.

## Issues touched
castle-game-bz6 tracks implementation and remains in progress until visual acceptance; it depends on castle-game-ec7 for captures and browser gates.

## Next step
On a socket-enabled runner, run node tests/evidence/36-tb3-browser.mjs, npm run test:browser, node tests/evidence/49-tb3-goldens.mjs, npm run goldens twice, and node tests/evidence/43-tb3-video.mjs. The strict golden helper requires exact equality over two runs and lists changed baselines; existing updates require an explicit name list after inspection. The video script produces test-results/tb3.webm: exactly 20 s at 30 fps, advancing two sim ticks per frame. Its live-AI sim timeline already passes headlessly (five blocks, incoming direct-hit projectile, R repair).

## Previous Sessions
The prior orchestrator handoff follows unchanged.

---

# HANDOFF — Hohenfeuer

Updated 2026-10-17 ~22:20 AEDT by the orchestrator (Fable). Read order: docs/DESIGN.md -> research/00-scoping-decisions.md -> this file.

## What was done
- Scoped with Tobias (3 Socratic rounds) -> research/00. Ground truth in research/01..07.
- Original CD downloaded (downloads/en-iso, raw 2352-byte image converted and extracted to iso/), manuals, NoCD. Game installed under Wine (~/.wine-castle, C:\Program Files (x86)\Ballerburg) with Tobias clicking the installer.
- Wine 11.19 wow64 at ~/Apps/wine-11.19-wow64, Blender 4.5.14 at ~/Apps/blender-4.5.14-linux-x64.
- Scaffold (vite, three 0.186.1, node --test, Playwright SwiftShader harness, goldens script), CLAUDE.md laws, beads epics Phase 0-4.
- docs/DESIGN.md v1 (Opus), src/contracts.js + src/tuning.js v1 (Opus), rules-purity/cleanroom tests, 96 semantic manual goldens.

- Phase 1 lanes A/C/D/E/F all committed; 197 unit tests, 7 goldens green. **TB1 (tracer bullet 1) is visible on index.html**: walk to cannon, man, aim, fire, hit; AI fires back (video test-results/tb1.webm, golden tb1-first-shot).
- Exe static analysis (research/11): original ballistics = fixed elevation per weapon + charge 1-255 speed, gravity/drag/scatter/splash/wind constants. Ripped tables reconciled in research/10.
- Workflow switched to tracer bullets (Tobias's preference): each iteration = one thin end-to-end slice + golden + headless test; send a screenshot/video per slice.

- **TB2 done and green (270 tests, 9 goldens)**: original ballistics model (research/11), NPCs wired (crews gate fire, runners, masons, civilians, morale), kit v1 assets, HUD likeness under the gate (blurred MAE 18), AI orders crews/retries, matches last 12-16 min (seeds 1-3). Video test-results/tb2.webm. Public repo: https://github.com/tobiasosborne/hohenfeuer
- Second wave results: 08-tb2-sim, 09-kit-v1, 10-laneB, 11-tb2-stabilise finals in codex-logs/.

- **TB3 done**: designate-and-build (reserve/refund/cap/support rules, ghost block, masons build supported-first under the fear gate, AI rebuilds); goldens tb3-designate/tb3-built. 292 unit tests.
- **Look-loop pass 1 done** (research/12): whole-frame MAE vs original 39.9 -> 28.1; 15 goldens stable. **Original capture done** (research/09): 120 catalogued PNGs + 3 videos, 4 biomes, 12 weapons (an earlier 169-shot set is in assets-ripped/backups/goldens-original-1939.tar).

- **Fourth wave done**: all 10 weapons as plugins + per-weapon AI aim (363 tests); kit v1 weapon meshes; look-loop pass 2 (research/13: cannon framing, stone/ground/effects; TUNING.ruler camera changed); menus/skirmish setup/esc menu/end screen (game boots to a title screen; `?play=1` skips it). 18 goldens.
- Tobias: not sure about a period look; beads castle-game-uo7.1 (period preset) and uo7.2 (modern preset) registered; pursue both as style presets.

## In flight (fifth wave, launched ~22:20)
- codex astra: modern look preset (17-modern-look.log): custom block shader, terrain splat, sky dome, fire/water, GPU-only shadows/soft particles behind a flag, style switch; owns src/render (except people-view.js), tuning.render
- Opus (lane E agent): first-person feel + NPC readability (recoil/shake/head bob/impact view, walk cycle, job markers, speech bubbles); owns src/player, src/ui, src/audio, src/render/people-view.js
- codex sol: original castles conversion (18-castles.log): 145 ripped templates -> block CastleDefs per biome + maps; owns scripts/rip/castles_to_defs.py, src/plugins/castles|maps|biomes

## Fourth wave (done)
- codex sol: TB4a full weapon set as plugins + per-weapon AI aim (14-tb4-weapons.log)
- codex sol: kit v1 weapon meshes in Blender (15-kit-weapons.log)
- codex astra: look-loop pass 2: weapon-view cannon framing + stone contrast (16-look-loop-2.log)

## Third wave (done)
- codex astra, unsandboxed: look-and-feel loop pass 1 vs original captures (12-look-loop.log); owns src/render (not people-view/ghost-view), kit_v1_textures, goldens PNGs, research/12
- codex sol: TB3 designate-and-build slice (13-tb3-build.log); owns sim command handling, economy, npc build jobs, player, hud messages, ai/build, render/ghost-view.js, main.js, tb3 script, goldens tb3-*
- codex astra: original goldens capture (02c-goldens.log), 175+ shots; asked via `codex queue` to write research/09 now

## Second wave (done)
- codex sol: TB2 sim = original ballistics model + tuning recalibration + AI aim refit (08-tb2-sim.log); owns sim/ballistics,weapons,wind,damage, ai/*, tuning.js, tb1-script.js
- codex sol: kit v1 assets re-authored from ripped references (09-kit-v1.log); owns tools/blender, assets/kit-v1
- codex sol: lane B NPCs (10-laneB.log); owns src/npc
- Opus (lane E agent): HUD likeness pass using ripped SKS UI plates; owns src/ui
- codex astra, unsandboxed: original goldens under Wine, 99+ shots so far (02c-goldens.log)

## Done earlier (first wave)
- codex astra: asset rip of Main.cpr/.tex/.sks -> scripts/rip, assets-ripped/, research/08 (01-rip.log)
- codex astra, unsandboxed: original goldens under Wine -> assets-ripped/goldens-original, scripts/original, research/09 (02c-goldens.log)
- codex sol: lane A sim+world (03-laneA.log); Blender pipeline tools/blender + assets/kit-v0 (04-blender.log); lane C ai (05-laneC.log); lane F plugins (06-laneF.log)
- Opus: lane D render (agent that wrote DESIGN.md); lane E player/ui/audio (fresh agent)

## Remaining
- Orchestrator: src/main.js wiring once lanes A, D, E, F land; Phase 1 acceptance run; HUD likeness gate against original goldens; commit lane outputs per lane.
- Phase 2 (NPCs, lane B), Phase 3, Phase 4 per DESIGN 11.

## Key techniques
- Model routing: Opus = design/render/UI; codex gpt-6.1-sol xhigh = coding lanes + Blender; codex gpt-6-astra xhigh = RE + computer-use loops (needs `-s danger-full-access` for Wine/X11, user-approved); Sonnet = research/mechanical.
- `codex exec resume` ignores -m; start fresh sessions to change model. Prompts go via stdin (`-`), never after `-i`.
- Only the orchestrator runs git. Lanes own disjoint paths (DESIGN 9).

## Issues touched
- beads epics castle-game-5se (Phase 0, in progress), -ot9, -byt, -uo7, -ko3.

## Next step
- When TB3 and look-loop land: commit per session, re-capture goldens, send video; then TB4 = full weapon set as plugins (catapult, trebuchet, ballista, Hellfire...) + biomes, TB5 = human slots/hot-seat.
- Earlier note: When TB2 sim lands: re-capture goldens (tb1-first-shot values change), wire npc hooks + crew gate into sim.js/weapons.js (orchestrator), switch renderer to kit-v1, then TB2 = 'duel that feels original' slice with a video; then the astra computer-use look-and-feel loop vs assets-ripped/goldens-original.

## Previous Sessions
- 2026-10-17 session 1: everything above.
