# Ballerburg (Ascaron, 2001) - ground truth

KEY FINDING: the 2001 game is NOT a side-on 2D remake of Kruse's 1987 game. It is a fully 3D, REAL-TIME fantasy castle-building/artillery game (RTS-lite) sharing only the name and the "destroy the enemy castle/king" idea. Evidence: the screenshots (primary) plus MobyGames/gameswelt/game-2.de descriptions.

## Screenshots (/home/tobias/Projects/castle-game/research/screenshots-myabandonware/)
Screens are German ("Version 1.00", (c) 2001 Ascaron, player name "phlux").
- shot_01: Main menu "Hauptmenue" 800x600 pre-rendered: Tutorial, Kampagne, Szenario, Multiplayer, Extras, Optionen, Beenden. Stone-wall/dragon frame, two-faced queen emblem.
- shot_02: "Hotseat" setup. 4 team slots (red, blue, 2 empty), Gold multiplier x1.0, Player/CPU-level, name/tactic, queen ("zufaellig"=random). Tabs: Schnellspiel, Taktik, Strategie, Freies Spiel. Options: start buildings (Katapulte 0, Kanone 1, Bauernhaeuser 6, Bauern im Neubau 5, Schatzkammer, Steinmetz, Waffenschmiede, Universalgenie, Magierturm), Startgold 1500, Start-Bauzeit, Start SuddenDeath 240 min, toggles Reparieren / Gebaeude-Waffe bauen / Magie / Erfinden (Zeppelin/Ballista, Spezialwaffe, Superwaffe), Windstaerke 0, Windaenderung 0, Tag/Nacht Wechsel, Nachtschussverbot, Nachtarbeitverbot, Preset.
- shot_03: Tutorial 4/11, 3D third-person RTS camera over castle (keep+walls+towers), peasant houses, treasury (Schatzkammer) selected; HUD top: gold 51301 (30% = tax rate), population 39(50), cannons 2(2); compass+advisor portrait top-right; left/right button columns; bottom: minimap left, centre panel with tax-rate arrows (30%) and heraldic shield, enemy minimap right.
- shot_04: First-person-ish "weapon view" behind a cannon (rear of barrel, mountains, enemy castle with windmill in distance). Tutorial 7/11 "destroy the enemy windmill". Counter widget "03 / 043" (probably angle/power digits), arrow pad + red fire button, bar "Laedt nach" (reloading), "Kanone (100%)", buttons Abreissen/Reparieren/Zuruecksetzen/Trefferansicht. Opponent label: "Gegner Gustav I - Eiskoenigin".
- shot_05: Tutorial 1/11, top-down-ish view of fresh start: small keep, 5-6 huts. Pop 25(50), cannons 0(6).
- shot_06: Tutorial 7/11 building a Waffenschmiede (50% built) next to a long wall piece; steeper camera.
- shot_07: Pure top-down view (no HUD panels) showing placement: wall with tower, houses, green placement ghost.
- shot_08: Zeppelin vehicle view (stone-clad airship) flying over a river toward enemy castle; buttons Rueckflug, Bombe laden, Zielansicht. Tutorial 11/11.
- shot_09: Castle with walls, 8 huts; "Kleine Mauer (100%)" selected; pop 38(70).
- shot_10: Trebuchet info dialog: "Spezialwaffe der Waldkoenigin. Munition: 5 Steingeschosse; Schusskosten 225 Gold; geringer direkter Schaden; hoher Schadensradius; hohe Abweichung; hohe Flugbahn; Abwehr durch normalen Schild; ermoeglicht Superwaffe; noetig: Waffenschmiede und Munitionsfabrik; Kosten 800 Gold". Message: Universalgenie researched weapon upgrade level 1.
- shot_11: Magic: Magierturm built, rain spell (blue beam), "Erholung" (mana recovery bar).
- shot_12: Trebuchet firing view; shell impact dust cloud; digits 04/026; "Trefferansicht" (hit view) toggled; enemy minimap with red dots.
- shot_13: Campaign menu: Waldkampagne, Wuestenkampagne, Eiskampagne, Vulkankampagne; portrait "Koenigin der Vulkane".
- shot_14: Pre-rendered cutscene: Hoellenorgel (multi-barrel organ gun) in a smithy.
- shot_15: Parchment weapon card "Hoellenorgel - Koeniginnenwaffe - feuert nacheinander fuenf Metallgeschosse".
- shot_16: Zeppelin over a desert enemy base (gold 788); zeppelin carries "Bombe", "Fluganzeige" button, 4 corner towers around a central tower.
- shot_17: Zeppelin bomb explosion on towers (gold 555).
- shot_18: Desert level, sandstorm/spell from enemy ("Max VI hat soeben einen Zauber sprechen lassen"); build menu list left: Kleiner Turm, Kleine Mauer, Goetterstatue, Magierturm, Universalgenie, Windmuehle, Schatzkammer, Munitionsfabrik, Waffenschmiede, Steinmetz, Schaenke, Bauernhaus (red = unavailable/not affordable). Castle "Palast (94%)". Opponent "Max VI - Wuestenkoenigin".
- shot_19: FMV intro frame: valley, mountains, castle, stone giant/boulder.
- shot_20: FMV frame: castle gate, cannons on battlements, roof with dragon sigil.
- shot_21: Parchment card "Trebuchet - Koeniginnenwaffe - schleudert fuenf Steingeschosse".

