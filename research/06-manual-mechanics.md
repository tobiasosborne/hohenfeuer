# Ballerburg: Castle Siege (Ascaron 2001) - mechanics from the official manuals

Sources (raw text in this directory): `manual-en.txt` (English, 62 printed pages, NOT 6 as the task brief assumed) and `manual-de.txt` (German, 66 pdf pages, text layer present; no OCR needed).
Citations: "EN p.N" = printed page number of the English manual; "DE §x.y" = German section number (the German printed page numbers differ from its TOC, so sections are the reliable key). Weapon and building numbers were compared EN vs DE; differences are listed in section 9.
Anything not stated in the manuals is marked UNKNOWN. Nothing is filled from memory.

Scope reminder: only the artillery duel in first person matters. Building, research and magic are summarised only so their effects on a duel are known.

---
## 1. Weapons (EN pp.41-49, DE §4.2)

Common terms (EN p.41): *Defence points* = number of hits a weapon can take, 0 = destroyed. *Firing costs* = gold per shot WITHOUT an ammo workshop (with one, ammo cost is reduced by one third, EN p.39). Qualitative fields (damage, radius, drift) are given only as words (very low / low / normal / high / very high / enormous); no numeric values exist in the manual: UNKNOWN. Weapon "Trajectory" is either "normal" (lobbed arc over obstacles) or "straight"; the manual says only that it "indicates whether the weapon can fire missiles over high mountains, or whether it just fires in a straight line" (EN p.41).

Base game rule: initially at most 2 weapons per castle; Add Weapon research raises the cap to 3/4/6/8 (EN p.52). Built weapons are delivered instantly (except Zeppelin, Super Weapon) (EN p.31, p.41).

Mounting: Ground weapons (catapult family, royal weapons) stand anywhere in the castle, always cover 3x3 squares on the overview, and are easy to hit. Wall/tower weapons (cannon family, ballista family, rocket launchers) must be placed on a wall or tower, cover 1x1, are hard to spot, and are better protected (EN pp.25, 30-31).

| Weapon (DE) | Class / mount | Build cost | Def. pts | Reload | Fire cost (no workshop) | Ammo per shot | Direct dmg | Dmg radius | Drift | Fire dmg | Trajectory | Needs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Catapult (Katapult) EN p.42 | ground | 600 | 30 | 18 s | 52 (DE: 53) | 1 rock (Steingeschoss) | low | high | high | medium | normal | none (no smithy) |
| Long John (Langer Fritz), upgrade of Catapult | ground | 600 | 30 | 18 s | 135 (DE: 113) | 3 rocks | low | high | high | medium | normal | none; research 800 |
| Cannon (Kanone) EN p.43 | wall/tower | 750 | half of host wall/tower | 22 s | 90 | 1 iron ball (Metallkugel) | normal | normal (prose says small) | low | none | straight | smithy |
| Double Cannon (Doppelkanone) | wall/tower | 750 | half host | 22 s | 150 | 2 iron balls | normal | normal | low | none | straight | smithy; research 800 |
| Fire Catapult (Feuerkatapult) EN p.44 | ground | 750 | 30 | 24 s | 150 | 1 firebomb | very low | low | low | medium | normal | smithy |
| Hot Helga (Heisse Gina), upgrade | ground | 750 | 30 | 24 s | 225 | 1 wildfire bomb (DE: griechisches Feuer) | very low | low | low | medium | normal | smithy; research 800 |
| Ballista (Ballista) EN p.45 | wall/tower, anti-air | 400 | half host | 15 s | 22 (DE: 23) | 1 bolt | only vs zeppelin: 3 hits to kill | none | very low | none | normal | smithy |
| Fire Ballista (Feuerballista), upgrade | wall/tower, anti-air | 400 | half host | 15 s | 150 | 1 fire-tipped bolt | kills zeppelin in 1 hit; fire damage only to buildings | none | very low | none | normal | smithy; research 400 |
| Rocket Launcher (Raketenwerfer) EN p.46 | wall/tower | 800 | half host | 30 s | 150 | 1 rocket | high | high | very high | none | normal | smithy |
| Quad Launcher (Raketenwerfer II), upgrade | wall/tower | 800 | half host | 30 s | 450 | 1 rocket with 4 warheads | high | high | very high | none | normal | smithy; research 800 |
| Trebuchet (Trebuchet) EN p.47, Forest royal | ground | 850 | 48 | 18 s | 225 | 5 rocks | low | high | high | medium | normal | smithy + ammo workshop |
| Arcaballista (Arcaballista) EN p.47, Desert royal | ground | 850 | 48 | 18 s | 300 | 4 wooden stakes (Holzpfloecke) | high | very low | normal | medium | straight | smithy + ammo workshop |
| Fat Freda (Dicke Luise) EN p.48, Ice royal, upgrade of cannon line | ground | 850 | 48 | 22 s | 225 | 1 explosive missile | very high | very high | low | medium | normal | smithy + ammo workshop |
| Hellfire (Hoellenorgel) EN p.48, Volcano royal | ground | 850 | 48 | 22 s | 330 | 5 iron balls fired one after another | normal | normal | normal | medium | straight | smithy + ammo workshop |
| Zeppelin (Zeppelin) EN p.49 | aircraft | 700 | N/A | returns to palace to reload | 225 | 1 grenade/bomb (Sprengbombe) | very high | enormous | none | none | - | smithy + ammo workshop; research 400 |
| Super Weapon (Superwaffe) EN p.49 | special | 5000 | 96 | 90 s construction | none | 1 "Exodus" missile | game won on completion | whole battle zone | none | medium | - | smithy + ammo workshop; research 4000 |

