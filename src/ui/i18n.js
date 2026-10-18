// src/ui/i18n.js - owns every user-visible UI string, German (default, the original's wording) and English.
// Pure data + one formatter. German values are the 2001 original's labels where one existed
// (shots 03, 04, 12, 16); English values are ours. Placeholders: {name}.

/** Supported languages; German first (DESIGN 7.5: German default). */
export const LANGS = Object.freeze(["de", "en"]);
export const DEFAULT_LANG = "de";

const de = {
  // Repair wave 3: contextual directions, terminal shots and loss triggers.
  populationNear: "Bevölkerung {pop}, Aufgabe unter {line}",
  palaceRepair: "Reparatur {pct}%",
  shotLostFar: "Karte hinter der fernen Mauer verlassen / Ladung verringern",
  shotLostShort: "Vor der Burg aus der Karte gefallen",
  shotLost: "Geschoss verloren / kein Einschlag beobachtet",
  impactOwnWall: "Eigene Mauer im Weg / Schussbahn freimachen",
  impactEnemyWall: "Feindmauer getroffen / Schuss abgefangen",
  winEliminated: "{name} ist ausgeschieden.",
  winRuler: "{name} verlor den Herrscher.",
  winRulerCause: "{name} verlor den Herrscher durch {cause}.",
  winPalace: "{name}: Palast bei {pct}%, unter der Niederlagelinie von {line}%.",
  winPalaceFallback: "Der Palast von {name} wurde zerstört.",
  winPopulation: "{name} gab auf: Bevölkerung {pop}, unter {line}.",
  winMorale: "{name} gab auf: Moral {s} s lang bei höchstens {line}%.",
  winSurrender: "{name} hat aufgegeben.",
  optionDirection: "{dir}, {m} m",
  optionAhead: "vorn",
  optionLeft: "links",
  optionRight: "rechts",
  optionBehind: "hinten",

  // Repair wave 2: contextual battle feedback.
  incoming: "Beschuss aus {dir} / Einschlag in {s} s",
  palaceBar: "Palast {pct}% / Niederlage unter {line}%",
  palaceRising: "Ab Minute 10 steigt die Niederlagelinie bis 55%.",
  palaceReached: "Niederlagelinie jetzt 55%. Palast darüber halten.",
  pressureLosses: "Verluste",
  pressureDamage: "Beschuss",
  pressurePalace: "Palastschäden",
  pressureFire: "Feuer",
  pressureStrain: "Kampfbelastung",
  pressureGuns: "Geschützverlust",
  pressurePopulation: "Bevölkerungsverlust",
  pressureRally: "Eigene Treffer",
  pressureRecovery: "Erholung",
  surrenderHold: "{cause} / Aufgabe {s}/{total} s",
  surrenderPopulation: "{cause} / Bevölkerung {pop} < {line}: Aufgabe",
  pressureSafe: "{cause} / Aufgabe ab {line}% Moral",
  idleCrew: "Mannschaft fehlt",
  idleAmmo: "Munition fehlt",
  idleGold: "Gold fehlt",
  idleBlocked: "Schussbahn blockiert",
  idleDamaged: "Geschütz beschädigt",
  idleWait: "Nachladen abwarten",
  idleMan: "E: bemannen, Crew rufen",
  idleCrewComing: "Mannschaft unterwegs",
  idleOrder: "Q: Mannschaft rufen",
  idleApproach: "Zum Geschütz gehen",
  idleHauler: "Träger unterwegs",
  idleAmmoOrder: "R: Munition zuerst",
  idleSupply: "Magazin prüfen",
  idleIncome: "Einkommen abwarten",
  idleTurn: "Pfeile: freie Bahn suchen",
  idleInspect: "Hindernis vor dem Rohr prüfen",
  idleOtherGun: "Intaktes Geschütz aufsuchen",
  impactShort: "{m} m kurz",
  impactLong: "{m} m weit",
  impactLeft: "{m} m links",
  impactRight: "{m} m rechts",
  impactRangeOn: "Reichweite passt",
  impactLineOn: "Richtung passt",
  impactPalace: "Palast beschädigt",
  impactWall: "Mauer getroffen",
  impactGun: "Geschütz getroffen",
  impactPerson: "Person getroffen",
  impactGround: "Boden / Fehlschuss",
  aimReference: "Letzter Schuss: {az} Grad / Ladung {charge}",
  aimLegend: "Kreuz: Ziel / Ring: letzter Einschlag",
  castleNumber: "Burg {n}",
  enemyWeapon: "Geschütz",
  unknownBearing: "unbekannt",
  lossRulerShot: "{time}: {name} tötete euren Herrscher mit {weapon} aus {dir}.",
  lossRuler: "{time}: Euer Herrscher starb durch {cause}.",
  deathFall: "einen Sturz",
  deathFire: "Feuer",
  deathBlast: "eine Explosion",
  deathDamage: "Verletzungen",
  deathCollapse: "einstürzendes Mauerwerk",
  deathProjectile: "ein Geschoss",
  lossPalace: "{time}: Palast bei {pct}%, unter der Niederlagelinie von {line}%.",
  lossPalaceFallback: "{time}: Euer Palast wurde zerstört.",
  lossSurrender: "{time}: Eure Burg gab auf; stärkster Druck: {cause}.",
  lossSurrenderFallback: "{time}: Eure Burg hat aufgegeben.",
  lossFallback: "{time}: Eure Burg ist ausgeschieden.",
  accountEvent: "{time} / {event}",
  accountIncoming: "Beschuss auf den Herrscher",
  accountGun: "Eigenes Geschütz zerstört",
  accountMagazine: "Magazin explodiert",
  accountPalace: "Palast durchbrochen",
  accountRuler: "Herrscher gefallen",
  accountSurrender: "Burg gibt auf",
  accountDamage: "Burg beschädigt",
  accountLosses: "{n} Menschen verloren",
  retry: "Enter: Erneut",
  decisiveEvents: "Entscheidende Ereignisse",
  optionRepair: "R: Reparatur / {cost} Gold / Mauer stärken",
  optionBuild: "B + Klick: Stein / {cost} Gold / Lücke schließen",
  optionReplacement: "G + Klick: Kanone / {cost} Gold / Feuerkraft zurück",
  optionCrew: "Q: Crew rufen / 0 Gold / Nachladen ermöglichen",
  optionMan: "E: bemannen / 0 Gold / Crew kommt",
  optionCover: "E + WASD: Deckung suchen / Zielpause",
  optionCoverWalk: "WASD: Deckung suchen / Wegzeit",
  leaveForOrder: "E: verlassen, zur Stelle drehen",
  repairProgress: "Reparatur {pct}%",
  repairQueued: "Reparatur geplant {pct}%",
  buildProgress: "Bau {pct}%",
  catapultFound: "Katapult entdeckt",
  quickStart: "Schnellstart",
  quickStartHint: "Waldduell / KI 2 / Kanone und Stein",
  promptMan: "E: Kanone bemannen",
  promptFire: "Leertaste: Feuer",
  promptBuild: "B: Bauen",
  chargeUnit: "Ladung 1-255",
  rangeEstimate: "ca. {m} m (windstill)",
  incomeRate: "Einkommen +{rate} Gold/s",
  aimHint: "Pfeile: Zielen",
  leaveHint: "E: Verlassen",
  walkHint: "WASD: Gehen",
  buildHint: "B: Bauen",
  buildConfirmFull: "Klick: Bauen / Rechts: Abriss, Abbruch",
  buildConfirm: "Klick: Bauen / Rechts: Abbruch",
  cycleHint: "Bild auf/ab: Auswahl",
  placementHint: "G: Geschütz setzen",
  jobsHint: "Tab: Aufträge",
  shelterHint: "X: Schutzraum",
  repairHint: "R: Priorität",
  crewHint: "Q: Mannschaft",
  autoFireHint: "F: Feuer frei",
  restoreHint: "Home: Zurücksetzen",
  impactHint: "End: Trefferansicht",
  newTriage: "Mauer beschädigt? R: Reparatur zuerst. Die Fahne zeigt Moral.",
  newPlacement: "G: Geschütz setzen. Auswahl mit Rad / Bild auf/ab.",
  newAutoFire: "F: Feuer frei. Die Mannschaft feuert beim Nachladen weiter.",
  newOrders: "X: Schutzraum. Mannschaften und Aufträge sind jetzt sichtbar.",
  newArsenal6: "G: Neue Auswahl: Doppelkanone und Balliste.",
  newArsenal7: "G: Feuerkatapult verfügbar.",
  newArsenal8: "G: Trebuchet verfügbar.",
  newArsenal9: "G: Raketenwerfer und Arkballiste verfügbar.",
  newArsenal10: "G: Dicke Luise und Hoellenorgel. Alle Bauarten verfügbar.",
  newCatapult: "10 Kanonenschüsse: Katapult entdeckt. Ab Gefecht 3 einsetzbar.",
  crewAuto: "Mannschaft kommt von selbst.",
  moraleLoss: "Moral sinkt: Verluste in der Burg.",
  moraleDamage: "Moral sinkt: Burg unter Beschuss.",
  moraleRally: "Moral steigt: Treffer beim Gegner.",
  moraleQuiet: "Moral steigt: Erholung nach Gefechten.",
  moraleStrain: "Moral sinkt: Nachwirkung der Gefechte.",
  moraleStatus: "Moral: {band}",
  arsenalHint: "{name} / Rad: Auswahl",

  // console, weapon view (shot 04)
  reloading: "Lädt nach",
  loaded: "geladen",
  fireCost: "{cost} Gold",
  weaponCondition: "{name} ({pct}%)",
  fireAtWill: "Feuer frei",
  crew: "Mannschaft",
  restore: "Zurücksetzen",
  impactView: "Trefferansicht",
  demolish: "Abreißen",
  repair: "Reparieren",
  // console, walking
  morale: "Moral",
  shelter: "Schutzraum",
  build: "Bauen",
  placeWeapon: "Waffe setzen",
  cost: "{name}: {cost} Gold",
  buildLedger: "Gold {gold} / Reserviert {reserved}",
  designationAdded: "Bauauftrag erteilt",
  designationCancelled: "Bauauftrag storniert",
  demolitionOrdered: "Abriss beauftragt",
  blockBuilt: "Bau fertig",

  // weapons (plugin names override these)
  cannon: "Kanone",
  catapult: "Katapult",
  // compass (German letters: O = Ost)
  dirN: "N", dirE: "O", dirS: "S", dirW: "W",
  enemy: "Gegner",
  // messages
  windChanged: "Der Wind hat gedreht!",
  weaponLoaded: "{name} geladen",
  weaponDestroyed: "{name} zerstört!",
  rulerDied: "Der Herrscher ist gefallen!",
  victory: "Sieg!",
  defeat: "Niederlage!",
  shotFired: "Schuss!", // TB1 integration
  hit: "Treffer! Palast {pct}%",
  miss: "Daneben!",
  enemyFires: "Der Gegner feuert!",
  notEnoughGold: "Nicht genug Gold!",
  invalidPlacement: "Hier kann nicht gebaut werden",
  // menus (shots 01, 02)
  gameTitle: "Hohenfeuer",
  skirmish: "Gefecht",
  options: "Optionen",
  quit: "Beenden",
  back: "Zurück",
  start: "Starten",
  resume: "Weiter",
  pause: "Pause",
  players: "Spieler",
  aiLevel: "KI-Stärke",
  tactic: "Taktik",
  tacticWorrier: "Zauderer",
  tacticGeneral: "General",
  tacticDaredevil: "Draufgänger",
  startGold: "Startgold",
  windStrength: "Windstärke",
  windChange: "Windwechsel",
  map: "Karte",
  biome: "Landschaft",
  forest: "Wald", desert: "Wüste", ice: "Eis", volcano: "Vulkan",
  off: "Aus",
  language: "Sprache",
  langName: "Deutsch",
  // title, setup, options, pause, end screen (main menu, scenario and hot-seat captures)
  mainMenu: "Hauptmenü",
  tutorial: "Tutorial",
  credits: "Mitwirkende",
  exit: "Beenden",
  pressKey: "Taste drücken",
  seed: "Startwert",
  slotTeam: "Team",
  slotController: "Spieler/KI-Stufe",
  slotName: "Name",
  human: "Mensch",
  aiLevelN: "KI {n}",
  settings: "Einstellungen",
  sensitivity: "Mausempfindlichkeit",
  volume: "Lautstärke",
  restart: "Neustart",
  title: "Zum Titel",
  continue: "Weiter",
  draw: "Unentschieden!",
  winner: "Sieger: {name}",
  duration: "Spieldauer {m}:{ss}",
  shots: "Schüsse",
  hits: "Treffer",
  damage: "Schaden",
  losses: "Verluste",
  version: "Hohenfeuer, Version 0.4",
  tutorialStub: "Das Tutorial folgt in einer späteren Version.",
  tutorialHint: "Bis dahin: Gefecht wählen, mit E die Kanone bemannen,",
  tutorialHint2: "mit den Pfeiltasten zielen und mit der Leertaste feuern.",
  creditsLine1: "Hohenfeuer - eine Neuinterpretation von Ballerburg",
  creditsLine2: "Burg, Geschütze und Gelände: prozedural und in Blender",
  creditsLine3: "Oberfläche: von Hand nachgezeichnet",
  creditsLine4: "three.js, vite, Playwright",
  helpMap: "Die Landschaft für das Gefecht.",
  helpSeed: "Startwert für Wind, Gelände und Streuung.",
  helpSlot: "Mensch oder Computergegner (KI 1 bis 10).",
  helpTactic: "Zauderer bauen, Draufgänger schießen.",
  helpWind: "Je stärker der Wind, desto mehr treiben die Kugeln ab.",
  helpGold: "Gold zu Beginn des Gefechts.",
  helpStart: "Das Gefecht beginnen.",
  helpBack: "Zurück zum Hauptmenü.",
  helpSensitivity: "Wie schnell die Maus den Blick dreht.",
  helpLanguage: "Sprache der Oberfläche.",
  helpVolume: "Lautstärke der Geräusche.",
  followCam: "Trefferansicht folgt",
  helpFollowCam: "Nach dem Schuss der Kugel folgen.",
  on: "An",
  bubbleAmmo: "Munition!",
  bubbleCrew: "Zur Kanone!",
  bubbleCover: "Deckung!",
  bubbleWall: "Mauer steht!",
  bubbleLoaded: "Geladen!",
  bubbleFlee: "Rückzug!",
  bandBold: "Mutig",
  bandSteady: "Ruhig",
  bandUneasy: "Unruhig",
  bandDespair: "Verzagt",
};