## 1. Core loop
- Real-time (not turn based): MobyGames calls it "real-time artillery strategy game" [MobyGames 5496 via search summary; page itself 403]. Screens show reload timers ("Laedt nach"), build progress %, mana recovery, day/night cycle, sudden death timer (240 min) - consistent with real time.
- Players build/expand a castle (RTS style) and fire weapons at the enemy; no armies ("no armies to command") [MobyGames summary].
- Win: kill the enemy king/queen's castle - game-2.de says "goal is to kill the enemy king" [https://www.game-2.de/ballerburg-wenn-publisher-ideen-stehlen/]. gameswelt: player is a cannoneer hired by a queen to eliminate her hated sisters [https://www.gameswelt.de/ballerburg/news/neues-spiel-von-ascaron-im-anrollen-63351]. Screens show the central castle ("Palast", % health). Exact win trigger (palace destroyed vs. ruler killed vs. bankruptcy): UNKNOWN. Sudden death option exists (shot_02).
- Hot-seat is just a lobby (shot_02); how simultaneous play is handled in hot-seat (turn limit?): UNKNOWN.

## 2. Economy
- Gold counter + tax rate % (30% default) in HUD; peasants/population with cap rising with houses (e.g. 25(50) -> 59(60) -> 64(70)); cannon count with cap (2(6)). Money from taxes and peasants [game-2.de]. Windmill, Schaenke (tavern), Schatzkammer (treasury) exist as buildings (shot_18) - exact income effect UNKNOWN.
- Start gold in free-play option: 1500 (default in shot_02); campaign start gold seems ~50000 in the tutorial (shot_03/04). Gold multiplier x1.0.
- Buildings seen (shot_18): Kleiner Turm, Kleine Mauer, Goetterstatue, Magierturm, Universalgenie (research), Windmuehle, Schatzkammer, Munitionsfabrik, Waffenschmiede, Steinmetz (masonry), Schaenke, Bauernhaus; plus Palast. Press: "14 buildings" (gameswelt, 2001 preview); games-guide.de: 16 buildings and 15 weapons (final).
- Weapons: gameswelt 11 weapons "from catapult to Hoellenorgel"; seen: Katapult, Kanone, Trebuchet, Hoellenorgel, Zeppelin (bomb), Ballista, Langer Fritz, Doppelkanone (PC Games/GameZone-derived search summary). Prices: Trebuchet 800 gold + 225 per shot (5 stone shots). Others UNKNOWN.
- Per-queen: 4 unique queen weapons and 4 queen spells; 9 general spells (lightning, earthquake, shield, rain, sandstorm...) [gameswelt]. Research ("Universalgenie") unlocks weapon upgrades; 8 research scenarios.
- Repairs: "Reparieren" button on any building; "Abreissen" demolish.

## 3. Artillery
- Aiming: arrow pad (yaw/elevation) + fire button, numeric readout (two numbers, probably azimuth/elevation or power - UNKNOWN which); "Zuruecksetzen" reset; "Trefferansicht" (follow shell/hit view). Powder-charge input: UNKNOWN (not visible).
- Wind: configurable strength and change rate (0 in the tutorial), so it exists (shot_02).
- Ammo types: stone shots, metal shots, bombs; shield spell/normal shield defends vs trebuchet; trebuchet = low direct damage, large radius, high deviation, high arc.
- Damage model: buildings have % health; walls/towers collapse. King/treasury/powder-store special effects: UNKNOWN.
- Night shooting ban option (Nachtschussverbot).

