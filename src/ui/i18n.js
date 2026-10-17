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