Notes per weapon:
- Catapult line (Catapult, Long John, Trebuchet): the basic weapon. Large damage radius, high drift, "normal" arc (EN pp.42, 47). Research "Long John" replaces ALL catapults automatically and prevents building new basic catapults (EN p.42).
- Cannon line: "fairly accurate", small damage radius (EN p.43), straight trajectory. Upgrading to Double Cannon replaces all cannons (EN p.43). A cannon cannot be fired while the Rain spell is active (EN p.54).
- Fire weapons: fire jumps from a near miss to houses/weapons; walls, towers, palaces cannot burn (EN p.44). Fire Catapult fires are extinguished at once by Rain; Hot Helga fires are not (EN pp.44, 54).
- Ballista: ONLY weapon type that can hit a zeppelin; every other weapon is useless against it (EN p.45). Ballista vs buildings: "very minor damage".
- Royal weapons (Trebuchet, Arcaballista, Fat Freda, Hellfire): one per queen; not replacements. The weapon you get depends on the selected queen. Requires the base weapon type to exist and prerequisite research: Trebuchet and Arcaballista need Long John; Fat Freda and Hellfire need Double Cannon; each royal weapon costs 800 gold and 50 s to research (EN pp.50-51). Royal weapons can be switched off in custom games ("Royal weapons") (EN p.16).
- Zeppelin: the only mobile unit; built above the palace, flies in any direction over the whole area; must be loaded with a bomb first; after dropping returns to the palace to reload automatically; only one zeppelin at a time; cannot be built twice (EN pp.31, 49). Zeppelin controls in section 6.
- Super Weapon: if not destroyed within its 90 s construction time, the game ends automatically and its builder wins (EN pp.31, 49). In the 5000-gold fire-cost column: "none". Custom-game option "Super weapon: building this weapon ends the game after 90 seconds" (EN p.16). Not recommended with night curfew (EN p.17).
- Ammo type naming: the "ammo types" per weapon are fixed (one ammo type per weapon). There is no ammo selection and no separate ammo stock: ammo is paid in gold at each shot (EN p.27: "how much it costs to fire the weapon"; red numbers = not enough gold). Ammo-store/powder-store as an object: UNKNOWN (the "Ammo Workshop" building exists, see 3).
- "Quad Launcher ... each shot costs a bomb" (EN p.46) is wording only; the number is 450.

Max weapon count (Add Weapon research, EN p.52): base 2; stage 1 -> 3 (600 gold, 30 s); stage 2 -> 4 (900); stage 3 -> 6 (1200); stage 4 -> 8 (1500).

---
## 2. Ballistics and aiming

