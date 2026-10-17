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
