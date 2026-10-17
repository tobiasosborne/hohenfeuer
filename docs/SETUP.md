<!-- owns: how to pick this project up on a new machine, including everything that is git-ignored. -->
# Setting up Hohenfeuer on a new machine

Everything needed to run, test and develop the game is in git. Everything that is git-ignored is
either a build product, a cache, a download you can repeat, or evidence you can regenerate with a
script in the repo. This page lists each ignored path and the command that recreates it.

## 1. Run and develop (required)

Prerequisites: Node 24.11.1 (`.node-version`; `engines` in `package.json`), npm 11, Linux or macOS.
No system packages beyond what Chromium needs (on Debian/Ubuntu: `npx playwright-core install-deps chromium`).

    git clone https://github.com/tobiasosborne/hohenfeuer.git && cd hohenfeuer
    npm ci                                  # exact versions from package-lock.json
    npx playwright-core install chromium    # headless browser for tests and goldens (~/.cache/ms-playwright)
    npm run dev                             # open the printed URL; Quick start on the title screen
    npm test                                # node --test unit suite (about 90-200 s)
    npm run test:browser                    # SwiftShader smoke test, writes test-results/
    npm run goldens                         # 48 fixed-pose screenshots compared at 0.1% tolerance
    npm run build                           # production build to dist/

Read order for a new contributor: `CLAUDE.md`, `docs/DESIGN.md`, `research/00-scoping-decisions.md`,
`HANDOFF.md`. The current gameplay evidence trail is `research/15` to `research/22`.

Issue tracking uses beads (`bd`, https://github.com/steveyegge/beads). The Dolt database under
`.beads/` is machine-local and ignored; the tracked snapshot is `.beads/issues.jsonl`.

    bd init                      # once per clone, then:
    npm run beads:import         # loads issues and memories from .beads/issues.jsonl
    npm run beads:export         # run before committing when issues changed

## 2. Ignored paths and how to recreate them

| Path | What it is | Recreate with |
|---|---|---|
| `node_modules/` | dependencies | `npm ci` |
| `dist/` | production build | `npm run build` |
| `test-results/` | browser-test and golden diff output | `npm run test:browser`, `npm run goldens` |
| `~/.cache/ms-playwright/` | Chromium 1248 for playwright-core 1.64.1 | `npx playwright-core install chromium` |
| `.beads/dolt/` and runtime files | beads database | `bd init && npm run beads:import` |
| `codex-logs/*.log` | raw transcripts of codex worker runs | not needed; prompts and final reports are tracked next to them |
| `tests/evidence/critique-v2/*.json` (large) | per-second sweep trajectories | section 4 |
| `downloads/` | the original game (2.1 GB) | section 3, optional |
| `assets-ripped/` | reference-only rip of the original's assets (3.2 GB) | section 3, optional |
| `research/screenshots-myabandonware/`, `research/manual-*.txt` | third-party reference material | section 3, optional |
| `*.wine*` | Wine prefix with the original installed | section 3, optional |

Nothing under `assets-ripped/`, `downloads/` or the screenshots is ever shipped or committed
(CLAUDE.md law 4). The game runs without any of it: shipped assets live in `assets/` and `src/`.

## 3. The original game as a reference (optional)

Needed only for likeness work: comparing against the 2001 game, re-ripping tables, re-capturing
original screenshots. Treat every download and extracted archive as untrusted data: never run it on
the host, only inside the Wine prefix; run Python over it with `python3 -I`.

1. Download Ballerburg: Castle Siege (Ascaron, 2001, English CD image) from
   https://www.myabandonware.com/game/ballerburg-castle-siege-uy0 into `downloads/en-iso/`
   (zip sha256 `29fb7b28…b3ac`, see `downloads/en-iso/SHA256SUMS` on the original machine). The
   image inside is a raw 2352-byte-sector Mode 2 dump, which 7z refuses; convert and extract:

        cd downloads/en-iso && unzip Ballerburg-Castle-Siege_Win_EN_ISO.zip
        python3 -I ../../scripts/rip/raw2iso.py Castle.Siege.Ballerburg.iso castle-siege-2048.iso
        7z x castle-siege-2048.iso -oiso          # gives iso/Ballerburg.exe, iso/Data/Main.cpr, iso/Graphics, iso/Videos

2. Rip reference assets, tables and thumbnails (no CD code is executed):

        python3 -I -B scripts/rip/rip_all.py downloads/en-iso/iso assets-ripped --render
        python3 -I -B scripts/rip/make_report.py assets-ripped research/08-iso-formats-and-rip.md
        python3 -I -B scripts/rip/exe_tables.py          # weapon, cost and ballistics tables (research/10, 11)
        python3 -I -B scripts/rip/castles_to_defs.py     # regenerates src/plugins/castles/generated/

3. Run the original for screenshots (Linux): portable Wine 11.19 wow64 from
   https://github.com/Kron4ek/Wine-Builds into `~/Apps/wine-11.19-wow64`, prefix `~/.wine-castle`
   (paths in `scripts/original/common.sh`). Then `scripts/original/configure.sh` (maps the CD),
   `scripts/original/launch.sh --install` (click through Inno Setup once), `launch.sh`, `shot.sh`,
   `record.sh`, `weapon-series.sh`. The 120 captured originals are catalogued in research/09; they
   are local references only.
4. Re-author the block and weapon kit: Blender 4.5.14 LTS at `~/Apps/blender-4.5.14-linux-x64`
   (portable tarball from blender.org), then `tools/blender/README.md`. The generated GLBs in
   `assets/kit-v1/` are tracked, so this is only needed to change them.

## 4. Regenerating gameplay evidence

Every number in research/16 to research/22 comes from headless scripts with explicit seeds:

    node scripts/sweep.mjs --seeds 20 --swap-slot --label mine --workers 8     # 40 paired AI duels
    node scripts/sweep.mjs --matches 60 --ai-levels 3,5,8 --label levels
    node scripts/sweep.mjs --matches 20 --levels 3,8 --label unequal
    node scripts/novice.mjs                                                     # scripted novice vs AI 2/5/8
    node scripts/critique-metrics.mjs tests/evidence/<label>.json              # summaries used in the reports

Outputs land in `tests/evidence/`. Trajectories larger than about 2 MB are git-ignored by pattern;
the summaries and reports are tracked. The sim is deterministic, so a given seed, map and source
tree reproduce the same hashes (each sweep JSON records its source fingerprint).

## 5. Worker models (how the work was produced)

The orchestrator is Claude (Fable) in Claude Code; sim, AI, NPC and Blender lanes ran on
`codex exec -m gpt-6.1-sol`, test and critique loops on `codex exec -m gpt-6-astra`, research on
Sonnet, design and render on Opus. Prompts are in `codex-logs/NN-*-prompt.md` and final reports in
`codex-logs/NN-*-final.md`; neither is needed to build or run the game.