### 2.1 Aim inputs (EN pp.27-29, DE §3.4.3)
The weapon HUD has a three-figure readout on the left and one on the right of the red fire button.
- LEFT number = direction (azimuth, "Horizontal (direction)"). It is exactly 000 when the weapon points due north; the compass uses the same scale (EN p.24). In the tutorial, example values 353 and 354 steer the cannon/catapult toward the windmill, so values are degrees-like 0..359 (EN p.6). Whether it wraps at 360 or a different unit (e.g. mils): UNKNOWN. A "ballista's height can be adjusted at the same time" by dragging the left number (EN p.28).
- RIGHT number = vertical/"range". "The higher the number is, the further the missile will go" (EN p.28). Tutorial values: 007/038, then 353/048 -> 353/053 -> 055 -> 057 (EN pp.5-6); one arrow click appears to change the number by 1 (inferred, not stated). It is a range/elevation setting, not a power value, and not obviously a degree angle. Its unit and range limits: UNKNOWN. Increment per arrow click: tutorial: 1 click down = ~5 units/2 clicks (353/048->053 after 5 up-clicks gives 1 per click; "down twice" took 007/038 from presumably 040) i.e. about 1 unit per click (inferred from EN pp.5-6, not stated).
- Ways to change: arrow buttons around the fire button (left/right = direction, up/down = range); click-and-hold the number and drag the mouse left/right (direction) or forward/back (range); keyboard cursor keys / numpad 4,6,8,2 (rotate, and "increase/reduce ammo quantity or rotate camera up/down" for 8/2 in the weapons menu, EN p.58). Ctrl "speeds up various settings" (EN p.58).
- Aim by eye: if the castle is visible, the vertical line of the crosshair pointing at the target castle means direction is right (EN p.28). If hidden, put the small enemy-castle icon exactly above the compass (EN p.28).
- Free look while in weapon view: hold the right mouse button and move the mouse; releasing returns the view to the aim position (EN p.28).
- "Restore" (key Home / numpad 7): reverts the weapon to the settings of the previous shot; enabled and the coordinate display lights up when the weapon was moved since the last shot (EN p.28).
- A weapon fires only when its loading bar is full (EN p.5). Fire: red fire button, Space or numpad 0 (EN p.58).

### 2.2 Aiming feedback
- Crosshair (3D view): shows the "approximate trajectory"; the exact landing spot "can only be ascertained by firing a test shot" (EN p.28).
- Impact view (Trefferansicht): button right of the fire button, hold left mouse button (or End / numpad 1). Shows the area where the last missile landed; crosshair stays at the last impact even if the weapon is reset (EN pp.4, 28). Right after a shot, it shows the artilleryman's ESTIMATED impact point during flight, which does NOT include weapon inaccuracy or wind; after landing the crosshair is repositioned to the real impact (EN p.29).
- Enemy overview (bottom right): last shot of the selected weapon appears as a grey crater if it landed inside the enemy castle; crater size = radius of the destroyed area. Multi-missile weapons: crater at the roughly central point of the shower. Miss outside the castle: an arrow at the castle edge indicates the approximate landing position (may be misleading since castles overlap slightly) (EN pp.25, 29).
- Building colour in the overview: redder = closer to destruction; "accuracy indicator on the enemy map" shows how much of the target is done (EN p.7).

### 2.3 Drift and accuracy
- Every weapon has a natural random deviation ("Drift", qualitative, table above). The Accuracy research (Zielgenauigkeit, 500 gold, 15 s) "greatly improves" it but "cannot prevent drift due to wind" (EN p.51). Numeric values: UNKNOWN.
- Hurricane spell makes aiming "just about impossible" for 40 s (EN p.55).

### 2.4 Wind (EN pp.16, 24, DE §3.4.1.3)
- Setting "Wind strength": the stronger, the more shots veer off course (custom games only; default values for campaign levels: UNKNOWN).
- Setting "Change of wind": the higher, the more often the direction changes; after each change you must re-aim (EN p.16).
- HUD: wind speed is the figure in the middle of the compass; "the higher the number, the more your shots will drift in the direction of the wind" (EN p.24). Units and scale: UNKNOWN.
- A red arrow = current wind direction (only displayed if the wind is actually blowing). A blue arrow appears when the direction has changed and shows the PREVIOUS wind direction to help re-adjust (EN p.24).
- Wind effect formula (px per wind unit etc.): UNKNOWN. Whether wind affects all weapon types equally: UNKNOWN (Accuracy research does not help against wind).

### 2.5 Gravity, arc, range
Not specified numerically. Only qualitative: "normal" trajectory weapons arc over obstacles including high mountains; "straight" weapons do not (EN p.41; applied to cannon, arcaballista, Hellfire as straight). Maximum range of any weapon: UNKNOWN. Terrain can be "flat or craggy" and "warm and sunny or icy cold" in scenarios (EN p.12).

