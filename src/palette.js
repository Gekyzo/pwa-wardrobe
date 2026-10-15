import { COLORS } from '#wada';

export { COLORS };

const HEX = /^#[0-9a-f]{6}$/i;

// sRGB to linear light.
const linear = (byte) => {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

// The CIE function of a ratio to the white point.
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);

// The CIELAB value of an sRGB hex colour, D65 white.
export const labOf = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => linear(parseInt(hex.slice(i, i + 2), 16)));
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const [fx, fy, fz] = [x, y, z].map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

// CIE76: the straight distance of two Lab values.
export const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Computed once from the hex of each colour, so that every distance uses one conversion.
const LABS = COLORS.map(({ hex }) => labOf(hex));

export const distance = (a, b) => deltaE(LABS[a], LABS[b]);

export const colorOf = (id) => COLORS[id] ?? null;

// The id of the palette colour nearest to `hex`, or null when `hex` is not `#rrggbb`.
export const nearestColor = (hex) => {
  if (typeof hex !== 'string' || !HEX.test(hex)) return null;
  const lab = labOf(hex.toLowerCase());
  let best = 0;
  LABS.forEach((other, id) => {
    if (deltaE(lab, other) < deltaE(lab, LABS[best])) best = id;
  });
  return best;
};

// The ids of the colours within `max` of `id`, `id` included.
export const colorsNear = (id, max) => COLORS.filter((color) => distance(id, color.id) <= max).map((color) => color.id);

const byNumber = new Map();
COLORS.forEach(({ id, combinations }) => {
  combinations.forEach((n) => byNumber.set(n, [...(byNumber.get(n) ?? []), id]));
});

export const COMBINATIONS = [...byNumber.keys()].sort((a, b) => a - b).map((number) => ({ number, colors: byNumber.get(number) }));

export const combination = (n) => byNumber.get(n) ?? null;

export const combinationsOf = (id) => [...(colorOf(id)?.combinations ?? [])];

// The numbers of the combinations of `k` colours, or of all of them when `k` is null.
export const combinationsBySize = (k) => COMBINATIONS.filter(({ colors }) => k === null || colors.length === k).map(({ number }) => number);
