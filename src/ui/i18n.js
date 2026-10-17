// src/ui/i18n.js - owns every user-visible UI string, German (default, the original's wording) and English.
// Pure data + one formatter. German values are the 2001 original's labels where one existed
// (shots 03, 04, 12, 16); English values are ours. Placeholders: {name}.

/** Supported languages; German first (DESIGN 7.5: German default). */
export const LANGS = Object.freeze(["de", "en"]);
export const DEFAULT_LANG = "de";

const de = {
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
};

const en = {
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