### 2.6 Splash and area damage
- Damage falls off with distance from the epicentre; objects at the outer edge of the radius are only slightly damaged (EN p.29).
- Fragment Shield research (Splitterschutz, 600 gold, 20 s) significantly reduces collateral damage around the impact (EN p.52). It also makes Fat Freda's huge blast ineffective against well-protected buildings (EN p.48).
- Fire spreads to neighbours; Firewall research (Feuerschutz, 600 gold, 20 s) makes fire cause much less damage (EN p.52).
- Ammo Workshop explosion when destroyed damages neighbouring buildings (EN p.39). The tutorial shows destroying the ammo workshop makes neighbouring farmhouses explode (EN p.5).

---
## 3. Targets and damage

### 3.1 Damage model
- Each building/weapon has "Defence points" = number of hits it can take (EN pp.36, 41). Damage is displayed as colour: green buildings, blue weapons, redder = closer to destruction (EN p.25). Per-hit damage per weapon in defence points: UNKNOWN (only qualitative direct damage + radius).
- Fire damage susceptibility per building: none / low / medium / high (EN pp.36-40). Walls, towers, palace, gatehouse, mage tower: none.
- Buildings on fire burn down slowly; an ammo workshop explodes when fully destroyed (EN pp.5, 39).
- Wall/tower weapons have half the defence points of their host structure (EN p.43).

### 3.2 Buildings (EN pp.36-40, DE §4.1)

| Building (DE) | Cost | Build time | Def. pts | Fire dmg | Role |
|---|---|---|---|---|---|
| Palace (Palast) | n/a | n/a | 200 | none | Existing from the start. If destroyed, the owner loses the battle. Cannot burn. |
| Wall (Mauer) small/large | 100 | 10 s / 15 s | 40 / 60 | none | Blocks shots; large walls are higher. Must attach to a tower or wall. Cannons/ballistas/rockets mount here. |
| Tower (Turm) small/large | 500 | 8 s / 24 s | 72 / 96 | none | Best protection; hosts wall weapons. |
| Gatehouse (Burgtor) | n/a (cannot be built) | n/a | 96 | none | Tall, soaks shots; unlike walls/towers it lets enemies see buildings behind it. |
| Mason's yard (Steinmetz) | 700 | 15 s | 24 | low | Needed for construction and repair; without it castle "won't last long". |
| Farmhouse (Bauernhaus) | 500 | 9 s | 12 | high | Houses up to 10 farmers; income source. |
| Superbrain (Universalgenie) | 900 | 32 s | 32 | medium | Research. |
| Mage tower (Magierturm) | 900 | 32 s | 64 | none | Spells. Favourite target. |
| Ammo workshop (Munitionsfabrik) | 600 | 18 s | 24 | high | Cuts firing cost by one third; required for royal weapons, Zeppelin, Super Weapon; explodes when destroyed. |
| Smithy (Waffenschmiede) | 700 | 24 s | 24 | low | Needed for all weapons except Catapult/Long John; repairs weapons also need mason's yard. |
| Treasury (Schatzkammer) | 300 | 15 s | 48 | low | Gold storage; see 5. |
| Inn (Schaenke) | 500 | 15 s | 20 | high | Shows enemy news (research/buildings) in info bar. |
| Windmill (Windmuehle) | 300 | 30 s | 4 | medium | More provisions, more farmers, cap still 10 per house. |
| Idol (Goetterstatue) | 700 | 15 s | 24 | medium | If destroyed, lightning strikes the attacker's buildings (damage or destruction). |

### 3.3 Specific hit consequences
- Palace destroyed: owner loses (EN p.36).
- Treasury destroyed: gold stored in it is lost (EN p.39: "you will then not lose as much gold if the enemy destroys one" implies loss proportional to treasuries destroyed). Exact fraction lost: UNKNOWN. A "king" object separate from the palace: the manual speaks only of the palace/queen ("Its queen or rather her representative - the player, inhabits each palace", EN p.36). No king entity in the duel: UNKNOWN.
- Powder store / ammo store: no such objects. The nearest are the Ammo Workshop (explodes) and ammo cost in gold. Water: not a target; the only water-related item is the Rain spell. UNKNOWN beyond that.
- Farmhouse destroyed: farmers living there are lost (battle stat "Losses" counts farmers lost) (EN p.35). Exact casualty rule: UNKNOWN.
- Idol destroyed: lightning on attacker (EN p.40).
- Mage tower destroyed: spells lost; Superbrain destroyed: researched items remain (EN p.32).
- Tutorial advice: walls and towers are for protection and generally need not be destroyed (EN p.4).