const en = {
  // Repair wave 3: contextual directions, terminal shots and loss triggers.
  populationNear: "Population {pop}, surrender below {line}",
  palaceRepair: "Repair {pct}%",
  shotLostFar: "Left the map beyond the far wall / reduce charge",
  shotLostShort: "Fell short of the map",
  shotLost: "Shot lost / no impact observed",
  impactOwnWall: "Own wall blocked shot / clear the firing lane",
  impactEnemyWall: "Enemy wall hit / shot intercepted",
  winEliminated: "{name} was eliminated.",
  winRuler: "{name} lost their ruler.",
  winRulerCause: "{name} lost their ruler to {cause}.",
  winPalace: "{name}: palace at {pct}%, below the {line}% defeat line.",
  winPalaceFallback: "{name}'s palace was destroyed.",
  winPopulation: "{name} surrendered: population {pop}, below {line}.",
  winMorale: "{name} surrendered: morale at or below {line}% for {s} s.",
  winSurrender: "{name} surrendered.",
  optionDirection: "{dir}, {m} m",
  optionAhead: "ahead",
  optionLeft: "left",
  optionRight: "right",
  optionBehind: "behind",

  // Repair wave 2: contextual battle feedback.
  incoming: "Incoming from {dir} / impact in {s} s",
  palaceBar: "Palace {pct}% / defeat below {line}%",
  palaceRising: "From minute 10 the defeat line rises to 55%.",
  palaceReached: "Defeat line now 55%. Keep the palace above it.",
  pressureLosses: "losses",
  pressureDamage: "bombardment",
  pressurePalace: "palace damage",
  pressureFire: "fire",
  pressureStrain: "battle strain",
  pressureGuns: "lost guns",
  pressurePopulation: "population loss",
  pressureRally: "successful hits",
  pressureRecovery: "recovery",
  surrenderHold: "{cause} / surrender {s}/{total} s",
  surrenderPopulation: "{cause} / population {pop} < {line}: surrender",
  pressureSafe: "{cause} / surrender at {line}% morale",
  idleCrew: "Missing crew",
  idleAmmo: "No ammunition",
  idleGold: "Not enough gold",
  idleBlocked: "Firing lane blocked",
  idleDamaged: "Gun damaged",
  idleWait: "Wait for reload",
  idleMan: "E: man gun, call crew",
  idleCrewComing: "Crew ordered; waiting",
  idleOrder: "Q: call crew",
  idleApproach: "Walk to the gun",
  idleHauler: "Hauler en route",
  idleAmmoOrder: "R: prioritize ammunition",
  idleSupply: "Check the magazine",
  idleIncome: "Wait for income",
  idleTurn: "Arrows: aim for a clear lane",
  idleInspect: "Inspect the block in front of the muzzle",
  idleOtherGun: "Go to an intact gun",
  impactShort: "{m} m short",
  impactLong: "{m} m long",
  impactLeft: "{m} m left",
  impactRight: "{m} m right",
  impactRangeOn: "Range on mark",
  impactLineOn: "Line on mark",
  impactPalace: "Palace damaged",
  impactWall: "Wall hit",
  impactGun: "Gun hit",
  impactPerson: "Person hit",
  impactGround: "Ground / miss",
  aimReference: "Last shot: {az} deg / charge {charge}",
  aimLegend: "Cross: aim / ring: last impact",
  castleNumber: "Castle {n}",
  enemyWeapon: "weapon",
  unknownBearing: "unknown direction",
  lossRulerShot: "{time}: {name} killed your ruler with {weapon} from {dir}.",
  lossRuler: "{time}: Your ruler died from {cause}.",
  deathFall: "a fall",
  deathFire: "fire",
  deathBlast: "an explosion",
  deathDamage: "injuries",
  deathCollapse: "collapsing masonry",
  deathProjectile: "a projectile",
  lossPalace: "{time}: Palace at {pct}%, below the {line}% defeat line.",
  lossPalaceFallback: "{time}: Your palace was destroyed.",
  lossSurrender: "{time}: Your castle surrendered; strongest pressure: {cause}.",
  lossSurrenderFallback: "{time}: Your castle surrendered.",
  lossFallback: "{time}: Your castle was eliminated.",
  accountEvent: "{time} / {event}",
  accountIncoming: "Incoming shot near ruler",
  accountGun: "Own gun destroyed",
  accountMagazine: "Magazine exploded",
  accountPalace: "Palace breached",
  accountRuler: "Ruler killed",
  accountSurrender: "Castle surrendered",
  accountDamage: "Castle damaged",
  accountLosses: "{n} people lost",
  retry: "Enter: Retry",
  decisiveEvents: "Decisive events",
  optionRepair: "R: repair / {cost} gold / restore cover",
  optionBuild: "B + click: stone / {cost} gold / close gap",
  optionReplacement: "G + click: cannon / {cost} gold / restore firepower",
  optionCrew: "Q: call crew / 0 gold / enable reloading",
  optionMan: "E: man gun / 0 gold / crew comes",
  optionCover: "E + WASD: seek cover / pause aiming",
  optionCoverWalk: "WASD: seek cover / travel time",
  leaveForOrder: "E: leave gun, turn toward the site",
  repairProgress: "Repair {pct}%",
  repairQueued: "Repair queued {pct}%",
  buildProgress: "Building {pct}%",
  catapultFound: "Catapult discovered",
  quickStart: "Quick start",
  quickStartHint: "Forest duel / AI 2 / Cannon and stone",
  promptMan: "E: Man cannon",
  promptFire: "Space: Fire",
  promptBuild: "B: Build",
  chargeUnit: "Charge 1-255",
  rangeEstimate: "approx. {m} m (no wind)",
  incomeRate: "Income +{rate} gold/s",
  aimHint: "Arrows: Aim",
  leaveHint: "E: Leave",
  walkHint: "WASD: Walk",
  buildHint: "B: Build",
  buildConfirmFull: "Click: Build / Right: Scrap, cancel",
  buildConfirm: "Click: Build / Right: Cancel",
  cycleHint: "PgUp/PgDn: Select",
  placementHint: "G: Place weapon",
  jobsHint: "Tab: Jobs",
  shelterHint: "X: Shelter",
  repairHint: "R: Priority",
  crewHint: "Q: Crew",
  autoFireHint: "F: Fire at will",
  restoreHint: "Home: Reset",
  impactHint: "End: Impact view",
  newTriage: "Wall damaged? R: Repair first. The pennant shows morale.",
  newPlacement: "G: Place weapon. Select with wheel / PgUp/PgDn.",
  newAutoFire: "F: Fire at will. The crew keeps firing after reloading.",
  newOrders: "X: Shelter. Crew and job orders are now visible.",
  newArsenal6: "G: Double cannon and ballista available.",
  newArsenal7: "G: Fire catapult available.",
  newArsenal8: "G: Trebuchet available.",
  newArsenal9: "G: Rocket and arcaballista available.",
  newArsenal10: "G: Fat Freda and Hellfire. All building types available.",
  newCatapult: "10 cannon shots: catapult discovered. Place it from match 3.",
  crewAuto: "Crew ordered automatically.",
  moraleLoss: "Morale falling: losses in the castle.",
  moraleDamage: "Morale falling: castle under fire.",
  moraleRally: "Morale rising: hit on the enemy.",
  moraleQuiet: "Morale rising: recovering after fighting.",
  moraleStrain: "Morale falling: after-effects of fighting.",
  moraleStatus: "Morale: {band}",
  arsenalHint: "{name} / Wheel: Select",

  reloading: "Reloading", // Lädt nach
  loaded: "Loaded", // geladen
  fireCost: "{cost} Gold", // {cost} Gold
  weaponCondition: "{name} ({pct}%)",
  fireAtWill: "Fire at will", // Feuer frei
  crew: "Crew", // Mannschaft
  restore: "Reset", // Zurücksetzen
  impactView: "Impact view", // Trefferansicht
  demolish: "Scrap", // Abreißen
  repair: "Repair", // Reparieren
  morale: "Morale", // Moral
  shelter: "Shelter", // Schutzraum
  build: "Build", // Bauen
  placeWeapon: "Place weapon", // Waffe setzen
  cost: "{name}: {cost} Gold",
  buildLedger: "Gold {gold} / Reserved {reserved}",
  designationAdded: "Construction designated",
  designationCancelled: "Designation cancelled",
  demolitionOrdered: "Demolition ordered",
  blockBuilt: "Construction complete",

  cannon: "Cannon", // Kanone
  catapult: "Catapult", // Katapult
  dirN: "N", dirE: "E", dirS: "S", dirW: "W", // N O S W
  enemy: "Opponent", // Gegner
  windChanged: "The wind has changed!", // Der Wind hat gedreht!
  weaponLoaded: "{name} loaded", // {name} geladen
  weaponDestroyed: "{name} destroyed!", // {name} zerstört!
  rulerDied: "The ruler has fallen!", // Der Herrscher ist gefallen!
  victory: "Victory!", // Sieg!
  defeat: "Defeat!", // Niederlage!
  shotFired: "Shot!", // Schuss! (TB1 integration)
  hit: "Hit! Palace {pct}%", // Treffer! Palast {pct}%
  miss: "Missed!", // Daneben!
  enemyFires: "The enemy fires!", // Der Gegner feuert!
  notEnoughGold: "Not enough gold!", // Nicht genug Gold!
  invalidPlacement: "Cannot build here", // Hier kann nicht gebaut werden
  gameTitle: "Hohenfeuer",
  skirmish: "Skirmish", // Gefecht
  options: "Options", // Optionen
  quit: "Quit", // Beenden
  back: "Back", // Zurück
  start: "Start", // Starten
  resume: "Resume", // Weiter
  pause: "Pause", // Pause
  players: "Players", // Spieler
  aiLevel: "AI level", // KI-Stärke
  tactic: "Tactic", // Taktik
  tacticWorrier: "Worrier", // Zauderer
  tacticGeneral: "General", // General
  tacticDaredevil: "Daredevil", // Draufgänger
  startGold: "Start gold", // Startgold
  windStrength: "Wind strength", // Windstärke
  windChange: "Wind change", // Windwechsel
  map: "Map", // Karte
  biome: "Biome", // Landschaft
  forest: "Forest", desert: "Desert", ice: "Ice", volcano: "Volcano", // Wald Wüste Eis Vulkan
  off: "Off", // Aus
  language: "Language", // Sprache
  langName: "English",
  mainMenu: "Main Menu", // Hauptmenü
  tutorial: "Tutorial", // Tutorial
  credits: "Credits", // Mitwirkende
  exit: "Exit", // Beenden
  pressKey: "Press any key", // Taste drücken
  seed: "Seed", // Startwert
  slotTeam: "Team", // Team
  slotController: "Player/AI level", // Spieler/KI-Stufe
  slotName: "Name", // Name
  human: "Human", // Mensch
  aiLevelN: "AI {n}", // KI {n}
  settings: "Settings", // Einstellungen
  sensitivity: "Mouse sensitivity", // Mausempfindlichkeit
  volume: "Volume", // Lautstärke
  restart: "Restart", // Neustart
  title: "Back to title", // Zum Titel
  continue: "Continue", // Weiter
  draw: "Draw!", // Unentschieden!
  winner: "Winner: {name}", // Sieger: {name}
  duration: "Duration {m}:{ss}", // Spieldauer
  shots: "Shots", // Schüsse
  hits: "Hits", // Treffer
  damage: "Damage", // Schaden
  losses: "Losses", // Verluste
  version: "Hohenfeuer, version 0.4",
  tutorialStub: "The tutorial will follow in a later version.",
  tutorialHint: "Until then: pick Skirmish, press E to man the cannon,",
  tutorialHint2: "aim with the arrow keys and fire with Space.",
  creditsLine1: "Hohenfeuer - a re-imagining of Ballerburg",
  creditsLine2: "Castle, guns and terrain: procedural and Blender",
  creditsLine3: "Interface: redrawn by hand",
  creditsLine4: "three.js, vite, Playwright",
  helpMap: "The landscape for the battle.",
  helpSeed: "Seed for wind, terrain and scatter.",
  helpSlot: "Human or computer opponent (AI 1 to 10).",
  helpTactic: "Worriers build, daredevils shoot.",
  helpWind: "The stronger the wind, the more the balls drift.",
  helpGold: "Gold at the start of the battle.",
  helpStart: "Begin the battle.",
  helpBack: "Back to the main menu.",
  helpSensitivity: "How fast the mouse turns the view.",
  helpLanguage: "Interface language.",
  helpVolume: "Sound volume.",
  followCam: "Follow shot", // Trefferansicht folgt
  helpFollowCam: "Follow the ball after firing.", // Nach dem Schuss der Kugel folgen.
  on: "On", // An
  bubbleAmmo: "Ammo!", // Munition!
  bubbleCrew: "To the gun!", // Zur Kanone!
  bubbleCover: "Take cover!", // Deckung!
  bubbleWall: "Wall's up!", // Mauer steht!
  bubbleLoaded: "Loaded!", // Geladen!
  bubbleFlee: "Fall back!", // Rückzug!
  bandBold: "Bold", // Mutig
  bandSteady: "Steady", // Ruhig
  bandUneasy: "Uneasy", // Unruhig
  bandDespair: "Despairing", // Verzagt
};

export const STRINGS = Object.freeze({ de: Object.freeze(de), en: Object.freeze(en) });

/**
 * Look up and format a string; unknown keys return the key, unknown languages fall back to German.
 * @param {string} key @param {string} [lang] @param {Object<string, string|number>} [params]
 */
export function t(key, lang = DEFAULT_LANG, params) {
  const table = STRINGS[lang] || STRINGS[DEFAULT_LANG];
  const s = table[key];
  if (s === undefined) return key;
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m)) : s;
}
