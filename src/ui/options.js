// src/ui/options.js - owns the player options (mouse sensitivity, language, volume): allowed values, sanitising, localStorage persistence.
// Pure apart from the storage object passed in (anything with getItem/setItem); every access is guarded.

import { TUNING } from "../tuning.js";
import { LANGS, DEFAULT_LANG } from "./i18n.js";

export const OPTIONS_KEY = "hohenfeuer.options";

const base = TUNING.ruler.mouseSensitivity;
/** Allowed values per option (menus step through these). Sensitivity: 0.25x .. 3x the tuning default. */
export const OPTION_VALUES = Object.freeze({
  sensitivity: Object.freeze([0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3].map((f) => Math.round(base * f * 1e6) / 1e6)),
  lang: Object.freeze([...LANGS]),
  volume: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  followCam: Object.freeze([false, true]),
});

export const DEFAULT_OPTIONS = Object.freeze({ sensitivity: OPTION_VALUES.sensitivity[3], lang: DEFAULT_LANG, volume: 6, followCam: true });

const nearest = (list, v) => list.reduce((best, x) => (Math.abs(x - v) < Math.abs(best - v) ? x : best), list[0]);

/** Snap every option to an allowed value; unknown keys are dropped, missing ones defaulted. */
export function sanitizeOptions(o) {
  const src = o && typeof o === "object" ? o : {};
  const num = (k) => (typeof src[k] === "number" && Number.isFinite(src[k]) ? nearest(OPTION_VALUES[k], src[k]) : DEFAULT_OPTIONS[k]);
  return { sensitivity: num("sensitivity"), lang: OPTION_VALUES.lang.includes(src.lang) ? src.lang : DEFAULT_OPTIONS.lang, volume: num("volume"),
    followCam: typeof src.followCam === "boolean" ? src.followCam : DEFAULT_OPTIONS.followCam };
}

/** Read options; defaults on any missing, broken or inaccessible storage. */
export function loadOptions(storage) {
  try {
    const raw = storage ? storage.getItem(OPTIONS_KEY) : null;
    return raw ? sanitizeOptions(JSON.parse(raw)) : { ...DEFAULT_OPTIONS };
  } catch { return { ...DEFAULT_OPTIONS }; }
}

/** Persist options; returns false when the storage refuses. */
export function saveOptions(storage, o) {
  try { if (!storage) return false; storage.setItem(OPTIONS_KEY, JSON.stringify(sanitizeOptions(o))); return true; } catch { return false; }
}
