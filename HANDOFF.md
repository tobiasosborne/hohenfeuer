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

Updated 2026-10-17 ~20:05 AEDT by the orchestrator (Fable). Read order: docs/DESIGN.md -> research/00-scoping-decisions.md -> this file.

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

## In flight (third wave, launched ~20:00)
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
