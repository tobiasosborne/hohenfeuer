# Quota and pacing (reading at 17:50 AEDT Sat 17 Oct 2026)

## Claude quota (~/.claude/scripts/claude-usage; endpoint api.anthropic.com/api/oauth/usage)
Plan max 20x. Extra usage disabled (no overflow credits).
- five_hour (session): 99%, resets 18:00 AEDT. Rolling cap on burst rate.
- seven_day / limits[weekly_all]: 26%, resets Wed 21 Oct 03:00 AEDT (2026-10-20T15:59:59Z).
- limits[weekly_scoped, model Fable]: 21%, same reset.
- weekly_scoped_shares: {used_percent_of_weekly: 11, allowance_percent_of_weekly: 50}.
  11/50 = 22% ~ the 21% shown. So the Fable bucket is a SUB-CAP equal to 50% of the weekly
  allowance, and Fable tokens ALSO count inside weekly_all (11 of the 26 points are Fable;
  15 points are Opus/Sonnet/other). Inference from the numbers, not documented; verify by
  watching both counters move during a Fable-only task.
  So: Fable draws from both Fable and general; Opus/Sonnet draw only from general.
  Fable can hit 100% (50 weekly points) while general is still at ~50%.
- seven_day_breakdown: 100% Claude Code (chat/cowork 0%). Window started Tue 14 Oct 03:00 AEDT.
- iguana_necktie: $250 limit, $250.09 used (100%), resets 5 Nov. Unknown meaning, possibly a
  separate credit/promo pool. Not part of weekly. Ignore, but note it is exhausted.
- No pacing tooling exists in /home/tobias/Projects/claude-usage-audit (grep found none); it is a
  cost-audit project (FINDINGS/ACTION_PLAN), not a quota pacer. The `quota` skill just runs claude-usage.

## Pacing plan
Hours to reset: ~81.2 h (3.38 days). Target end-of-window: 90% for both (10% safety margin).
- General: 26 -> 90 = +64 points, ~18.9 pts per 24 h (~0.79 pts/h).
- Fable: 21 -> 90 = +69 Fable%, ~20.4 Fable% per 24 h (~0.85%/h).
- Because Fable counts in general: Fable +69% = +34.5 weekly points. Remaining general headroom
  for non-Fable = 64 - 34.5 = ~29.5 weekly points, ~8.7 pts/24 h. Fable adds ~10.2 weekly pts/24 h.
  Daily split of weekly points: ~54% Fable, ~46% Opus/Sonnet. Per-day totals: Fable +20.4%,
  general +19.1 (hmm: 10.2 Fable + 8.7 other = 18.9).
- Next 24 h: Fable +20%, i.e. 21 -> ~41%; general 26 -> ~45%; so non-Fable ~ +9 points.
- Gap now: Fable 21 vs general 26 looks "behind", but in weekly-point terms Fable has used 11
  vs others 15, so Fable is the under-used side. Route slightly more to Fable.
- Session cap: 5-hour window is the binding burst limit (99% now). At the even rate (~0.8 weekly
  pts/h) you spend roughly 4 pts per 5h window; do not let one session exceed ~60-70% unless
  needed. Next session starts 18:00.

## Orchestrator rule
Every ~3 h (and before spawning a heavy batch): run `claude-usage --json`; read weekly_all (G),
Fable (F), session (S), hours-to-reset (H).
1. Daily ceilings (measured from the 03:00 AEDT boundary each day): G <= 26+19*k, F <= 21+20*k
   for k = days elapsed since now; hard stop for the window at 90% of either.
2. If S >= 85%: pause Claude agents until the 5-hour reset; use Codex/GPT meanwhile.
3. Next heavy/reasoning task: if F_expected_share_behind (F < (G-26)*2+21 i.e. Fable lags the
   even curve) go Fable; otherwise Opus (or Sonnet for mechanical work). Default heavy = Fable
   (orchestrator + hard reasoning), bulk/mechanical = Sonnet, Opus for coding.
4. If either bucket is above its daily ceiling, route that day's remaining work to Codex.
5. Stop Claude for the day when both daily ceilings reached; never burst more than ~1 session
   window of work back to back.

## Codex / OpenAI
codex-cli 0.163.0; `codex doctor` exists (healthy; note 6,954 rollout files / 4.4 GB). No
usage/limits/status subcommand in `codex --help` (only interactive /status).
Config defaults: model gpt-6.1-sol, effort xhigh, 1M context.
Smoke tests (empty scratch dir), both exit 0 returning "OK astra":
- gpt-6-astra, xhigh: ~5 s, 12.5k tokens
- gpt-6.1-sol, xhigh: ~6 s, 6.7k tokens
Working command:
  cd <scratch> && codex exec -m gpt-6-astra -c model_reasoning_effort=xhigh -s read-only --skip-git-repo-check --ephemeral "PROMPT"
  (same with -m gpt-6.1-sol). Other useful flags: -C DIR, -o FILE (last message), --json, --output-schema FILE.
  For writing work use -s workspace-write.
Computer use: `codex features list` shows computer_use stable = true; ~/.codex/computer-use/
exists and plugin unified-computer-use@openai-bundled is configured. Not exercised.
Images: `codex exec -i FILE...` works (view_image, image_generation features true). Trap: -i is
variadic, so `-i a.png "prompt"` swallows the prompt as an image and blocks on stdin. Put the
prompt first or pipe it on stdin, as ~/.local/bin/codex-vision does (-i placed last, prompt on
stdin; its model is gpt-5.6-luna at medium).
