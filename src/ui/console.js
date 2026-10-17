// src/ui/console.js - owns the HUD message log (tick-stamped, capped, expiring) and the EV -> message mapping.
// Pure apart from drawMessages, which paints the log into the top-left info box.

import { EV } from "../contracts.js";
import { t } from "./i18n.js";
import { drawText, FONT, measure } from "./font.js";

/** Message tones -> text colours. */
export const TONE = Object.freeze({ INFO: "info", GOOD: "good", BAD: "bad" });
const TONE_COLOR = { info: "#ffffff", good: "#9cf08c", bad: "#ff8a7a" };

/**
 * @param {{max?: number, ttlTicks?: number}} [o] max visible lines (4) and lifetime (10 s at 30 Hz)
 */
export function createMessageLog(o = {}) {
  const max = o.max ?? 4, ttl = o.ttlTicks ?? 300;
  const items = [];
  return {
    /** @param {string} text @param {{tick: number, tone?: string}} m */
    push(text, m) {
      items.push({ text, tick: m.tick, tone: m.tone || TONE.INFO });
      if (items.length > 64) items.splice(0, items.length - 64);
    },
    /** Newest `max` messages still alive at `tick`, oldest first. */
    visible(tick) { return items.filter((m) => tick - m.tick < ttl && tick >= m.tick).slice(-max); },
    clear() { items.length = 0; },
  };
}

/**
 * Sim events worth a line in the log, for the local slot.
 * @param {Array<{type: string, payload: object}>} events @param {{lang?: string, slot: number, weaponName?: (id: number) => string}} o
 * @returns {Array<{text: string, tone: string}>}
 */
export function eventsToMessages(events, o) {
  const out = [];
  const name = (id) => (o.weaponName ? o.weaponName(id) : t("cannon", o.lang));
  for (const e of events) {
    const p = e.payload || {};
    switch (e.type) {
      case EV.WIND_CHANGED: out.push({ text: t("windChanged", o.lang), tone: TONE.INFO }); break;
      case EV.RULER_DIED: out.push({ text: t("rulerDied", o.lang), tone: TONE.BAD }); break;
      case EV.WEAPON_DESTROYED:
        if (p.slot === o.slot) out.push({ text: t("weaponDestroyed", o.lang, { name: name(p.weaponId) }), tone: TONE.BAD });
        break;
      case EV.GAME_OVER: {
        const won = (p.winners || []).includes(o.slot);
        out.push({ text: t(won ? "victory" : "defeat", o.lang), tone: won ? TONE.GOOD : TONE.BAD });
        break;
      }
      default: break;
    }
  }
  return out;
}

/** Wrap by actual bitmap widths; retain at most the panel's newest rows. */
export function messageLines(messages, width, max = 4) {
  const rows = [];
  for (const m of messages) {
    let line = "";
    for (const ch of m.text) {
      if (line && measure(line + ch, { bold: true, outline: true }).w > width) {
        rows.push({ ...m, text: line.trimEnd() }); line = "";
      }
      line += ch;
    }
    if (line.trim()) rows.push({ ...m, text: line.trim() });
  }
  return rows.slice(-max);
}

/**
 * Paint messages (oldest first) into a text rect, one line each.
 * @param {CanvasRenderingContext2D} ctx @param {{x0: number, y0: number, x1: number, y1: number}} rect
 * @param {Array<{text: string, tone?: string}>} messages @param {(s: string) => void} [note]
 */
export function drawMessages(ctx, rect, messages, note = () => {}) {
  const lineH = FONT.rows + 4;
  const n = Math.min(messages.length, Math.floor((rect.y1 - rect.y0) / lineH));
  const list = messageLines(messages, rect.x1 - rect.x0, n);
  list.forEach((m, i) => {
    drawText(ctx, m.text, rect.x0, rect.y0 + i * lineH, { bold: true, outline: true, color: TONE_COLOR[m.tone] || TONE_COLOR.info });
    note(m.text);
  });
}