## 4. Castles
- Not fixed preset duel arenas: you BUILD your castle on a 3D heightmap landscape with forest, rivers, hills, desert, ice, volcano (campaign themes). Each campaign (Wald/Wueste/Eis/Vulkan) = 8 levels [gameswelt], 3 tutorial missions (the tutorial seen has 11 steps). Opponents are named rulers (Gustav I, Max VI) serving a queen.
- Starting castle: a palace/keep + huts; walls/towers placeable in a grid.

## 5. Presentation
- Full 3D (Direct3D, DirectDraw7 per WineHQ bug), free rotatable camera with compass, pre-rendered FMV intro/cutscenes (640x480 frames), menus 800x600 pre-rendered stone/metal UI, parchment weapon cards. Resolutions 640x480 up to 2048x1536 [gameswelt]. Humorous queen/magician/cannon-hauler voice commentary written with satirist Dirk Oltersdorf [GameZone search summary]. Music/SFX style: UNKNOWN (day/night shown visually and audibly).

## 6. Modes
- Tutorial, Kampagne (4 campaigns x 8 levels), Szenario (free play / 4 action variants: Schnellspiel, Taktik, Strategie, Freies Spiel), Multiplayer (hot-seat, LAN, internet), Extras, Options. Up to 4 players simultaneously (4 team slots, shot_02; MobyGames: up to four). AI has "CPU-Stufe" levels (count UNKNOWN). Chat in net play. Medals, high-score, battle reports.
- Reception: PC Games 1/2002 73% (solo 78, multi 85), GameZone 8/10, GameStar/PC Action 01/2002 (score not retrieved); campaigns repetitive, multiplayer best [pcgames.de, gamezone.de via search summary; kultboy.com].

## 7. Differences vs 1987 Atari ST (Kruse)
1987: turn-based, side-on 2D, 2 kingdoms separated by a mountain, angle + powder, changing wind each turn, buy ammo/cannons with fluctuating prices, repair, taxes affecting morale (unhappy population defect to opponent), up to 5 derricks/towers, targets: cannons, wind flag, storerooms; win by hitting the throne room or bankrupting the enemy [de.wikipedia, en.wikipedia]. Ascaron 2001 keeps: castle destruction, cannons, wind, money/taxes, king target. Drops/changes: real-time, 3D, building, magic, research, queens, campaigns, zeppelins, 4 players. Ascaron did not credit Kruse; Kruse was unhappy [game-2.de, wiki].
=> Kruse mechanics (angle+powder, wind, shop, taxes vs population) are "Ballerburg canon" of the ORIGINAL; the 2001 game is a different design. The user should decide which to re-implement.

## 8. Open source / clones
- Ballerburg SDL (Kruse 1987 source, GPL, Thomas Huth port): home baller.frama.io (formerly baller.tuxfamily.org), source on framagit; packaged in Debian/openSUSE/Gentoo (1.2.3); README https://downloads.tuxfamily.org/baller/README.txt. Kruse released source in Oct 2004. Best source for exact 1987 formulas.
- iOS remake 2012 (Woschitz/Novak); other ports Mac, Windows 8 [de.wikipedia]. No JS/web/Godot version found. No clone of the 2001 game found.

## 9. Technical
- Release 7-10 Dec 2001 (Germany; games-guide/gamersglobal), publisher Ascaron / BigBen; re-issued 2004 (Computer Bild Spiele 03/2004), 2005, 2007, 2008 (Tin-Box) [OGDB]. PS1 port 2003 (Phoenix Games). 
- System requirements: UNKNOWN (not found). Copy protection/CD need/NoCD: UNKNOWN. ISO of v1.00 on archive.org: https://archive.org/details/ballerburg (ASCARON_BALLERBURG_2001_1.00.ISO, 663 MB, 763 files).
- Wine: WineHQ bug 47129 (2019) "Rendering glitch in Castle Siege/Ballerburg (invalid vertex count in DrawIndexedPrimitiveVB)" - FIXED in wine 4.7+ (ddraw commit 08d630e2...); game uses ddraw7/d3d3. No AppDB/ProtonDB/PCGamingWiki entry found.
- German version is the best-documented (screenshots, German manual). English "Castle Siege" exists (US).

## Not verified
MobyGames/PC Games/GameZone pages returned 403; their content comes only from search-engine summaries. No manual text found.
