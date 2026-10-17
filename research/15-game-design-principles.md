# 15 - Game design principles applied to Hohenfeuer

Purpose: a practical digest of established game-design thinking, filtered through what Hohenfeuer is
(DESIGN.md sections 1, 3.7, 3.8, 4.6, 6, 11 and research/00-scoping-decisions.md), ending in a scored
critique rubric (section 7) for a critic agent. Written 2026-10-17.

**Evidence policy.** Sources were found by web search (summaries, not full-text reads). Each claim is
tagged: [S] = supported by a cited source I retrieved; [K] = well-known framework I am summarising from
general knowledge, with a pointer to the primary work but not re-verified this session; [J] = my own
judgement/synthesis for Hohenfeuer. Where a search could not confirm a detail I say so. Numbers from the
RimWorld wiki and similar are community-maintained and vary by version.

## 0. Hohenfeuer in design terms (what the principles must fit)

- Fantasy/aesthetic target (MDA "A"): being the besieged-and-besieging ruler, a mortal person on the
  walls of a stone castle; tension of a long-range duel; mastery of aim and wind; the small drama of
  keeping a living castle running under fire. Discovery (what happens if I shoot the magazine?) and
  fellowship-with-NPCs are secondary targets. [J]
- Mechanics: 190 m arcing shots with wind; gold per shot; designations carried out by masons; crews and
  runners gating guns; morale M with flee/desertion/surrender; palace < 30% or ruler death or
  M <= 10 for 45 s ends a castle (DESIGN 3.7); AI that plays by the same rules (6.2).
- Intended match: 12-16 min per the brief; DESIGN 3.8 says 12-20 min vs AI level 5. Single continuous
  real-time loop, no build/battle phases (scoping round 3).
- Structural tension to manage throughout: the player is simultaneously gunner, foreman and
  commander, and has one body. Almost every principle below reduces to "make that triple role a
  series of interesting, legible, time-pressured trade-offs rather than chores."

---

## 1. Core loop design

### 1.1 Frameworks, in the form we will use them

