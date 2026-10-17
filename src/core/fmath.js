// src/core/fmath.js - owns deterministic elementary functions using fixed IEEE arithmetic.
/** Radians in a half turn. Coefficients are literals, never host transcendental calls. */
export const PI = 3.141592653589793;
export const TAU = 6.283185307179586;
export const DEG = PI / 180;
const LN2 = 0.6931471805599453;
const SQRT2 = 1.4142135623730951;

/** Sine with turn reduction and a fixed Taylor polynomial (simulation angles). */
export function sin(x) {
  if (!Number.isFinite(x)) return NaN;
  x -= Math.floor((x + PI) / TAU) * TAU;
  if (x > PI / 2) x = PI - x;
  if (x < -PI / 2) x = -PI - x;
  const xx = x * x;
  let term = x, sum = x;
  for (let n = 1; n <= 13; n++) { term *= -xx / ((2 * n) * (2 * n + 1)); sum += term; }
  return sum;
}
/** Cosine, radians. */
export function cos(x) { return sin(x + PI / 2); }
function atan(x) {
  const negative = x < 0;
  x = Math.abs(x);
  const invert = x > 1;
  if (invert) x = 1 / x;
  const reduce = x > SQRT2 - 1;
  if (reduce) x = (x - 1) / (x + 1);
  let term = x, sum = x;
  for (let n = 1; n <= 26; n++) { term *= -x * x; sum += term / (2 * n + 1); }
  if (reduce) sum += PI / 4;
  if (invert) sum = PI / 2 - sum;
  return negative ? -sum : sum;
}
/** Quadrant-aware inverse tangent, including signed zero and infinite inputs. */
export function atan2(y, x) {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  if (y === 0) return x < 0 || Object.is(x, -0) ? (Object.is(y, -0) ? -PI : PI) : y;
  if (x === 0) return y > 0 ? PI / 2 : -PI / 2;
  if (!Number.isFinite(x) && !Number.isFinite(y)) return (x > 0 ? PI / 4 : 3 * PI / 4) * (y > 0 ? 1 : -1);
  const a = atan(y / x);
  return x < 0 ? a + (y > 0 ? PI : -PI) : a;
}
/** Square root via exact power-of-four scaling and eight Newton iterations. */
export function sqrt(x) {
  if (x === 0 || x === Infinity) return x;
  if (x < 0 || Number.isNaN(x)) return NaN;
  let scale = 1;
  while (x >= 4) { x *= 0.25; scale *= 2; }
  while (x < 1) { x *= 4; scale *= 0.5; }
  let root = (x + 1) * 0.5;
  for (let i = 0; i < 8; i++) root = (root + x / root) * 0.5;
  return root * scale;
}
/** Natural exponential with ln(2) reduction and fixed series. */
export function exp(x) {
  if (Number.isNaN(x)) return NaN;
  if (x > 709.782712893384) return Infinity;
  if (x < -745.1332191019411) return 0;
  const n = Math.floor(x / LN2 + 0.5), r = x - n * LN2;
  let term = 1, sum = 1;
  for (let i = 1; i <= 20; i++) { term *= r / i; sum += term; }
  // Scale in bounded chunks to retain subnormals and avoid premature overflow.
  let k = n;
  while (k > 0) { sum *= 2; k--; }
  while (k < 0) { sum *= 0.5; k++; }
  return sum;
}
/** Natural logarithm via power-of-two reduction and the atanh series. */
export function log(x) {
  if (x === 0) return -Infinity;
  if (x < 0 || Number.isNaN(x)) return NaN;
  if (x === Infinity) return Infinity;
  let n = 0;
  while (x >= 2) { x *= 0.5; n++; }
  while (x < 1) { x *= 2; n--; }
  const z = (x - 1) / (x + 1), zz = z * z;
  let term = z, sum = z;
  for (let i = 1; i <= 32; i++) { term *= zz; sum += term / (2 * i + 1); }
  return n * LN2 + 2 * sum;
}
/** Real power; integer powers use multiplication to preserve exact small powers. */
export function pow(x, y) {
  if (y === 0) return 1;
  if (Number.isInteger(y) && Math.abs(y) < 2147483648) {
    let n = Math.abs(y), base = x, result = 1;
    while (n) { if (n % 2) result *= base; base *= base; n = Math.floor(n / 2); }
    return y < 0 ? 1 / result : result;
  }
  if (x === 0) return y > 0 ? 0 : Infinity;
  return exp(y * log(x));
}
