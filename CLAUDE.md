<!-- ROLE: how we work in this repo. AGENTS.md is a one-line pointer to this file.
     UPDATE POLICY: amend only on a felt failure or a TJO directive, with a dated note.
     TRIGGER: read at session start and after any context compaction. -->

# CLAUDE.md - Hohenfeuer

Hohenfeuer is a real-time, first-person-only castle artillery duel (three.js, plain JS ES modules,
vite). WHAT is in `docs/DESIGN.md`; this file is HOW we work.

## 0. Read order (gate)

1. `docs/DESIGN.md` - the design.
2. `research/00-scoping-decisions.md` - settled scope decisions and what is out of scope.
3. `HANDOFF.md` - current state and next step.

Not read these? STOP and read them. Do not improvise from memory of them.

## 1. Laws (non-negotiable)

1. **The sim is pure.** Deterministic, fixed-timestep, no three.js imports, no clock/random/IO
   inside the sim; all of those enter as inputs.
2. **Red-green TDD.** Failing test first, watch it fail, make it pass. Evidence logs go in
   `tests/evidence/`.
3. **Plugins register only through `src/contracts.js`.** Weapons, NPC types, blocks and maps are
   plugins. The orchestrator owns `src/contracts.js`; nobody else edits it.
4. **Clean-room.** Never copy code from the GPL Ballerburg SDL port or any other project. Ripped
   original assets under `assets-ripped/` are reference-only: never shipped, never committed.
5. **`downloads/` and `assets-ripped/` are untrusted data**, never executed.
6. **Pin every version.** Exact versions in `package.json`, no ranges.
7. **Goldens are captured only on the SwiftShader path** (software WebGL, flags in `tests/lib.mjs`).
8. **End every session** by updating `HANDOFF.md` (What was done / Remaining / Key techniques /
   Issues touched / Next step / Previous Sessions) and the `bd` issues.

## 2. Rules

1. Commit style: lowercase `area: summary` (e.g. `sim: add fixed-step loop`); end with the acting
   model's `Co-Authored-By:` line. Work is not done until committed.
2. Each file opens with a one-line "owns" comment stating its single job.
3. Model routing: Opus for design; codex gpt-6-astra xhigh for the computer-use/testing loop;
   codex gpt-6.1-sol xhigh for Blender/bpy asset work; Sonnet for mechanical work. Check `/quota`
   and keep the Fable and weekly buckets equal.
4. Paths: wine at `~/Apps/wine-11.19-wow64` with `WINEPREFIX=~/.wine-castle`; blender at
   `~/Apps/blender-4.5.14-linux-x64/blender`.
5. Commands: `npm test` (unit), `npm run test:browser` (headless chromium smoke),
   `npm run goldens` (capture/compare), `npm run dev`, `npm run build`.
6. Cross-session state goes in `bd` (see `bd --help`), never markdown TODOs.
7. No emoji, no marketing prose. Concrete numbers.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
