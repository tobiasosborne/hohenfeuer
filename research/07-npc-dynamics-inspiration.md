# 07 - NPC dynamics inspiration for Hohenfeuer (Dwarf Fortress, Timberborn, others)

Status: web research via WebFetch/WebSearch, 2026-10. Numbers marked (wiki) were returned by the cited page; (design) are our proposals. Wiki pages for DF are partly migrated from v0.47 and the wiki itself flags some as unverified. Stronghold detail was NOT retrievable (fandom returned HTTP 402; search was thin), so its section is low confidence.

## 1. Dwarf Fortress

Sources: [Stress](https://dwarffortresswiki.org/index.php/Stress), [Job](https://dwarffortresswiki.org/index.php/Job), [Burrow](https://dwarffortresswiki.org/index.php/Burrow), [Tantrum](https://dwarffortresswiki.org/index.php/Tantrum), [Pathfinding](https://dwarffortresswiki.org/index.php/Pathfinding).

### Jobs, labors, priority
- Jobs are created by designations, zones, workshop tasks, manager work orders. "An idle dwarf who does not have that labor disabled will be assigned the job." So: world emits jobs; idle workers pull them; the player only toggles who may do what (work details: only selected / everybody / nobody; "specialised" dwarves take only their own workshop tasks).
- No numeric job priority is documented on the wiki; ordering is mostly via labor eligibility. Needs (eat, sleep, drink) pre-empt workshop jobs.
- Tools are claims: miner/woodcutter/hunter are exclusive tool labors; a tool must be unforbidden, unheld, and path-reachable. If not, the dwarf does something else.
- Hauling gives no skill and is not faster with skill; the wiki advises dedicated unskilled haulers because hauling can swamp skilled workers (Job page). Lesson: hauling is a separate cheap role.
- Tasks screen lists current/queued/suspended jobs and who does them: legibility.

### Burrows (civilian shelter)
- A burrow is a player-painted area; assigned citizens accept jobs only inside it and will not leave to fetch materials. It does not restrict movement (idle dwarves may wander). A job needing outside items is cancelled and may loop (Burrow page).
- The old one-button "civilian alert" (everyone to burrow) was dropped in v50; workaround is a suspended burrow that is activated on threat. Lesson: a single "shelter!" toggle on a prepared zone is the right UX, and it should be one key.
- Squads can be given "Defend Burrows"; active military orders override burrow assignment.

### Stress and the tantrum spiral
- Long-term stress thresholds: Stressed +25,000, Haggard +50,000, Harrowed +100,000; range -50,000..120,000. Short-term stress -100,000..100,000. Breakdown needs BOTH high short- and long-term stress (Stress page).
- Long-term stress moves at most about +20,160 / -43,564 per year, i.e. slow in, slower out.
- Feeds: death, corpses, miasma, trauma, rain/sun exposure, no decent meals, bad furniture, no alcohol, no prayer. Reduces: bedrooms, dining rooms, meaningful work, training, family/pets.
- Personality: bravery slows buildup; stress vulnerability sets the break point; anxiety sets dissipation speed.
- Breakdown types: tantrum, depression, oblivious wandering; harrowed dwarves seeing a death may go insane.
- Tantrum spiral (Tantrum page, DF2014 numbers): tantrum lasts several days; a prone dwarf snaps about once per month; tantrum damage (injuries, destroyed masterworks) and harsh punishment stress others, so one break can cascade. Wiki says current-version mechanics are "not well known".
- Key design takeaways: (a) two-layer stress (fast mood plus slow baseline) so a bad minute is not a doom; (b) per-individual variance; (c) the cascade comes from breaks themselves creating new stress events.

### Traffic
- Traffic designations: high / normal / low / restricted; restricted raises path cost and is expensive to compute, so keep areas small. Numbers not on wiki. Lesson: soft costs, not hard walls, for routing runners.

## 2. Timberborn

Sources: [Well-being](https://timberborn.wiki.gg/wiki/Well-being), [Haulers](https://timberborn.wiki.gg/wiki/Haulers), [Workers](https://timberborn.wiki.gg/wiki/Workers).

- Workplaces have worker slots (Hauling Post 10, Builders' Hut 4, District Crossing 10; Mine 10 per Workers page, not confirmed). Employment panel shows filled slots, vacancies, unemployed. Efficiency drops when workers idle or move goods; the wiki recommends nearby storage and enough haulers.
- Haulers: full-time, move goods between buildings that store/consume/produce; go straight from task to task anywhere in the District, so small districts are efficient; idle haulers wait in the post doorway. "Prioritize Haulers" setting sends them to construction first. Builders fetch materials from the nearest holder. Unemployed workers do not haul.
- Well-being score from fulfilled needs gives bonuses to work speed (adults), growth, move speed, life expectancy. Table is roughly stepwise with a work speed bonus of +20% per milestone; max +260% at score 70+ (Update 7). Low scores (<=1) give 0%. Important: well-being is a BONUS ladder, not a penalty cliff; hunger/thirst/injury are separate modifiers.
- Wiki pages do not document unreachable-path alerts or shifts in detail (Workers page: gatherers show "Nothing to do in range"; wonders work in working hours). From general knowledge, not cited: the game shows no-path and no-worker icons over buildings. Treat as unverified.
- Takeaways: slots with proportional output; one dedicated hauler building class; bonus-based morale.

## 3. Other games (short)

- RimWorld [Mental break](https://rimworldwiki.com/wiki/Mental_break): mood 0-100%. Minor break below 35%, major 20%, extreme 5%; mean time between breaks once below: 4 d, 0.8 d, 0.5 d. After a break, catharsis gives +40 mood for 3 days: this is the built-in spiral guard. Traits shift thresholds additively.
- Stronghold (low confidence; [Stronghold 2001 summary via search](https://giantbomb.com/wiki/Games/Stronghold_2001)): popularity driven by housing, tax, food rations, ale, religion; fear factor trades popularity for work output. Engineers build siege engines (they are a consumed role). Lesson: one visible popularity number with a few player dials (rations/tax). Exact leave thresholds not verified.
- Rampart ([Wikipedia](https://en.wikipedia.org/wiki/Rampart_(video_game)), [StrategyWiki](https://strategywiki.org/wiki/Rampart/Gameplay)): timed battle / build-repair phases; territory not fully enclosed is lost with its cannons; too many cannons make repair hard. Lesson: repair as a time-boxed mini-goal with an explicit fail condition (unenclosed = lost).

## 4. Proposed Hohenfeuer ruleset (small, 2-3 agents, ~1 week)

All numbers (design) defaults, to be in one `tuning.json`.

### Roles and counts for population P (typical P = 40)
- Gun crew: 40% of P pool, assigned to weapons.
- Runners (ammo/powder): 15% (min 3).
- Masons (repair): 15% (min 2).
- Civilians (hit points, income, flee): remaining 30%.
- One state machine for every NPC: IDLE -> (claim job) -> WALK -> WORK -> IDLE; plus FLEE, SHELTER, DEAD. Role is a skill tag, not a class; crew can be reassigned (DF work-detail idea).

### Job queue and claim system
- One global list of Jobs {type, target blockId/weaponId, priority 0-3, claimedBy, reachable}. Emitters: player designations, gun needs ammo, block damaged.
- Idle NPC picks highest priority, then nearest reachable job whose role tag matches, and sets claimedBy (item-claim like DF tool claims). Claim expires if NPC dies, flees, or path breaks (reachable=false); the job returns to the queue.
- Player designations show as colored block outlines (orange = repair, blue = build, green = man gun) and the world-space icon with a "n/N" slot count, plus red "unreachable" icon (Timberborn-style intent legibility). Draw the claimant's path line when looking at a job.

### Weapons: crew slots and reload
- Each weapon has N slots (light cannon 3, heavy cannon 5, mortar 4, ballista 2).
- Fire needs all of: powder charge loaded, round loaded, crew >= minCrew = ceil(0.6 N).
- reload = base * N / max(minCrew, crewPresent) * (1.5 - 0.5*workSpeed), crewPresent capped at N; base: light 6 s, heavy 12 s, mortar 10 s. workSpeed = morale multiplier (below). Below minCrew: cannot fire.
- Efficiency scales roughly linearly with crew to N, like Timberborn slots.

### Ammo hauling
- Magazine = one building with stock S_max = 20 shots (design). Each shot consumes 1 shot-unit; a weapon holds a 2-shot buffer.
- Runner carries 2 shot-units per trip along the shortest reachable path magazine -> weapon; speed 3 blocks/s, 2 when carrying. Weapon posts an Ammo job when buffer < 2. Magazine hit = explosion chance (design; risky, big fun) that kills nearby NPCs.
- Soft traffic cost: stairs/doors cost 2x so players can shape routes by building (DF traffic idea). Max 1 detour recompute per second per NPC.

### Repair designations
- Damaged block (hp < 50%) auto-posts a low-priority Repair job; player can press a key to mark it priority 3.
- Mason repairs 1 block per 8 s plus 1 stone-unit from the stock; destroyed blocks need a Build designation (block cost from income).
- Masons refuse jobs in the active fire zone unless morale >= 60 (fear gating).

### Morale (one number, 0-100 per castle, default start 70)
Inputs per second/event:
- Own NPC killed: -2 (crew) / -1 (civilian) per death, decay of event over 30 s.
- Hit on ruler's hall: -4 per hit; hall below 50% hp: continuous -0.2/s.
- Our hit on enemy: +2; enemy block destroyed: +3; enemy weapon destroyed: +5.
- Food/shelter: rations ok +0.1/s toward 70 else -0.2/s; civilians in shelter +0.05/s.
- Time under fire: -0.1/s while any enemy shot landed within the last 10 s.
- Two layer (DF idea): fast = the above; baseline recovers toward 50 at +/-0.5/s. morale = 0.7*fast + 0.3*baseline.
Effects:
- Work speed multiplier: morale >= 70: 1.1; 40-70: 1.0; 20-40: 0.8; <20: 0.5.
- Flee threshold per NPC = 25 + random(-10,10) for civilians, 10 + random(-10,10) for crew (personal variance). Fleeing NPCs go to nearest shelter, then return when morale > threshold + 15 (hysteresis).
- Desertion: morale < 15 for more than 20 s: 1 NPC per 10 s leaves (pop and income fall).
- Surrender / loss: morale < 5 for 30 s, or pop < 30% of start, or hall destroyed.

Spiral guards (RimWorld catharsis + DF slowness):
- Floor: morale cannot fall below 10 from event penalties alone (only desertion rules can then end it).
- Rally: first successful hit after morale < 30 gives +15 once per 60 s.
- Penalty from deaths capped at -15 per 10 s window.
- Deserted/dead only count once; no feedback from desertion into morale.

### Player orders (first person, one key each)
- Look at block, key B: build/repair designation (toggle). Look at weapon, key E: man this gun (auto-assigns nearest idle crew up to N); key Q: release. Key X: shelter (all non-crew go to the marked shelter room; press again to release). Key R on a weapon: prioritize ammo run. Hold to see all job markers.

### Risky to balance
- Reload formula and crew count together set the whole pace; tune first with fixed morale.
- Morale numbers: whole penalty/benefit sizes are guesses; playtest with logging; ensure comeback is possible.
- Pathing: runner jams on stairs, unreachable cases after block destruction; need robust claim expiry.
- Magazine explosions swing games; make optional.
- Fear gating of masons may deadlock repair during sustained fire.
- AI opponent must use same rules or the player will feel cheated.
