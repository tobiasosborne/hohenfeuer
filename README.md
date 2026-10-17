# Hohenfeuer

Hohenfeuer is a real-time, first-person-only castle artillery duel, modelled on Ballerburg: Castle
Siege (Ascaron, 2001). Castles are coarse block structures; you play the mortal ruler walking your
own ramparts, designating blocks, weapons and repairs, and manning guns or ordering crews. NPCs gate
everything: gun crews, ammo runners, masons, and civilians as population and hit points, with one
morale number per castle. Opponents are AI castles in slots that humans can take over. Weapons, NPC
types, maps and blocks are plugins.

## Run

    npm install
    npm run dev            # vite dev server
    npm run build          # production build to dist/
    npm test               # unit tests (node --test)
    npm run test:browser   # headless chromium (SwiftShader), writes test-results/
    npm run goldens        # capture/compare fixed-pose screenshots

The browser tests need Playwright's chromium: `npx playwright install chromium`.

## Docs

- `docs/` - design (`docs/DESIGN.md`).
- `research/` - scoping decisions, original-game ground truth, runtime environment, prior art.
- `CLAUDE.md` - working conventions; `HANDOFF.md` - current state.