**Interesting decisions (Sid Meier).** Meier's maxim that a game is "a series of interesting decisions"
dates to GDC 1989 and was revisited in his GDC 2012 talk "Interesting Decisions" [S: GDC 2012 coverage,
https://www.gamedeveloper.com/design/gdc-2012-adds-meier-inafune-i-league-of-legends-i-talks ; talk
video listed at https://gamedeveloper.com/design/video-sid-meier-explores-interesting-decisions-in-gameplay].
The searches did not return a formal definition, so the working test below is mine [J], consistent with
the commonly cited discussion at https://www.gamedeveloper.com/design/designing-interesting-decisions-in-games-and-when-not-to-:
a decision is interesting when (a) there is no always-best option, (b) the player has enough
information to reason, (c) the consequence shows up soon enough to be attributed to the choice,
(d) the choice expresses player style or risk appetite.

Applied: "fire now vs repair the cracked magazine wall first" is interesting. "Press F to fire the gun I
already aimed" is not. If the best play is always "queue max builds, stand at the cannon", the build
system has failed.

**MDA (Hunicke, LeBlanc, Zubek).** Designers control Mechanics; players experience Aesthetics; Dynamics
(runtime behaviour of mechanics under play) sit between and are what we actually have to tune [S:
https://users.cs.northwestern.edu/~hunicke/MDA.pdf ; summary via search]. Use: do not judge a mechanic
by its spec, judge the dynamic it produces in a headless AI-vs-AI log and in play. Our headless harness
(DESIGN 11, acceptance 9) is a dynamics probe: read it for emergent patterns (turtling, gold hoarding,
draw-out stalemates), not only for "ends with a winner".

**Schell's lenses.** The Art of Game Design offers ~100 question sets [S: publisher/library listings,
e.g. https://www.skillsoft.com/book/the-art-of-game-design-a-book-of-lenses-98babe80-f03f-11e6-9dae-0242c0a80b05 ;
lens #1 Experience, #2 Surprise, #3 Fun, #12 Problem Statement per
https://circa.cs.ualberta.ca/index.php/CIRCA:The_Art_of_Game_Design_-_Jesse_Schell ; I could only confirm
the first twelve]. The ones most useful here [K, from the book]: Lens of Surprise (are there
non-scripted moments? a stray ball through a window, a collapse); Lens of Curiosity; Lens of Skill
(what skills, are they the ones we want?); Lens of the Elemental Tetrad (mechanics/story/aesthetics/
technology aligned?); Lens of Meaningful Choices; Lens of Balance (esp. rewards, risk/safety);
Lens of Juxtaposition/Interest Curve. The Interest Curve is the one most directly reused in section 2.

**Koster, theory of fun.** Fun is the satisfaction of learning patterns; boredom arrives when a
pattern is mastered, and games fail by being too easy (nothing to learn) or too hard (no learnable
pattern) [S: reviews/summaries, e.g. https://www.tale-of-tales.com/DramaPrincess/wp/?p=120 ]. Applied:
wind and ballistics are a learnable pattern (the AI even learns it, DESIGN 6.2); the second pattern layer
is castle management (what gets hit, what to repair first, how morale responds). A player who has
solved aiming within 3 matches needs the management layer to carry matches 4-30.

**Flow and the difficulty curve (Csikszentmihalyi).** Flow sits in a channel between anxiety (challenge >>
skill) and boredom (skill >> challenge); to stay in it, challenge must rise with skill [S:
https://www.gamedeveloper.com/design/anxiety-boredom-and-flow ; and a 2024 study of 528 board-game
players found flow higher when perceived skill exceeded perceived challenge, https://link.springer.com/doi/10.1007/s10902-024-00846-4 ].
Practical consequence: err slightly on the "I can do this" side, and give AI levels 1-10 (6.1) so the
player can ratchet challenge themselves. The AI level IS the flow dial; make it easy to raise after a
win. [J]

**Juul on failure.** Players avoid failure, experience it in games, and seek games anyway; in games
failure is felt as personal inadequacy, so it must feel attributable and be followed by another try
[S: https://www.leonardo.info/reviews_archive/jan2014/juul-baetens.php ; https://kids.49thshelf.com/Books/T/The-Art-of-Failure ].
Applied: a loss must be traceable ("I forgot the wind shifted; I let the magazine stay cracked"), and a
rematch must be one click. A death by a single lucky 190 m shot through the ruler (3.7 rule 2) is
exactly the kind of failure that feels arbitrary; see 1.4 and the rubric.

### 1.2 Three time scales of loop

For each: action -> feedback -> consequence -> new decision. [J, built on the frameworks above]

**30 seconds (the shot cycle).** Estimate wind from HUD/flag -> dial azimuth/range on the console ->
fire (gold paid) -> ~3-6 s flight (190 m at the described speeds) -> impact: see/hear block damage,
dust, NPC reactions -> read the miss in azimuth and range -> correct -> reload while doing something
else. Satisfying when: the correction is *computable* (the miss tells you the number to change), the
flight time gives a beat of anticipation, and the reload window is filled with a real alternative
action (walk to the wall, designate a repair, check the crew). Failure mode: if the player just
stands at the gun during reload, the second role (foreman) is not pulling enough weight; if the
reload window is too short to leave the gun, the third role is dead.
The AI reference loop is the same: "measure the miss, correct by alpha, noise decays" (DESIGN 6.2). The
player should be able to see their own convergence the way the AI does; give them the same affordance
(impact marker, last-shot dial values retained). [J]

**5 minutes (the exchange).** Pick a target class (enemy gun, palace shield wall, magazine) -> trade
shots -> take damage -> triage (repair, replace, shelter, re-man) -> morale swings from hits both ways
(4.6 table) -> new target selection. Satisfying when each 5-minute window has at least one
"turn of the screw": a gun lost or gained, a wall breached, a morale rally. Failure mode: a
stalemate where both sides repair exactly as fast as they damage (income 9 g/s vs shot cost; see
section 5).

**Whole match (12-16 min).** Arc from opening ranging shots, through attrition of guns/walls, to a
decisive pressure on palace, ruler or morale. Satisfying when the player can narrate the match
afterwards ("I lost the east tower, panicked, then won by finding the magazine"). See section 2.

### 1.3 Decision density budget

A rule-of-thumb target for this game [J]: in any 60 seconds, the player should face 2-4 real
decisions, and at least one should have a clock on it. Candidate decision types:
(1) aim/target choice, (2) fire now vs wait for wind change, (3) designate repair/build where,
(4) spend gold now vs bank it (cap 4000 g wastes income beyond that), (5) which gun to man vs
crew-order, (6) shelter yes/no, (7) move myself to safety vs stay at the gun.
Count them in the rubric (section 7, criterion 2). Too few -> Koster boredom; too many un-prioritised
-> anxiety. The ruler orders in DESIGN 4.8 ("reticle + one key each") are the right grain: a decision
should cost one glance and one key.

### 1.4 How comparable games structure loops

| Game | What it does well | What it does poorly | Lesson for us |
|---|---|---|---|
| **Ballerburg (Kruse, Atari ST 1987)** | Tiny rule set, two castles over a mountain, hit the king or ruin the economy until he capitulates; derricks, taxes feeding morale, unhappy subjects defect [S: https://en.wikipedia.org/wiki/Ballerburg ; https://www.eckhardkruse.net/atari_st/baller.html?en ]. Two win paths = real strategic choice (assassinate vs strangle). | Turn-based, little real-time pressure; AI quality unrecorded in my sources. | Keep BOTH decisive paths: ruler/palace sniping (3.7 rules 1-2) and attrition/morale (rule 3). Make sure the attrition path is a viable strategy, not just a fallback. |
| **Ballerburg: Castle Siege (Ascaron 2001)** | A castle-defence-plus-siege mix with queens, magic and intrigue per demo coverage [S: hardwareluxx demo thread via search; Wikipedia notes it is unendorsed by Kruse]. | I found no review score for the 2001 title (an 8/10 PC Games listing is dated 2007 and unconfirmed). The scope doc already removes research/spells. | Our own manuals research (06) is the only dependable source for its loop; treat it as such. Do not assume the original was well balanced. |
| **Scorched Earth / Worms** | "Easy to learn, impossible to master" arc-and-wind lobbing; Worms added mobility and personality, escaping Scorched Earth's crater stalemates, and made it comic [S: https://vice.com/en/article/worms-wmd-scorched-earth-artillery-shooter ; https://en.wikipedia.org/wiki/Worms_(1995_video_game) ]. Wind as a per-shot variable keeps the same shot from being solved. | Terrain destruction can make the game "too wide open" per some players; turn-based. | Wind is the artillery game's variety engine: change it often enough to matter and show it clearly. We have no terrain deformation (DESIGN out-of-scope 9) - keep damage legible through blocks instead. |
| **Rampart (Atari arcade 1990)** | Compact loop: place cannons, battle ships, then a timed Tetris-like repair phase; each phase has a different skill and a clock; enclosing castles earns guns; too many cannons can doom your repair phase [S: https://en.wikipedia.org/wiki/Rampart_(video_game) ; https://setsideb.com/?p=8150 ]. The repair puzzle makes damage something you *respond* to, not just suffer. | Phase separation is rigid; repair pieces are larger than gaps (frustration by design). | Our single continuous loop (scoping round 3) loses phase clarity. Compensate by giving the *rhythm* back via other means (section 2.3) so there is still a repair-feeling beat after each volley. |
| **Stronghold (Crusader)** | Wall/tower building matters; siege engines whittle walls; castles as a readable fortress. | AI siege defence criticised as weak/placing buildings outside walls; castle templates are hand-made and the decision logic hard-coded [S: https://stronghold.fandom.com/wiki/Stronghold_Crusader_-_AI_mechanics ; https://steamcommunity.com/app/3024040/discussions/0/596280581879335389/ - anecdotal forum posts]. | AI that cannot use its own castle destroys a siege game. Our AI uses the blueprint it started with and the player's rules (6.2) - verify it actually rebuilds and mans guns (TB2 notes show it fired before crews arrived). |
| **Besiege** | Physics-built machines; failure is vivid and funny; each attempt is a hypothesis. | (Not researched this session; no source retrieved.) | [K] Spectacle of structural collapse sells the fantasy; our "cutting a tower base collapses the tower" (Phase 1 acceptance 6) is the equivalent payoff. Make it visually big. |
| **Kingdom Two Crowns** | Radically simple verbs (drop coins), night waves force a daily rhythm; everything is paid in one currency [S: https://en.wikipedia.org/wiki/Kingdom_Two_Crowns ; https://www.pushsquare.com/reviews/ps4/kingdom_two_crowns ]. | Reviewers say it tells you almost nothing, is slow and hard to read [S: PushSquare review]. | Our single-currency gold is right; our legibility burden is higher. A contrast case for section 3/4. |
| **Mount & Blade sieges** | The drama of climbing a wall under fire; siege weapons as set pieces. | Long-running player complaints that AI ignores ladders/tower bridges, defenders cannot hold ladders, so offence wins regardless [S: Steam discussion threads, e.g. https://steamcommunity.com/app/261550/discussions/0/3955910352557844117 - anecdotal]. | Spectacle fails when the AI cannot play the set piece. Same lesson as Stronghold. |

### 1.5 Loop-level takeaways

1. Wind and ranging is the 30-second hook; castle triage is the 5-minute hook; morale and the two
   win paths are the match hook. Review all three, not only the first.
2. A reload window with nothing worth doing in it is a design bug.
3. A loss must be attributable. Where the rules allow sudden death (ruler hit), give counterplay:
   cover, a throne-cell habit, visible incoming shot (section 4). [J]

---

## 2. Pacing

### 2.1 Tension curve and phases without phases

Schell's Interest Curve and the classic shape: hook, rising action with small valleys, climax,
resolution [K, Art of Game Design]. Our match has no authored phases, so phases must *emerge* from
the systems. Target emergent structure [J]:

| Phase | Approx time | What drives it | Player feel |
|---|---|---|---|
| Opening | 0-2 min | Start gold 2000; rangefinding; first designations. Low risk, learning the wind. | Planning, curiosity |
| Build-up / exchange | 2-8 min | First hits, first repairs, gun attrition, first morale swings. | Rising pressure, triage |
| Crisis | 8-13 min | One side is losing guns/walls/morale; flee and desertion pressure; shelter decisions. | Anxiety, urgency |
| Resolution | to 12-16 min | Palace < 30%, ruler shot, or surrender clock (45 s at M <= 10). | Release or catastrophe |

Without authored beats, something must prevent a flat middle. Candidate emergent drivers already in the
design: wind random walk (3.4), magazine logistics, morale input table, the surrender clock itself as a
visible countdown. Check in playtests that the middle is not a 6-minute plateau (rubric criterion 5).

### 2.2 Match length

12-16 min matches (brief) / 12-20 min (DESIGN 3.8). Rules of thumb [J]: a duel should end before the
player's attention for a single task fades (~15 min of a not-too-novel loop), but needs time for at
least two full exchange cycles (damage -> repair -> counter). Knobs in DESIGN 3.8 order: palace block
hp, palace threshold, direct damage, income. Add a dated-note rule: if >20% of headless runs exceed
the target, shorten via damage, not by raising income (income raises repair capacity and stalls).

Timers: hard match timers are not in scope (sudden death reserved, default off). The surrender clock (45 s)
and morale rally cooldown (60 s) are the only visible clocks; they are the match's heartbeat and should
be on-screen.

### 2.3 Quiet beats and escalation (colony-sim lessons)

**RimWorld storytellers.** Rather than uniform pressure, RimWorld paces threats with storytellers:
Randy fires an event roughly every 1.35 days (random, with a forced major threat after 13 days);
Cassandra uses fixed on/off cycles (about 4.6 on-days, then 6 off-days); Phoebe alternates 8 off-days
with 8 on-days [S: https://rimworldwiki.com/wiki/Randy_Random ; https://rimworldwiki.com/wiki/AI_storytellers ;
community figures, may vary by version]. The lesson is that *predictable calm followed by escalation*
(Phoebe/Cassandra) and *unpredictable* (Randy) are different products. A duel has no storyteller, but the
equivalent is how the pace of incoming fire is modulated: the AI's retarget cadence (60 s), fire delay
by level, and the shelter logic produce the pulses.

**Left 4 Dead's Director.** Build-up, peak, relax; reduce intensity if the team is struggling and add
pressure if play goes quiet [S: https://www.shacknews.com/article/46769/left-4-dead-preview ;
https://shacknews.com/article/82787/how-evolve-assures-action-peaks-and-valleys ; Booth interview via
search]. We should NOT build a director that cheats, but the AI controller can legitimately modulate
*aggression tempo* within the same rules: a general/worrier/daredevil split already gives different
tempos (6.2); an AI that lulls and then commits a barrage is a pacing tool that costs nothing.

**Quiet beats for us.** After a crisis, the player needs 20-40 s of recoverable calm in which repairs
visibly progress (masons working, blocks reappearing) and morale drifts back: this is the Rampart repair
phase reborn as a rhythm instead of a phase. Make sure rebuilt walls are *seen* to rise; that is the
payoff of the designation system. [J]

### 2.4 Comeback vs snowball vs rubber-banding

- Positive feedback (leader gets stronger) makes decisive endings but runaways; negative feedback
  (trailer helped) keeps matches close but can make early play meaningless; the fine line is tuning
  [S: https://www.leagueoflegends.com/en-au/news/dev/quick-gameplay-thoughts-2-25-comeback-mechanics/ ;
  https://lawofgamedesign.com/2014/08/25/theory-rubber-bands/ ;
  https://game-wisdom.com/critical/rubber-banding-ai-game-design ]. Riot's position: comebacks must be
  earned by skill, not handed [S]. Hidden catch-up in a skill game is resented [S: FIFA 17 rubber-banding
  complaints via https://techraptor.net/content/fifa-17-enraged-data-mine-rubber-banding ].
- What Hohenfeuer already has. Positive: destroyed guns cannot hit back; fewer hands = slower reload;
  low morale = work speed 0.5 (4.6) -> classic death spiral. Negative: rally +15 once per 60 s; the
  floor of 8; shelter bonus; income fixed per castle (not tied to kills); the 4000 g cap.
- Judgement [J]: the design is roughly right (strong positive loop on damage, bounded by explicit guards)
  but verify two things in headless runs: (a) win rate of the side that scores first hit (target 60-75%,
  not 90%); (b) fraction of matches where the loser was ahead at minute 8 (target > 10%, which is the
  evidence a comeback is possible).
- No hidden rubber-band: the AI uses identical rules (6.2). Keep that, and expose any catch-up the
  player can use explicitly (rally, shelter).

### 2.5 Pacing takeaways

1. Emergent phases need visible clocks and visible state, otherwise the middle feels like noise.
2. Calm must be earned and legible; the repair beat is the calm.
3. Decide whether the match should usually end by palace/ruler (fast, sniping) or by morale (slow).
   Currently the three conditions race; measure which one ends headless matches and tune so that
   attrition ends the majority and the snipe is the exciting minority. [J]

---

## 3. Incremental discovery and onboarding

Out of scope: tutorial levels, campaigns (DESIGN section 1). So onboarding must live in the first match
and in the first 5 minutes of it.

### 3.1 How games teach without tutorials

- **Portal.** Mechanics are introduced in safe rooms; the portal gun is shown in use before the player
  can pick it up; a cube on a button teaches the button; only brief control prompts [S:
  https://adammirkowski.substack.com/p/the-tutorial-is-a-lie ; secondary analysis, not Valve
  statements]. Principle: *safe space to try, then a test, then a twist*.
- **Half-Life.** (Not retrieved this session.) [K] Level geometry and scripted sequences introduce
  verbs in order, with the first combat encounter chosen to demonstrate each tool.
- **Breath of the Wild.** A "chemistry engine" where elements (fire, water, ice) change the state of
  materials, elements affect elements, but materials do not affect each other; the rule set is small and
  consistent, which lets players predict and experiment ("multiplicative gameplay") [S:
  https://gamesbeat.com/the-legend-of-zelda-breath-of-the-wild-makes-chemistry-just-as-important-as-physics/ ;
  https://www.perfectly-nintendo.com/zelda-breath-wild-details-pictures-gdc-2017-panel/ ]. For us: a small
  consistent set of block/weapon/fire/morale rules lets the player *infer* (fire spreads through wood,
  not stone; a cut base drops a tower). Document each rule once and never break it.
- **Into the Breach.** Telegraphed enemy attacks, no hidden hit chance, so each loss feels like the
  player's own fault; the developers took this directly from FTL's lessons [S:
  https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i- ;
  https://www.destructoid.com/review-into-the-breach/ ]. For us: an incoming enemy shot cannot be
  deterministic-telegraphed, but the enemy's *aim state* can be signalled (see 4.3) to deliver the same
  "I saw it coming" feeling.
- **Counterexample.** Kingdom Two Crowns "tells you almost nothing" and learned-by-trial-and-error is
  called obtuse by reviewers [S: https://www.pushsquare.com/reviews/ps4/kingdom_two_crowns ]. Discovery
  without signalling is a risk, not a virtue.

### 3.2 Discoverability tools, ranked for a first-person castle game [J]

1. **In-world signalling:** a mason standing idle by a ghost-block outline; a cannon with a blinking
   "no crew" lamp; wind pennants on towers; a cracked wall that is visibly cracked. Best, no UI cost.
2. **Diegetic HUD (the 2001 brass console):** the console itself carries the numbers; a bound HUD panel
   teaches by being there. Keep each panel to one concept.
3. **Contextual prompts at the reticle:** "E: designate repair (12 g)" appears only when the reticle is
   on damaged blocks. Show once, then fade after N uses (per-profile count).
4. **Tooltips/help overlay:** for the long tail only (morale inputs, reload formula). Not for the
   first-minute loop.
5. **End-of-match debrief:** battle stats (3.7) can add three plain-language "what happened" lines
   (e.g. "Your west tower collapsed after its base was destroyed at 6:12"), which turns the loss into a
   lesson (Juul).

### 3.3 Progressive complexity: what the player learns in match N

Because no campaign exists, progression is per *player profile* across skirmish matches. Proposed
curriculum [J], realised only by *which options are surfaced*, not by locking rules:

| Match | Learn | Surfaced by |
|---|---|---|
| 1 (vs level 1-2 AI) | Walk, climb, aim one cannon, read wind, fire; palace is the target. | Level-1 AI misses a lot (6.2 "barn door"), so a win is forgiving. Only cannon/bombard on the starting loadout. First reticle prompts. |
| 2-3 | Order a crew, see reload speed up; repair a cracked wall by designating it. Gold is finite. | Prompts for crew/designation appear once the first damage is taken. |
| 4-6 | Morale and shelter; magazine logistics; the enemy ruler is shootable. | Morale bar/tooltips surface when M < 40 first time. |
| 7-10 | Weapon mix (straight vs lobbed), replacing lost weapons, targeting guns vs shield walls. | Alternate weapon plugins added to the loadout by player choice (not forced). |
| 10+ | AI tactics (worrier/general/daredevil) and exploiting them; ruler safety; mixed team maps. | AI level ramp suggested after wins. |

Rule of thumb: **no match should require reading more than one new concept's worth of text.** The scope
doc rules out tutorials, so the level-1 AI is the tutorial, and the first match is the whole onboarding.
[J]

### 3.4 Risks specific to this game

- Triple role: the player may learn to aim and never discover designation. Make the first damage event
  trigger a "your wall is cracked: look at it and press X" prompt.
- Designation vocabulary: ghost outlines + cost label before confirm (DF-style planning but 1st-person).
- Hidden causes of death: if the ruler is killed with no context, the learning is zero. Ghost view
  (3.7) is a chance to show a replay of the killing shot and its trajectory. [J]

### 3.5 Onboarding takeaways

1. The first match must be winnable and must force the three roles in small doses.
2. Prefer in-world signals, then reticle prompts, tooltips last.
3. A small consistent rule set beats a large one, because players can predict (BotW).
4. End-of-match debrief is the cheapest teacher.

---

## 4. Feedback and juice

### 4.1 Why it matters at 190 m

The core loop depends on reading cause and effect at a distance. A shot lands 3-6 s later 190 m away;
if the player cannot tell *where* it landed relative to the aim point, they cannot correct (Koster:
no learnable pattern). Juice is not decoration here, it is the instrument panel. "Juice" is abundant
feedback on an interactive element [S: https://www.gamedeveloper.com/business/has-your-game-got-juice-more- ;
Jonasson & Purho "Juice it or lose it" via https://roblog.co.uk/2024/03/juicy-games/ ]. A counterpoint
worth noting: polish that does not fit the world costs immersion [S: same source, Folmer Kelly]. For
Hohenfeuer: juice must be physically plausible (dust, stone chips, camera kick from your own gun) rather
than arcade (score pops). The Vlambeer "Art of Screenshake" talk is cited alongside; I could not retrieve
its contents. [K]

### 4.2 Required feedback events (checklist)

| Event | Must show | Notes |
|---|---|---|
| Own shot fired | Muzzle flash, recoil on the player's camera, smoke, sound with the reload start | Instant (<50 ms), strongest cue in the game. |
| Shell in flight | Visible tracer/smoke trail or at least a tiny dot against the sky; audible whistle approaching enemy shots | Lets the player see whether the shot is going long/short while it is still airborne. |
| Own shot lands | Dust plume sized to blast radius, debris at the true impact point, a delayed sound by distance (audio.falloffM/earshotM in tuning), and a **miss marker** (azimuth/range offset) in the weapon view | The AI measures the miss; the player should be told by sight or HUD. |
| Block damage state | Distinct visual for states 1-3 (kit `_z1.._z3` meshes already exist), crack decals, rubble that does not hide neighbours | Reads at distance; test at 190 m in golden shots. |
| Collapse | A big, slow, loud event: camera shake scaled by distance, dust, sound | The Besiege-style payoff. |
| Enemy weapon destroyed | Distinct audio sting and a +5 morale rally cue | Must be seen from the player's gun position. |
| Own damage | Directional hit indicator, rumble, screen-edge dust, NPC shouts | Player must know where it came from. |
| Morale change | Cheap persistent bar plus a banner on thresholds (M < 40, < 20, < 10) | The surrender clock must show seconds remaining. |
| Gold change | Reservation at designation, refund on cancel, spend on shot | A small ledger line, not a popup storm. |

### 4.3 Telegraphing incoming threats

The player cannot dodge a 3 s lobbed ball at 190 m, but can be told: (a) enemy gun muzzle flash/smoke
visible across the valley; (b) a distinct incoming-whistle audio with a bearing; (c) an optional
"incoming" impact-warning marker for the last 1.5 s that shows landing spot, to let the ruler run
(Into the Breach's "no unfair deaths" idea made feasible); (d) shot trails that persist 2 s. If ruler
death is possible by a single shot (3.7 rule 2), a telegraph is a fairness requirement, not luxury. [J]
A toggle is acceptable in "hardcore" setting. Also telegraph AI *intent*: an AI crew visibly loading, a
visible aim swing in the barrel. That turns the opponent from abstract into someone you can read (6.x).

### 4.4 NPC legibility

Dwarf Fortress is the cautionary tale: a deep simulation with a legibility problem, a steep entry
barrier and a famed ASCII interface; tantrum cascades happen largely off-screen and the player can only
watch [S: https://splittoothmedia.com/?p=1279 ; https://www.pressreader.com/usa/the-guardian-usa/20221117/281990381515092 ;
https://dwarffortressbugtracker.com/view.php?id=9660 ; the "every screen redone" commercial release is
mentioned by search results]. Timberborn's persistent "injured beaver" alert shows the converse:
alerts that cannot be acted on, or that do not say *why*, push out urgent ones; one commenter says the
notification area should hold only what the player must attend to [S:
https://timberborn.featureupvote.com/suggestions/353914/replace-injured-beaver-alert-with-a-inssuficient-medical-beds-warning ].
RimWorld surfaces mood in tiers of "Stressed / On edge / About to break" rather than a raw number
[S: https://rimworldwiki.com/wiki/Mental_break ].

Rules for our 160 NPCs [J]:
1. **Role at a glance:** tunic colour per role (already instanced), carried props (stones for masons,
   powder kegs for runners).
2. **State at a glance:** above-head icon only for exceptions (no path, no ammo to fetch, fleeing,
   waiting for claim). A healthy NPC shows nothing.
3. **Causes, not only symptoms:** "gun idle: no powder" beats "gun idle". The claim system (4.3)
   already knows; surface the reason at the reticle.
4. **Alert hygiene:** at most 4 messages (ui.messageMax already 4), 10 s lifetime; aggregate
   ("3 masons cannot reach the east wall") rather than spam; actionable or cut.
5. **Count aggregates in a small ledger:** crews manned / runners / masons / civilians; morale arrow
   showing the direction of M, not only the value.

### 4.5 What the player must see from the ramparts

(a) The target area and the enemy castle silhouette at 190 m, with wind direction cue on the way
(pennants/smoke); (b) their own cannon status (loaded, crewed, ammo count); (c) their castle's damage
states in the nearest 40 m; (d) mason/crew activity at a glance; (e) the HUD set: compass, wind,
aim dials, gold, morale, selected order. At every golden screenshot ask: can I infer the three most
important facts of the state from the image alone? That is the visual criterion for the critic.

### 4.6 Feedback takeaways

1. Impact feedback IS the aiming instrument; make it measured, not merely pretty.
2. Telegraph threats and AI intent so deaths are attributable (Juul, Into the Breach).
3. Spend alerts like gold: few, actionable, with causes.
4. Keep juice physically plausible.

---

## 5. Economy and systems

### 5.1 Sinks and faucets

DESIGN 3.8: start 2000 g; income 6 g/s palace + 0.25 g per working civilian (about 9 g/s with 40
pop); cap 4000 g; sinks are shots, designations (reserved up front, refunded on cancel) and repairs
(cost x missing fraction x 0.5, paid as the mason works). Standard faucet/sink thinking [K]: income must
be high enough to act, low enough that spending is a choice. Quick arithmetic [J]: over a 14-minute
match, income is about 840 s x 9 g/s = 7,560 g plus the 2000 start. If an average shot costs, say,
30 g, that is far more shots than the reload rate allows, so scarcity would NOT bind on shots alone;
designations and replacements must be the binding sink. The original's gold-per-shot scarcity is the
scarce-resource feel we are trying to keep; check whether fire cost (in tuning) actually makes the
player hesitate. A good test: in headless runs, percent of time gold sits at the 4000 cap (target < 10%);
percent of time near 0 (target 10-25%). Sitting at cap means the player has nothing to decide.

Scarcity creates interesting decisions only when the choice is *between* sinks (fire vs repair vs
replace a gun). Verify that at least one of these three is unaffordable at any given moment mid-game.

### 5.2 Repair vs rebuild

Repair costs half of the missing fraction, rebuild costs full block price (designation reserved). That
asymmetry rewards keeping blocks alive (repair early), and a damaged-but-standing wall still blocks
shots. Good. Risks [J]: (1) repairing a block under fire into a state-1 cracked wall may feel like a
treadmill; show progress and let the player *prioritise* what gets repaired (reticle designation does).
(2) Mason fear gate (4.x) can pause building under fire: that is the Rampart rhythm emerging (build in
lulls) and should be stated in the UI ("Masons will not work under fire").

### 5.3 Why Rampart's phases work, and what to steal

Rampart separates: place (decide), battle (execute), repair (puzzle under a clock). Each phase has a
different cognitive load, each ends on a clock, and damage becomes a problem you solve [S:
https://en.wikipedia.org/wiki/Rampart_(video_game) ; https://setsideb.com/?p=8150 ]. What to steal in a
continuous game [J]: (a) a visible cost/benefit before commitment (the placement decision); (b) a
moment where the player's skill (not only luck) determines whether the castle stays closed (the
designation priority); (c) a "what would I do with another gun" decision loop (weapon placement). What
not to steal: forced idling during other phases; the player is never idle in a continuous loop.

### 5.4 Morale and stress systems that stay fun

**RimWorld mood.** Mood thresholds produce graded breaks: minor, major, extreme at roughly 35%, 20%,
5% of the default threshold, with escalating break frequency, and traits shift the threshold [S:
https://rimworldwiki.com/wiki/Mental_break ; https://rimworldwiki.com/wiki/Mental_Break_Threshold ]. Lesson:
a tiered, named scale is more legible than a raw number and different severities lead to different
consequences.

**Dwarf Fortress.** Stress cascades can spiral: one unhappy dwarf triggers others; later versions
softened the spiral, and a bug-report voice complains that softening it made stress consequence
invisible and weakens the incentive to keep dwarves happy [S: sources in 4.4; the
dwarffortressbugtracker report is a player opinion, not a developer position]. Lesson: a spiral guard
has two failure directions - too weak (death spiral frustrates) and too strong (system ignorable).

**Darkest Dungeon.** At 100 stress a hero makes a resolve check: success yields a temporary Virtue,
failure yields an Affliction that can spread stress; the designer said the system drew on human
experience (Band of Brothers) and was stable through Early Access [S:
https://www.pcgamer.com/uk/how-darkest-dungeon-got-inspiration-from-band-of-brothers-and-aliens ;
https://philarchive.org/rec/CARBAB-5 ]. Lesson: the same stress can produce positive or negative
outcomes. That gives morale **upside** - a heroic surge - not only downside.

**Mapping to 4.6** [J]:
- Existing guards (floor 8, death-penalty cap -15/10 s, rally +15 once/60 s, hysteresis, "desertions
  and surrender do not feed back into M", each death counts once) are well aligned with the lessons.
- The weak point is that morale is almost entirely a punishment gauge. Consider a Virtue analogue:
  when M is in 20-35 and the castle scores a hit on a gun or ruler, the rally already gives +15 once;
  extend to a visible "defiance" moment (work-speed bonus 8 s, audio chorus). That is a design
  suggestion, not a requirement.
- Legibility: M is a hidden composite of F and B (two layers). Show a single number and an arrow; show
  the *reason* line ("Under fire", "Palace below 50%") like RimWorld's mood tooltip lists contributing
  thoughts. Without causes, morale feels random (Juul).
- Check dynamics: percentage of matches where M hit the floor and the castle still won (a comeback
  signal); percentage ended by surrender clock (do not exceed 40%; a "slow quit" ending is anticlimactic).

### 5.5 Systems takeaways

1. Scarcity matters only between competing sinks; verify in logs.
2. Mirror Rampart's rhythm by letting damage create a fix-it task with a visible pace.
3. Morale needs reasons, tiers and a positive side.
4. Spiral guards must be tuned in both directions.

---

## 6. AI opponents

### 6.1 What makes an AI feel like an opponent

- **Shared rules.** The AI plays under the player's rules (6.2). This is the right foundation;
  rubber-banding that cheats is resented [S: https://game-wisdom.com/critical/rubber-banding-ai-game-design ;
  FIFA 17 data-mine complaints via TechRaptor]. If the AI needs help to be competitive, grant it an
  openly stated handicap (level) not hidden numbers.
- **Telegraphing.** The player should read the AI: guns turning, crew gathering, muzzle flash. A
  deterministic AI whose intentions leak lets players form models and gives Koster-style patterns.
- **Personality.** Worrier/general/daredevil (6.1) change what the AI targets and how it spends
  (6.2 weights, reserves, repair share). To be felt, the differences must show up in 2 minutes of watching:
  daredevil goes for the palace/ruler early; worrier repairs; general kills guns. Add flavour barks or
  banners that identify the tactic. [J]
- **Fallibility with learning.** The 6.2 aim model (initial error, correction alpha, noise decay) makes the
  AI converge visibly: first shots miss, then bracket, then land. That is the same pattern the player
  uses, which makes it feel like an opponent rather than a turret. Keep the "wind change resets k" step;
  it generates human-looking re-ranging.
- **Competent use of its own castle.** Both Stronghold and Mount & Blade show the failure mode: AI that
  does not use ladders, siege weapons, or builds outside its own walls (sources in 1.4). TB2 notes
  already log "AI sends FIRE before its crew arrives and never retries": that is exactly this class of
  bug and must be fixed before any play evaluation.
- **Surprise.** Randomised targeting retarget interval (60 s fixed now) makes the AI predictable. Add
  jitter and an occasional 'change of plan' (e.g. a daredevil spending its reserve on a sudden
  weapon). [J]

### 6.2 Difficulty levels

Levels 1-10 map onto the flow channel (section 1.1). Calibration [J]:
- Level 1: "barn door" misses; expected to lose to a brand-new player.
- Level 3-4: a 5-match player wins about 70%.
- Level 5 (default): a competent player wins about 55% in 12-20 min; this is the 3.8 pacing target.
- Level 8-10: first-shot accuracy and rapid corrections; the AI is faster but not omniscient.
- Beware that raising level only raises aim precision and fire delay (6.2). Higher levels should also
  raise *decision quality* (retargeting intelligence, repair priority, shelter timing) or the player
  just meets a better aimbot. Check at level 10 for variety.

### 6.3 Dynamic difficulty

Not planned. If added, make it visible (a suggested level after each match, "try level 6?") rather than
hidden mid-match adjustments. [J]

### 6.4 AI takeaways

1. Same rules, visible handicaps only.
2. Make the AI's convergence and intent watchable.
3. Verify AI competence with its own castle before judging balance.
4. Levels must scale decisions, not only aim.

---

## 7. CRITIQUE RUBRIC (one page)

How to use. Score each criterion 1-5 (1, 3 and 5 are anchored; 2 and 4 are in between). Evidence sources:
**V** = video/screens of play, **D** = DESIGN.md and tuning, **H** = headless matches (AI-vs-AI logs,
hashes, stats). Cite at least one concrete observation per score (timestamp or seed). A criterion with
no evidence scores "n/a", not 3. Sum is out of 5 x 22 = 110; report subscores per group.

### A. Loop and decisions
| # | Criterion | Definition | 1 | 3 | 5 |
|---|---|---|---|---|---|
| 1 | Shot-cycle clarity (30 s) | Player can read wind, set dials, see where the shot landed and compute a correction. | Impact unreadable or no miss indication; trial and error only. | Impact visible but offset must be guessed. | Miss readable in azimuth/range within 2 s; convergence in <= 4 shots at calm wind is routine. |
| 2 | Decision density | Real decisions per minute, with at least one clock-pressured. | Long stretches (> 60 s) with no decision. | 1-2 decisions/min, mostly aim. | 2-4/min across aim, build, crew, gold and safety, with clocks. |
| 3 | Interesting trade-offs | No dominant strategy; choices between competing sinks. | One obvious best play (e.g. spam repair). | Some trade-offs, one dominant opening. | Multiple viable plans (snipe, attrition, turtle) and each carries visible risk. |
| 4 | Role load balance | Triple role (gunner, foreman, commander) is workable but demanding. | One role dominates; others ignorable or impossible. | All three used but with idle waits or overload. | Reload windows are filled with meaningful alternatives; no chores. |

### B. Pacing
| # | Criterion | Definition | 1 | 3 | 5 |
|---|---|---|---|---|---|
| 5 | Match shape | Opening / exchange / crisis / resolution emerge without authored phases. | Flat plateau or abrupt end. | Recognisable arc but dead middle for > 3 min. | Escalation with valleys, a clear crisis and a clean resolution. |
| 6 | Length and variance | Matches fall within target (12-16 min; 3.8 allows to 20) across seeds. | < 8 min or > 25 min in more than 30% of runs. | 60-80% of runs inside the target. | > 80% of runs inside the target with varied outcomes. |
| 7 | Comeback vs snowball | Losing side retains agency; first blood is not decisive. | First hit side wins > 90% (H). | 75-90%. | 55-75%, with comebacks observed from morale low points. |
| 8 | Quiet beats | There are recoverable calm moments with visible repair progress. | Constant pressure or constant idle. | Calm exists but unnoticed. | Calm beats follow crises and show masons visibly rebuilding. |

### C. Onboarding and discovery
| # | Criterion | Definition | 1 | 3 | 5 |
|---|---|---|---|---|---|
| 9 | First-match onboarding | A new player can finish match 1 without external help. | Stuck on controls or roles. | Learns aim; misses build/crew until told. | Learns all three roles through signalling and a forgiving level-1 AI. |
| 10 | Signalling over text | Mechanics are shown in-world or at the reticle before tooltips. | Requires reading docs. | Mixed. | In-world cues explain >= 80% of verbs; text for the long tail only. |
| 11 | Rule consistency | Small set of consistent, predictable rules (BotW style). | Exceptions and hidden interactions. | Mostly consistent. | A player can correctly predict outcomes of an untried action (fire, collapse, morale). |
| 12 | Complexity ramp | New concepts introduced in sequence across matches. | All at once. | Some staging. | One concept at a time, matched to match number. |

### D. Feedback and legibility
| # | Criterion | Definition | 1 | 3 | 5 |
|---|---|---|---|---|---|
| 13 | Impact and distance readability | Cause-and-effect legible at 190 m. | Cannot tell where a shot hit. | Hits visible, damage states unclear. | Dust, debris, damage states and sound all readable at range in golden shots. |
| 14 | Threat telegraphing | Incoming fire and AI intent are signalled early enough to act. | Deaths feel instant and unexplained. | Audio only. | Audio, visual trail and intent cues; every death is attributable on replay. |
| 15 | NPC legibility | Roles, states and causes of stall readable at a glance. | Cannot tell why a gun is idle. | State visible, cause not. | Role, exception icon and cause at the reticle; alerts actionable. |
| 16 | HUD and alert hygiene | Few, actionable, caused messages; one glance state. | Spam or silence. | Adequate. | <= 4 alerts; each says why; all states readable at a glance. |

### E. Systems
| # | Criterion | Definition | 1 | 3 | 5 |
|---|---|---|---|---|---|
| 17 | Economy scarcity | Gold forces choices; not capped, not starved. | Gold at cap > 30% of time or always empty. | Occasional choices. | Gold at cap < 10% and near zero 10-25% of time; at least one sink unaffordable mid-game. |
| 18 | Repair vs rebuild loop | Repair feels rewarding and prioritisable. | Treadmill or ignorable. | Works, little visible progress. | Visible rebuild pace, clear priorities, repair cheaper than rebuild and it matters. |
| 19 | Morale design | Morale is legible, tiered, has reasons and positive swings. | Opaque number; death spirals; or irrelevant. | Legible but punishing only. | Tiers, reason list, rally/defiance upside; guards confirmed in logs (no unwinnable spirals). |
| 20 | Win-path variety | Palace, ruler and surrender paths all occur. | One path ends > 90% of runs. | Two paths. | All three occur; none > 60%; each feels distinct. |

### F. Opponent and failure
| # | Criterion | Definition | 1 | 3 | 5 |
|---|---|---|---|---|---|
| 21 | AI as opponent | AI is readable, fallible, characterful, plays by the rules. | Turret-like or cheating or broken (e.g. fires unmanned). | Competent, indistinct. | Visible convergence, personality visible in 2 min, uses its castle well. |
| 22 | Fair failure and replay | Losses attributable; retry fast; levels scale. | Arbitrary deaths; no debrief. | Mostly attributable. | Each loss traceable (replay/debrief), one-click rematch, level ladder suggested. |

**Verdict bands.** 100+ exemplary; 85-99 strong, fix the lowest group; 65-84 promising, specific
rework required; < 65 loop does not yet hold. Any single criterion at 1 in A, D or F is a blocker
regardless of total. Report format: scores table, top 3 strengths, top 3 failures with evidence, one
suggested tuning change per failure.

---

## 8. The 8 principles that matter most for Hohenfeuer

1. **Impact feedback is the instrument.** At 190 m, readable impact (plus measured miss) is the
   aiming interface (4.2). [J, Koster]
2. **The reload window must be filled with a real alternative action.** That is what makes the triple
   role work (1.2).
3. **Make loss attributable.** Telegraph incoming fire and AI intent; replay the killing shot (Juul,
   Into the Breach).
4. **Emergent phases need visible clocks and a repair beat.** Rampart's rhythm without Rampart's phases
   (2.1, 5.3).
5. **Scarcity must bind between sinks.** Check gold-at-cap in headless runs (5.1).
6. **Morale needs reasons, tiers and upside; guards tuned both ways.** RimWorld, DF, Darkest Dungeon (5.4).
7. **AI shares rules, shows its intent and uses its own castle.** Stronghold and Mount & Blade show what
   happens otherwise (6.1).
8. **Teach in-world, one concept at a time; a forgiving level-1 AI is the tutorial.** (3.2-3.3)

## 9. Source list (as retrieved)

Searches via web search tool, 2026-10-17; summaries only, no full-text reads.
- Meier GDC 2012: https://www.gamedeveloper.com/design/gdc-2012-adds-meier-inafune-i-league-of-legends-i-talks ; https://gamedeveloper.com/design/video-sid-meier-explores-interesting-decisions-in-gameplay ; https://www.gamedeveloper.com/design/designing-interesting-decisions-in-games-and-when-not-to-
- MDA: https://users.cs.northwestern.edu/~hunicke/MDA.pdf ; https://course.khoury.northeastern.edu/cs5150f14/readings/hunicke_mda.pdf
- Schell: https://circa.cs.ualberta.ca/index.php/CIRCA:The_Art_of_Game_Design_-_Jesse_Schell
- Koster: https://www.tale-of-tales.com/DramaPrincess/wp/?p=120
- Flow: https://www.gamedeveloper.com/design/anxiety-boredom-and-flow ; https://link.springer.com/doi/10.1007/s10902-024-00846-4
- Juul: https://www.leonardo.info/reviews_archive/jan2014/juul-baetens.php ; https://kids.49thshelf.com/Books/T/The-Art-of-Failure
- Ballerburg: https://en.wikipedia.org/wiki/Ballerburg ; https://www.eckhardkruse.net/atari_st/baller.html?en
- Worms/Scorched Earth: https://en.wikipedia.org/wiki/Worms_(1995_video_game) ; https://vice.com/en/article/worms-wmd-scorched-earth-artillery-shooter
- Rampart: https://en.wikipedia.org/wiki/Rampart_(video_game) ; https://setsideb.com/?p=8150
- Stronghold: https://stronghold.fandom.com/wiki/Stronghold_Crusader_-_AI_mechanics ; https://steamcommunity.com/app/3024040/discussions/0/596280581879335389/
- Kingdom Two Crowns: https://en.wikipedia.org/wiki/Kingdom_Two_Crowns ; https://www.pushsquare.com/reviews/ps4/kingdom_two_crowns
- Mount & Blade: https://steamcommunity.com/app/261550/discussions/0/3955910352557844117
- RimWorld: https://rimworldwiki.com/wiki/Randy_Random ; https://rimworldwiki.com/wiki/AI_storytellers ; https://rimworldwiki.com/wiki/Mental_break ; https://rimworldwiki.com/wiki/Mental_Break_Threshold
- L4D director: https://www.shacknews.com/article/46769/left-4-dead-preview ; https://shacknews.com/article/82787/how-evolve-assures-action-peaks-and-valleys
- Portal teaching: https://adammirkowski.substack.com/p/the-tutorial-is-a-lie
- BotW: https://gamesbeat.com/the-legend-of-zelda-breath-of-the-wild-makes-chemistry-just-as-important-as-physics/ ; https://www.perfectly-nintendo.com/zelda-breath-wild-details-pictures-gdc-2017-panel/
- Into the Breach: https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i- ; https://www.destructoid.com/review-into-the-breach/
- DF: https://splittoothmedia.com/?p=1279 ; https://www.pressreader.com/usa/the-guardian-usa/20221117/281990381515092 ; https://dwarffortressbugtracker.com/view.php?id=9660
- Darkest Dungeon: https://www.pcgamer.com/uk/how-darkest-dungeon-got-inspiration-from-band-of-brothers-and-aliens ; https://philarchive.org/rec/CARBAB-5
- Timberborn: https://timberborn.featureupvote.com/suggestions/353914/replace-injured-beaver-alert-with-a-inssuficient-medical-beds-warning
- Juice: https://www.gamedeveloper.com/business/has-your-game-got-juice-more- ; https://roblog.co.uk/2024/03/juicy-games/
- Rubber banding: https://www.leagueoflegends.com/en-au/news/dev/quick-gameplay-thoughts-2-25-comeback-mechanics/ ; https://lawofgamedesign.com/2014/08/25/theory-rubber-bands/ ; https://game-wisdom.com/critical/rubber-banding-ai-game-design ; https://techraptor.net/content/fifa-17-enraged-data-mine-rubber-banding

Gaps (not retrieved, tagged [K] or [J] above): Half-Life onboarding, Besiege, Vlambeer talk content,
Tynan Sylvester's own design statements, Meier's formal definition, Ballerburg 2001 reviews, primary Valve
statements on Portal/L4D.
