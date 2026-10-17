// src/ui/overlay.js - owns the NPC readability layer of the HUD: job marker icons, speech bubbles from sim events, and the morale band.
// Pure apart from drawOverlays (canvas 2D). main.js projects world positions to logical HUD pixels;
// bubbles live BUBBLE_LIFE_TICKS sim ticks (2 s), so they are deterministic on the golden path.

import { EV, JOB, NPC_STATE, ROLE } from "../contracts.js";
import { TUNING } from "../tuning.js";
import { t } from "./i18n.js";
import { drawText, measure } from "./font.js";
import { roundRectPath, circlePath } from "./paint.js";

export const MARKER = Object.freeze({ HAMMER: "hammer", SHELL: "shell", FLAME: "flame", BED: "bed" });
export const BUBBLE_LIFE_TICKS = 2 * TUNING.sim.tickHz;
const COOLDOWN_TICKS = 3 * TUNING.sim.tickHz;
const MAX_BUBBLES = 4;
const BUILD_KINDS = new Set([JOB.BUILD, JOB.REPAIR, JOB.DEMOLISH]);

/** Icon above an NPC, or null. @param {object} npc sim NPC @param {string|null} jobKind kind of its claimed job */
export function npcMarker(npc, jobKind) {
  if (!npc || npc.hp <= 0 || npc.state === NPC_STATE.DEAD) return null;
  if (npc.state === NPC_STATE.FLEE) return MARKER.FLAME;
  if (npc.state === NPC_STATE.SHELTER) return MARKER.BED;
  if (npc.carrying > 0 || jobKind === JOB.HAUL_AMMO) return MARKER.SHELL;
  if (BUILD_KINDS.has(jobKind) && (npc.state === NPC_STATE.WALK || npc.state === NPC_STATE.WORK)) return MARKER.HAMMER;
  return null;
}

const BANDS = ["bandBold", "bandSteady", "bandUneasy", "bandDespair"];
const BAND_COLORS = ["#4cc84a", "#c8c83c", "#e08a2c", "#d83a2a"];
/** Morale band per TUNING.morale.workBands: {index, color, name}. */
export function moraleBand(m, lang = "de") {
  const bands = TUNING.morale.workBands;
  let i = bands.findIndex(([min]) => m >= min);
  if (i < 0) i = bands.length - 1;
  return { index: i, color: BAND_COLORS[Math.min(i, BAND_COLORS.length - 1)], name: t(BANDS[Math.min(i, BANDS.length - 1)], lang) };
}

const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
function nearest(list, p) { let best = null, bd = Infinity; for (const n of list) { const d = d2(n.pos, p); if (d < bd) { bd = d; best = n; } } return best; }

/** Speech bubbles keyed to own NPCs (the local slot); one line per entity, a cooldown per line. */
export function createBubbles() {
  const items = [];
  const lastSaid = new Map();
  return {
    /** @param {Array<{type: string, payload: object}>} events @param {object} state sim state @param {{slot: number, lang?: string}} o */
    onEvents(events, state, o) {
      const tick = state.tick, own = state.npcs.filter((n) => n.slot === o.slot && n.hp > 0 && !n.deserted);
      const say = (npc, key) => {
        if (!npc || (lastSaid.has(key) && tick - lastSaid.get(key) < COOLDOWN_TICKS)) return;
        lastSaid.set(key, tick);
        for (let i = items.length - 1; i >= 0; i--) if (items[i].entityId === npc.id) items.splice(i, 1);
        items.push({ entityId: npc.id, text: t(key, o.lang), tick });
        while (items.length > MAX_BUBBLES) items.shift();
      };
      for (const e of events) {
        const p = e.payload || {};
        if (e.type === EV.JOB_CLAIMED && p.castle === o.slot && (p.kind === JOB.HAUL_AMMO || p.kind === JOB.CREW)) {
          say(own.find((n) => n.jobId === p.jobId), p.kind === JOB.HAUL_AMMO ? "bubbleAmmo" : "bubbleCrew");
        } else if (e.type === EV.BLOCK_BUILT && p.plot === o.slot && p.cell) {
          const c = state.castles.find((x) => x.id === p.plot), org = c.plot.origin;
          say(nearest(own.filter((n) => n.role === ROLE.MASON), { x: org.x + p.cell[0] + 0.5, y: org.y + p.cell[1], z: org.z + p.cell[2] + 0.5 }), "bubbleWall");
        } else if (e.type === EV.SHELTER_TOGGLED && p.slot === o.slot && p.on) {
          say(own.find((n) => n.role === ROLE.CIVILIAN) ?? own[0], "bubbleCover");
        } else if (e.type === EV.WEAPON_LOADED) {
          const w = state.weapons.find((x) => x.id === p.weaponId);
          if (w && w.slot === o.slot) say(nearest(own.filter((n) => n.role === ROLE.CREW), w.pos), "bubbleLoaded");
        } else if (e.type === EV.NPC_FLED && p.castle === o.slot) {
          say(own.find((n) => n.id === p.entityId), "bubbleFlee");
        }
      }
    },
    /** Bubbles alive at `tick`. */
    visible(tick) { return items.filter((b) => tick >= b.tick && tick - b.tick < BUBBLE_LIFE_TICKS); },
  };
}

