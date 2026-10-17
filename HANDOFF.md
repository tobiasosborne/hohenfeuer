# HANDOFF - Hohenfeuer

Phase 0 (scaffold and design) is in progress.

## What was done
- Research docs in `research/` (scoping, ground truth, environment, conventions, prior art, manuals).
- Repo scaffold: vite + three.js smoke first-person scene, `src/contracts.js` placeholder, unit
  smoke test, headless-chromium SwiftShader browser test, golden screenshot harness, CLAUDE.md.

## Remaining
- `docs/DESIGN.md` (written in parallel by an Opus agent).
- Fill `src/contracts.js` from `docs/DESIGN.md` (orchestrator only).
- Pure sim core, then block castles, NPCs, weapons, AI slots.

## Key techniques
- Browser tests use `playwright-core` with the cached chromium and flags `--use-angle=swiftshader
  --enable-unsafe-swiftshader`; the harness lives in `tests/lib.mjs`.
- Goldens: poses in `tests/goldens/poses.json`; a missing golden is written, an existing one is
  compared with pixelmatch and a diff lands in `test-results/`.

## Issues touched
- See `bd list` (Phase 0-4 epics).

## Next step
- Read `docs/DESIGN.md` once it lands, define `src/contracts.js` shapes, start the sim with TDD.

## Previous Sessions
- None.