### 3.4 Repair
- Needs a mason's yard and gold. Castle view: select object, then Repair (Reparieren) or Scrap/Demolish (Abreissen) (EN p.26).
- Auto-repair (EN pp.31-32): starts a repair every 2 s; priorities per object type with 0..n exclamation marks (Palace, Walls & towers, Farmhouse & mason's yard, Other buildings, Weapons); minimum gold reserve prevents spending all gold on repairs (example: set at least 700 to afford a mason's yard). Active only above the reserve. Disabled in Hotseat (EN p.17). In Action mode, palace and weapons repair automatically if a mason's yard exists and gold suffices (EN p.13).
- Custom option "Repair" can disable repair; "Start sudden death" time after which nothing can be built or repaired (EN p.16).

---
## 4. Win / lose, scoring, game end

- Campaign: eight levels per campaign; four campaigns; complete a level to unlock the next (EN p.11). Tutorial level objective: destroy all (non-wall/tower/palace) buildings in the enemy castle, finishing with the windmill (EN p.4); battle stats screen then shows; "Next" proceeds (EN p.7). Other level objectives: look up under Mission menu (F8) (EN p.33). Their specific wording: UNKNOWN.
- Action Mode: win by destroying all enemy weapons (castle with no weapons is out); palaces must NOT be destroyed; you can only aim and fire (no build/magic); with 2 enemies each has 4 weapons, with 3 enemies each has 3. Enemy weapons are marked by white smoke plumes and blue in the enemy overview (EN p.13).
- Quick game / Tactics / Strategy: destroy enemy palaces (EN pp.13-14). Quick game: limited weapons per enemy count; gold factor x1.5 vs two enemies, x2.0 vs three.
- Palace destroyed = defeat. Super Weapon completed (90 s) = instant win for the builder (EN p.49).
- Multiplayer: a beaten player enters Ghost mode (spectator: right mouse turn/move, both buttons zoom, left mouse switch castle) (EN p.26).
- Hotseat: 30 s per turn per player, game time keeps running for the opponent; no auto-repair (EN p.17).
- Battle stats (EN pp.34-35): Shots, Direct hits, Accuracy (hits / shots), Damage (gold value), Tax income, Cash, Value of castle (buildings + weapons minus damage), Ammo costs, Research costs, Mage costs, Current pop., Losses (farmers), Playing time (time of elimination), Overall score (formula UNKNOWN). Best in category gets a star. Graph tabs: Game, Population, Buildings, Research, Magic, Weapons.
- Medals and titles (EN pp.19-20): game medals thresholds: Points 300/600/900 (bronze/silver/gold); Accuracy hit ratio 35/55/75 %; Air (zeppelin damage) 1000/2000/3500 gold; Magic (spells cast) 900/2000/3500 gold; scenario medals by difficulty (easy: 1 level-4 enemy or 2 level-3 or 3 level-2; medium: 2 level-5 or 3 level-4; hard: 3 level-6). Campaign medals: bronze = completed, silver = completed well, gold = completed quickly. Title points: bronze 1, silver 3, gold 5. Titles: Cannon Fodder (to 4 pts), Cannon Cleaner 5, Cannon Loader 10, Gunner 20, Senior Gunner 30, Battery Chief 45, General 60, Shooting Star 75.
- Hall of Fame categories: Shots, Direct hits, Accuracy, Damage, Tax income, Ammo costs, Mage costs, Losses, Playing time (EN pp.20-21). Best times per campaign level incl. points (EN p.21).
- Enemy AI: level 1..10 (level 1 "couldn't hit a barn door", level 10 always hits) (EN p.12). Computer tactics: Worrier, General, Daredevil (EN p.15).

---
## 5. Economy as it touches the duel

