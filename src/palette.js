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

const NUMBER = String.raw`(-?\d+(?:\.\d+)?)`;
// rgb() and rgba(), hsl() and hsla(), with commas or spaces, an optional alpha that is ignored.
const FUNCTION = new RegExp(
  String.raw`^(rgba?|hsla?)\(\s*${NUMBER}(deg|%)?\s*(?:,\s*|\s+)${NUMBER}(%)?\s*(?:,\s*|\s+)${NUMBER}(%)?\s*(?:(?:,|\/)\s*-?\d+(?:\.\d+)?%?\s*)?\)$`,
  'i',
);

const hexOf = (channels) => `#${channels.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;

const fromHsl = (h, s, l) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return hexOf([f(0), f(8), f(4)]);
};

// A colour text as `#rrggbb`: `#rgb`, `#rrggbb`, `rgb(…)` with 0-255 values or percentages, or
// `hsl(…)` with a hue in degrees and two percentages. Any other text gives null (PAL-4).
export const parseColor = (text) => {
  if (typeof text !== 'string') return null;
  const clean = text.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(clean)) return `#${[...clean.slice(1)].map((digit) => digit + digit).join('')}`;
  if (HEX.test(clean)) return clean;
  const match = FUNCTION.exec(clean);
  if (!match) return null;
  const [, name, first, unit, second, secondPercent, third, thirdPercent] = match;
  const [x, y, z] = [first, second, third].map(Number);
  if (name.startsWith('rgb')) {
    if (unit === 'deg') return null;
    const percent = [unit === '%', secondPercent === '%', thirdPercent === '%'];
    const channels = [x, y, z].map((value, i) => (percent[i] ? (value / 100) * 255 : value));
    return channels.every((value) => value >= 0 && value <= 255) ? hexOf(channels) : null;
  }
  if (unit === '%' || secondPercent !== '%' || thirdPercent !== '%' || y < 0 || y > 100 || z < 0 || z > 100) return null;
  return fromHsl(((x % 360) + 360) % 360, y / 100, z / 100);
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
