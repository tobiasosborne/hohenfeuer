// src/ui/frontend.js - owns the title-screen app: a full-window 2D canvas running the menus until the player starts a skirmish.
// IO. Keyboard and mouse drive src/ui/menus.js; options are persisted through src/ui/options.js.
// Resolves with the chosen skirmish settings; main.js then boots the match on the same page.

import { letterbox, toLogical } from "./layout.js";
import { createMenu, MENU_EVENT } from "./menus.js";
import { drawMenu } from "./menu-draw.js";
import { saveOptions } from "./options.js";

/**
 * @param {{maps: object[], options: object, storage: object|null, screen: string, settings: object|null,
 *   golden?: boolean, onOptions?: (o: object) => void, doc?: Document, win?: Window}} o
 * @returns {Promise<object>} skirmish settings when the player presses Start
 */
export function runFrontEnd(o) {
  const doc = o.doc ?? globalThis.document, win = o.win ?? globalThis;
  const canvas = doc.createElement("canvas");
  Object.assign(canvas.style, { position: "absolute", left: "0", top: "0", display: "block" });
  doc.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const menu = createMenu({ maps: o.maps, screen: o.screen, settings: o.settings ?? undefined, options: o.options });
  let texts = [];

  function render() {
    canvas.width = win.innerWidth; canvas.height = win.innerHeight;
    const lb = letterbox(canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(lb.scale, 0, 0, lb.scale, lb.x, lb.y);
    ctx.imageSmoothingEnabled = false;
    texts = [];
    drawMenu(ctx, menu, { note: (s) => texts.push(s) });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  const logical = (e) => { const b = canvas.getBoundingClientRect(); return toLogical(letterbox(canvas.width, canvas.height), e.clientX - b.left, e.clientY - b.top); };

  return new Promise((resolve) => {
    function handle(ev) {
      if (ev && ev.type === MENU_EVENT.OPTIONS) { if (!o.golden) saveOptions(o.storage, ev.options); o.onOptions?.(ev.options); }
      if (ev && ev.type === MENU_EVENT.START) { dispose(); resolve(ev.settings); return; }
      render();
    }
    const onKey = (e) => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab", "Enter"].includes(e.code)) e.preventDefault(); handle(menu.key(e.code)); };
    const onMove = (e) => { const p = logical(e); const before = menu.focus; menu.pointer(p.x, p.y, false); if (menu.focus !== before) render(); };
    const onDown = (e) => { if (e.button !== 0) return; const p = logical(e); handle(menu.pointer(p.x, p.y, true)); };
    function dispose() {
      win.removeEventListener("keydown", onKey); canvas.removeEventListener("mousemove", onMove); canvas.removeEventListener("mousedown", onDown);
      win.removeEventListener("resize", render); canvas.remove();
    }
    if (!o.golden) {
      win.addEventListener("keydown", onKey);
      canvas.addEventListener("mousemove", onMove);
      canvas.addEventListener("mousedown", onDown);
    }
    win.addEventListener("resize", render);
    render();
    // Debug hook (goldens: index.html?golden=1&screen=<id>); setPose takes the goldens pose object.
    win.__hohenfeuer = {
      frontend: true, menu,
      get texts() { return texts; },
      key(code) { handle(menu.key(code)); return menu.screen; },
      setPose(p) { if (p && typeof p.menuScreen === "string") menu.show(p.menuScreen); render(); return { screen: menu.screen }; },
      render,
      ready: true,
    };
  });
}