- Starting gold: Tactics mode "impressive starting capital of 1500 gold coins" (EN p.13). Strategy: nothing but palace, 3 farmhouses, a mason's yard and 1 weapon (EN p.14). Campaign start gold: UNKNOWN. Gold factor multiplies starting gold AND farmer income (EN p.15); x1.5 for two enemies, x2.0 for three in Quick/Tactics (EN pp.13-14).
- Tax: set with arrow buttons in the game menu or numpad +/- (EN pp.27, 58). Gold flows continuously from every farmer depending on tax rate. Tax < 40 %: farmers arrive (faster at lower rate); = 40 %: constant; > 40 %: farmers leave (faster as the rate rises, max 80 %). Max 10 farmers per farmhouse (EN p.27). Gold per farmer per second at a given tax rate: UNKNOWN.
- Gold cap: without a treasury, income stops past about 2000 gold ("if your coffers are getting close to 2000 gold coins ... all income beyond that will be lost") (EN p.39). Each treasury adds capacity by an UNKNOWN amount.
- What gold pays for during a fight: ammo per shot (shown red when unaffordable) (EN p.27), repairs (auto-repair), new buildings/weapons, research, spells. Support: with a treasury you can send 1000 gold to an ally by transport balloon; the gold is debited at launch and delivered on reaching the palace; the balloon can be shot down by a Ballista (EN p.33).
- Ammo purchase: not a stock; pay-per-shot (see section 1). Ammo workshop reduces cost by a third (EN p.39). Discounted per-shot values are not listed (UNKNOWN).
- Icefinger spell halves enemy gold income for 90 s; Sandcloud returns damage done as gold (EN p.56-57).
- Custom-game options (EN p.16-17): farmers per new building, starting gold, start build time (no fighting until it expires), start sudden death time, repair, build, magic, invent, zeppelin/ballista, royal weapons, super weapon, wind strength, wind change, day/night change, night curfew (no fighting at night), no night shift (no build/repair at night), presets Tactics (castles have a few walls) / Strategy (only towers to host the starting cannons). Default values: UNKNOWN. Length of day/night: UNKNOWN.

---
## 6. Controls and HUD in weapon view

### 6.1 Mouse (EN pp.22-29)
- Move cursor to the middle of the RIGHT screen edge: main menu pops up (Options, Mission, Support, Magic, Research, Auto-repair, Build weapons, Build structure, Weapon view, Castle view [not in Action mode]); unavailable items greyed out (EN p.23).
- Move cursor to the middle of the LEFT edge: weapons menu; one box per possible weapon slot (max weapons), a bar per box = loading status, green light when ready (EN pp.23-24).
- Hold right mouse and move: turn (left/right) or move camera up/down (forward/back); hold both buttons and move: zoom (EN p.26). In weapon view, right-mouse is a temporary free look.
- Left mouse on weapon HUD: red fire button, impact-view button (hold), arrow buttons, number drag fields, weapon toggle buttons left/right below the fire button.
- Right click closes menus (EN pp.30-33).

### 6.2 Keyboard (EN pp.58-59)
General: Esc close menu / open options; F1 castle view; F2 weapon view (or next weapon in weapon view); F3 build structure; F4 build weapons; F5 auto-repair; F6 research; F7 mage; F8 mission; F9 support; F10 options; PgUp / numpad 9 previous weapon; PgDn / numpad 3 next weapon; 1-8 weapon shortcuts in ascending order; P pause and info window; S screenshot; I info window; Enter chat; numpad + / - tax up/down.
Weapon view: arrow left/right or numpad 4/6 rotate weapon; up/down or 8/2 raise/lower range (manual wording: "increase or reduce ammo quantity or rotate camera up/down"); Home / numpad 7 restore last shot settings; End / numpad 1 impact view; Space / numpad 0 fire; Ctrl speeds up settings.
Zeppelin view: left/right steer; up start engine; down stop engine; Home load grenade; End impact view; Space drop bomb.
Mage view: left/right select previous/next enemy castle; Space cast.

### 6.3 HUD elements
- Header (top centre, EN pp.23-24): gold chest with current tax rate in brackets; farmers (current (max)); weapons built (max, up to 8).
- Compass (top right, EN p.24): enemy castle icons (filled = enemy, not filled = ally; centre the icon above the compass = looking at it); heading scale where 000 = north; wind speed number in the centre; red arrow = current wind direction; blue arrow = previous direction after a change; speaker portrait when an inhabitant talks.
- Bottom bar (EN p.25): left = own castle overview (green buildings, blue weapons, red = damaged; ground weapons 3x3, wall/tower weapons 1x1; click to jump to castle view, double-click a weapon to jump to its weapon view); right = enemy overview of the castle currently targeted via the compass, no building/weapon colour distinction, hidden objects behind walls/towers invisible, impact marks (grey crater / edge arrow); centre = control panel: in weapon view the left bar is the loading bar, right bar is weapon condition, plus firing cost (red if unaffordable), the two three-figure coordinate readouts, arrows, fire button, impact view button, weapon toggles, Restore; info bar (inn gives enemy news; click to open the last 10 news items).
- Minimap: there is no separate minimap; the two bottom overview maps serve that role.
- First-person camera: UNKNOWN beyond the above (eye height, field of view, how crosshair is drawn).

