import { COLORS, COMBINATIONS, colorOf, combination, deltaE, labOf, lchOf } from '#palette';
import { isNeutral } from '#matching';

// The palette families (FAM-1): Sanzo Wada's book, then sets that colour theories build from the
// same 159 colours. One family is in use at a time.
export const FAMILIES = ['wada', 'complementary', 'analogous', 'triadic', 'split', 'accent', 'mono'];

// The largest CIE76 distance of a target colour from its ideal (FAM-4).
export const FAMILY_MAX = 25;

const LABS = COLORS.map(({ hex }) => labOf(hex));
const ideal = (l, c, h) => [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];

// The palette colour nearest to `lab` among `ids`, out of the colours of the set, and its distance.
const nearestOf = (lab, ids, set) =>
  ids.filter((id) => !set.includes(id)).reduce(
    (best, id) => {
      const d = deltaE(lab, LABS[id]);
      return d < best.d ? { id, d } : best;
    },
    { id: null, d: Infinity },
  );

const ALL = COLORS.map(({ id }) => id);
const NEUTRALS = ALL.filter(isNeutral);
const LIGHT = NEUTRALS.filter((id) => lchOf(id)[0] >= 60);
const DARK = NEUTRALS.filter((id) => lchOf(id)[0] < 40);

// The ideal targets of a base, by family; null for a target with no distance limit (FAM-4).
const hue = (offsets) => (l, c, h) => offsets.map((o) => ({ lab: ideal(l, c, (h + o + 360) % 360), ids: ALL, max: FAMILY_MAX }));
const clamp = (l) => Math.min(98, Math.max(5, l));
const TARGETS = {
  complementary: hue([180]),
  analogous: hue([-30, 30]),
  triadic: hue([120, 240]),
  split: hue([150, 210]),
  mono: (l, c, h) => [-25, 25].map((dl) => ({ lab: ideal(clamp(l + dl), c, h), ids: ALL, max: FAMILY_MAX })),
  accent: (l, c, h) => [LIGHT, DARK].map((ids) => ({ lab: ideal(l, c, h), ids, max: Infinity })),
};

// The set of one base, or null when a target is too far from its ideal.
const setOf = (base, targets) => {
  const set = [base];
  for (const { lab, ids, max } of targets(...lchOf(base))) {
    const { id, d } = nearestOf(lab, ids, set);
    if (id === null || d > max) return null;
    set.push(id);
  }
  return set;
};

const generate = (id) => {
  const seen = new Set();
  const sets = [];
  for (const base of ALL.filter((color) => !isNeutral(color))) {
    const set = setOf(base, TARGETS[id]);
    if (!set) continue;
    const key = [...set].sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    sets.push(set);
  }
  return sets.map((colors, i) => ({ number: i + 1, colors }));
};

const build = (id, combinations) => {
  const byNumber = new Map(combinations.map(({ number, colors }) => [number, colors]));
  const byColor = new Map();
  combinations.forEach(({ number, colors }) => colors.forEach((color) => byColor.set(color, [...(byColor.get(color) ?? []), number])));
  return {
    id,
    combinations,
    combination: (n) => byNumber.get(n) ?? null,
    numbersOf: (color) => [...(byColor.get(color) ?? [])],
  };
};

const WADA = { id: 'wada', combinations: COMBINATIONS, combination, numbersOf: (color) => [...(colorOf(color)?.combinations ?? [])] };
const built = new Map([['wada', WADA]]);

// A family by id, built once; an unknown id is wada (FAM-2).
export const familyOf = (id) => {
  if (!FAMILIES.includes(id)) return WADA;
  if (!built.has(id)) built.set(id, build(id, generate(id)));
  return built.get(id);
};

// The families that are off after a switch, in the order of FAMILIES; the last family that is on
// stays on (FAM-5).
export const switchFamily = (off, id, on) => {
  const next = FAMILIES.filter((family) => (family === id ? !on : off.includes(family)));
  return next.length === FAMILIES.length ? off : next;
};

// The family in use: the chosen one while it is on, else the first family that is on (FAM-5).
export const activeFamily = (chosen, off) =>
  FAMILIES.includes(chosen) && !off.includes(chosen) ? chosen : FAMILIES.find((family) => !off.includes(family)) ?? FAMILIES[0];
