# HANDOFF — Hohenfeuer

Updated 2026-10-17 ~19:00 AEDT by the orchestrator (Fable). Read order: docs/DESIGN.md -> research/00-scoping-decisions.md -> this file.

## What was done
- Scoped with Tobias (3 Socratic rounds) -> research/00. Ground truth in research/01..07.
- Original CD downloaded (downloads/en-iso, raw 2352-byte image converted and extracted to iso/), manuals, NoCD. Game installed under Wine (~/.wine-castle, C:\Program Files (x86)\Ballerburg) with Tobias clicking the installer.
- Wine 11.19 wow64 at ~/Apps/wine-11.19-wow64, Blender 4.5.14 at ~/Apps/blender-4.5.14-linux-x64.
- Scaffold (vite, three 0.186.1, node --test, Playwright SwiftShader harness, goldens script), CLAUDE.md laws, beads epics Phase 0-4.
- docs/DESIGN.md v1 (Opus), src/contracts.js + src/tuning.js v1 (Opus), rules-purity/cleanroom tests, 96 semantic manual goldens.

## In flight (all launched 2026-10-17 evening; logs in codex-logs/*.log, finals in codex-logs/*-final.md)
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
- Collect lane reports, commit each lane, write src/main.js, run Phase 1 acceptance.

## Previous Sessions
- 2026-10-17 session 1: everything above.