---
## 7. Magic and research with duel impact (not in scope but affecting the duel)

Spells (cost / duration / recovery), EN pp.53-57: Protective Shield 300/40 s/100 s (blocks non-metal missiles, not cannons); Metal Shield 300/40/100 (blocks metal, not rocks); Rain 500/20/60 (all mages start with it; extinguishes Fire Catapult fires; cannons cannot fire during rain); Fog 300/40/90 (hides enemy castle in Impact view and overview); Lightning 400/2/120 (random enemy weapon); Thunderstorm 500/6/150 (5 bolts); Hurricane 400/40/90 (aim near impossible); Earthquake 500/4/150 (damages walls and towers); Miasma 500/6/120 (20 % of farmers flee). Princess spells (700 gold, 90 s, 200 s recovery): Royal Shield (Forest; only protects caster; lets iron balls/other missiles through only some of the time), Sandcloud (Desert; obscures impact view of others; damage the caster causes brings gold), Icefinger (Ice; halves enemy income), Hellholes (Volcano; sulphur jets that can be detonated by firing weapons at them). Spell research is free and takes 30 s; first three random standard spells (1st defensive, 2nd aggressive, 3rd either), 4th is the queen's spell (EN p.52). The mage has a recovery after casting.
Research: Wall Upgrade 700/30 s; Accuracy 500/15 s; Fragment Shield 600/20 s; Firewall 600/20 s; weapon upgrades 800/30 s (Fire Ballista 400/30 s); royal weapons 800/50 s; Zeppelin 400/35 s; Super Weapon 4000/90 s (requires all others) (EN pp.50-52). Research cannot be cancelled.

---
## 8. Campaigns, castles, queens (EN pp.11-12, DE §3.3.4)

- Four campaigns x eight levels: Forest (easy), Desert (medium), Ice (medium hard), Volcano (hard). Free choice of campaign; Forest recommended first (EN p.11).
- Each campaign targets one queen while the player serves one of the other princesses: "Each campaign targets a particular queen, with you fighting on behalf of one of the other princesses" (EN p.11). Which one you serve per campaign: UNKNOWN.
- Tutorial 1 = first level of the Forest campaign: "Help the Forest Princess by destroying all the buildings in the enemy castle" (EN p.4). Tutorials 1-3: aiming and firing; building and economy; research and magic (EN p.10).
- Queens' character text only (Forest peaceful and naive; Desert sex kitten; Ice eldest, arrogant; Volcano meanest, psycho, with cannonball carriers Riff and Raff) (EN pp.11-12). Royal weapon and spell per queen: Forest = Trebuchet + Royal Shield; Desert = Arcaballista + Sandcloud; Ice = Fat Freda (Dicke Luise) + Icefinger; Volcano = Hellfire (Hoellenorgel) + Hellholes (EN pp.47-48, 56-57). Story: four daughters of the King fight each other (EN p.3).
- Fixed castle layouts, castle names, per-level objectives, terrain/biome per level: NOT in the manuals (UNKNOWN). The manual only says the scenery in scenarios can be flat or craggy, warm or icy, or random (EN p.12), and the tutorial castle has an inn, an ammo workshop surrounded by farmhouses, and a windmill (EN pp.4-5). The mapping Wald/Wueste/Eis/Vulkan to terrain biome is implied by campaign names only; not explicitly stated.
- Scenario modes: Action, Quick game, Tactics, Strategy, User defined (EN pp.12-14). 1-3 enemies; AI level 1-10.
- Day/night cycle exists (option). Movie replays in Extras (EN p.10).

---
## 9. Contradictions inside the manuals (EN vs DE)