/* ------------------------------------------------------------------ drawing */

function plate(ctx, x, y, s) {
  circlePath(ctx, x, y, 9 * s); ctx.fillStyle = "rgba(16,14,12,0.78)"; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = "#d8d0c4"; ctx.stroke();
}

const ICONS = {
  [MARKER.HAMMER](ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.6); ctx.scale(s, s);
    ctx.fillStyle = "#b07a44"; ctx.fillRect(-1.2, -2, 2.4, 9);
    ctx.fillStyle = "#c8ccd0"; ctx.fillRect(-4.5, -5, 9, 4);
    ctx.restore();
  },
  [MARKER.SHELL](ctx, x, y, s) {
    circlePath(ctx, x, y, 4.5 * s); ctx.fillStyle = "#2e2e30"; ctx.fill();
    circlePath(ctx, x - 1.5 * s, y - 1.5 * s, 1.6 * s); ctx.fillStyle = "#b8bcc4"; ctx.fill();
  },
  [MARKER.FLAME](ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y - 6 * s);
    ctx.quadraticCurveTo(x + 6 * s, y, x, y + 5 * s);
    ctx.quadraticCurveTo(x - 6 * s, y, x, y - 6 * s);
    ctx.fillStyle = "#f07020"; ctx.fill();
    circlePath(ctx, x, y + 1.5 * s, 2 * s); ctx.fillStyle = "#ffd850"; ctx.fill();
  },
  [MARKER.BED](ctx, x, y, s) {
    ctx.fillStyle = "#8a5a34"; ctx.fillRect(x - 6 * s, y - 1 * s, 12 * s, 4 * s);
    ctx.fillStyle = "#e8e2d4"; ctx.fillRect(x - 5 * s, y - 4 * s, 4 * s, 3 * s);
    ctx.fillStyle = "#5a7ab8"; ctx.fillRect(x - 1 * s, y - 3 * s, 6 * s, 2 * s);
  },
};

/**
 * Draw markers (plate + icon) and speech bubbles at projected logical positions.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{markers?: Array<{x: number, y: number, icon: string, scale?: number}>, bubbles?: Array<{x: number, y: number, text: string}>}} o
 * @param {(s: string) => void} [note]
 */
export function drawOverlays(ctx, o, note = () => {}) {
  for (const m of o.markers ?? []) {
    const s = m.scale ?? 1;
    plate(ctx, m.x, m.y, s);
    ICONS[m.icon]?.(ctx, m.x, m.y, s);
  }
  for (const b of o.bubbles ?? []) {
    const size = measure(b.text, { bold: true });
    const w = size.w + 12, h = 18, x0 = Math.round(b.x - w / 2), y0 = Math.round(b.y - h - 8);
    roundRectPath(ctx, x0, y0, x0 + w, y0 + h, 6);
    ctx.fillStyle = "#fbf6ea"; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = "#2a2018"; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x - 4, y0 + h - 0.5); ctx.lineTo(b.x, y0 + h + 7); ctx.lineTo(b.x + 4, y0 + h - 0.5); ctx.closePath();
    ctx.fillStyle = "#fbf6ea"; ctx.fill();
    drawText(ctx, b.text, x0 + 6, y0 + 1, { bold: true, color: "#1a120a" });
    note(b.text);
  }
}
