// Owns the render-only style registry and deterministic boot/quality selection.
import { TUNING } from '../tuning.js';

export const STYLES = Object.freeze({
  classic: Object.freeze({ name: 'classic', label: 'Classic', post: false }),
  modern: Object.freeze({ name: 'modern', label: 'Modern', post: true }),
});
// Period deliberately has no alias: castle-game-uo7.1 will register its own implementation.
export const resolveStyle = name => Object.hasOwn(STYLES, name) ? STYLES[name] : STYLES.classic;
export function readStyle(params = new URLSearchParams(), storage) {
  if (params.has('style')) return resolveStyle(params.get('style')).name;
  if (params.get('golden') === '1') return 'classic';
  try { return resolveStyle(JSON.parse(storage?.getItem('hohenfeuer.options') ?? '{}')?.style).name; }
  catch { return 'classic'; }
}
export const gpuExtrasEnabled = ({ style, golden = false, requested = TUNING.render.gpuExtras } = {}) =>
  resolveStyle(style).name === 'modern' && !golden && requested === true;