- Firing cost: Catapult EN 52 vs DE 53; Long John EN 135 vs DE 113; Ballista EN 22 vs DE 23. (Other weapons identical.) Which is authoritative: UNKNOWN.
- Weapon names: EN "Fat Freda" = DE "Dicke Luise"; EN "Hot Helga" = DE "Heisse Gina"; EN "Quad Launcher" = DE "Raketenwerfer II"; EN "Hellfire" = DE "Hoellenorgel" (it is Volcano's royal weapon and NOT a Katapult variant); EN "Mason's Yard" = DE "Steinmetz"; "Superbrain" = "Universalgenie"; "Ammo Workshop" = "Munitionsfabrik"; "Smithy" = "Waffenschmiede"; "Idol" = "Goetterstatue"; "Inn" = "Schaenke"; "Treasury" = "Schatzkammer"; "Impact view" = "Trefferansicht"; "Weapon view" = "Waffenansicht"; "Loading bar" = "Ladebalken"; "Weapon toggle" = "Waffenumschalter".
- Tutorial text says "ammunition quantity" for up/down keys in the weapons menu (EN p.58) but arrows adjust range in all other places: probably a translation of the original ("Munition"); treat as range up/down.
- Fire Ballista: table field "Fire damage: none" (susceptibility of the weapon itself) vs text that its bolts cause fire damage to buildings (EN p.45); read the first as the weapon's own fire vulnerability.

---
## 10. Master number table

| Item | Value | Source |
|---|---|---|
| Palace def. pts | 200 | EN p.36 |
| Small / large wall def. pts, cost | 40 / 60; 100 gold; 10 s / 15 s | EN p.36 |
| Small / large tower def. pts, cost | 72 / 96; 500 gold; 8 s / 24 s | EN p.37 |
| Gatehouse def. pts | 96 | EN p.37 |
| Mason's yard | 700 g, 15 s, 24 dp | EN p.37 |
| Farmhouse | 500 g, 9 s, 12 dp, 10 farmers | EN p.38 |
| Superbrain / Mage tower | 900 g, 32 s, 32 / 64 dp | EN p.38 |
| Ammo workshop | 600 g, 18 s, 24 dp; ammo cost -1/3 | EN p.39 |
| Smithy | 700 g, 24 s, 24 dp | EN p.39 |
| Treasury | 300 g, 15 s, 48 dp; cap ~2000 gold without it | EN p.39 |
| Inn | 500 g, 15 s, 20 dp | EN p.40 |
| Windmill | 300 g, 30 s, 4 dp | EN p.40 |
| Idol | 700 g, 15 s, 24 dp | EN p.40 |
| Catapult | 600 g, 30 dp, 18 s reload, 52 per shot, 1 rock | EN p.42 |
| Long John | 600 g, 30 dp, 18 s, 135, 3 rocks | EN p.42 |
| Cannon | 750 g, 22 s, 90, 1 ball | EN p.43 |
| Double Cannon | 750 g, 22 s, 150, 2 balls | EN p.43 |
| Fire Catapult | 750 g, 30 dp, 24 s, 150 | EN p.44 |
| Hot Helga | 750 g, 30 dp, 24 s, 225 | EN p.44 |
| Ballista | 400 g, 15 s, 22, 3 hits to kill zeppelin | EN p.45 |
| Fire Ballista | 400 g, 15 s, 150, 1 hit kills zeppelin | EN p.45 |
| Rocket Launcher | 800 g, 30 s, 150 | EN p.46 |
| Quad Launcher | 800 g, 30 s, 450, 4 warheads | EN p.46 |
| Trebuchet | 850 g, 48 dp, 18 s, 225, 5 rocks | EN p.47 |
| Arcaballista | 850 g, 48 dp, 18 s, 300, 4 stakes | EN p.47 |
| Fat Freda | 850 g, 48 dp, 22 s, 225 | EN p.48 |
| Hellfire | 850 g, 48 dp, 22 s, 330, 5 balls sequential | EN p.48 |
| Zeppelin | 700 g, 225 per bomb, 1 at a time | EN p.49 |
| Super Weapon | 5000 g, 96 dp, 90 s build | EN p.49 |
| Weapon cap | 2 base; 3/4/6/8 via research 600/900/1200/1500 g, 30 s each | EN p.52 |
| Research costs | see section 7 | EN pp.50-52 |
| Spells | see section 7 | EN pp.53-57 |
| Tax | <40 % farmers come, 40 % neutral, >40 % leave, max 80 % | EN p.27 |
| Farmers per house | 10 | EN pp.24, 27 |
| Support gift | 1000 gold | EN p.33 |
| Tactics start gold | 1500 | EN p.13 |
| Gold factor | x1.5 (2 enemies), x2.0 (3 enemies) | EN pp.13-14 |
| Action mode weapons | 4 each (2 enemies), 3 each (3 enemies) | EN p.13 |
| Auto-repair tick | one repair start per 2 s | EN p.31 |
| Hotseat turn | 30 s | EN p.17 |
| AI levels | 1..10 | EN p.12 |
| Min system | PII 350, 64 MB, DirectX 8; designed for 1024x768 | EN pp.7, 22 |
| Resolutions | 640x480 ... 2048x1536 | EN p.22 |
| Max range, gravity, wind speed scale, per-hit damage, projectile speed | UNKNOWN | - |
