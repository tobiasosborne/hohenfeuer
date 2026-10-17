// src/core/loop.js - owns the fixed-step browser clock boundary and visibility pause.
import { TUNING as T } from '../tuning.js';
/** Fixed-step accumulator; advance() accepts seconds and performs no clock reads.
 * start() optionally connects injected animation-frame and visibility IO.
 */
export function createLoop({ tick, render = () => {}, dt = 1 / T.sim.tickHz, maxFrameDt = T.sim.dtClampS, maxTicks = T.sim.maxTicksPerFrame, requestFrame, cancelFrame, visibility } = {}) {
  if (typeof tick !== 'function' || !(dt > 0) || !(maxTicks > 0)) throw new TypeError('Invalid loop configuration');
  let accumulator = 0, visible = true, previous = null, handle = null, running = false;
  const loop = {
    get alpha() { return accumulator / dt; },
    setVisible(value) { visible = Boolean(value); accumulator = 0; previous = null; },
    advance(elapsed) {
      if (!visible) return { ticks: 0, alpha: 0 };
      accumulator += Math.min(maxFrameDt, Math.max(0, Number.isFinite(elapsed) ? elapsed : 0));
      let ticks = 0;
      while (accumulator + dt * 1e-12 >= dt && ticks < maxTicks) { tick(); accumulator = Math.max(0, accumulator - dt); ticks++; }
      if (accumulator >= dt) accumulator %= dt;
      render(accumulator / dt);
      return { ticks, alpha: accumulator / dt };
    },
    start() {
      if (running) return;
      if (!requestFrame) throw new TypeError('start requires requestFrame');
      running = true; previous = null;
      if (visibility) { visibility.addEventListener('visibilitychange', onVisibility); onVisibility(); }
      handle = requestFrame(frame);
    },
    stop() { running = false; if (cancelFrame && handle !== null) cancelFrame(handle); handle = null; previous = null; visibility?.removeEventListener('visibilitychange', onVisibility); },
  };
  function onVisibility() { loop.setVisible(!visibility.hidden); }
  function frame(ms) { if (!running) return; const seconds = previous === null ? 0 : (ms - previous) / 1000; previous = ms; loop.advance(seconds); handle = requestFrame(frame); }
  return loop;
}
