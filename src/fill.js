import { BASICS, covers, missingBasics } from '#basics';
import { SLOTS } from '#garments';
import { COLORS, colorsNear, distance } from '#palette';
import { familyOf } from '#families';
import { MATCH_MAX, fitsSeason, outfitsFor, outfitsWith } from '#outfits';
import { MATCHING, suits } from '#matching';

// The rows of the Fill tab (FIL-1).
export const MAX_FILL = 12;

// Whether two palette colours are within MATCH_MAX, and the palettes of the colours near one
// colour: both are data of the palette, so they are kept once computed.
const nearPairs = new Map();
const near = (a, b) => {
  const key = a < b ? a * COLORS.length + b : b * COLORS.length + a;
  if (!nearPairs.has(key)) nearPairs.set(key, distance(a, b) <= MATCH_MAX);
  return nearPairs.get(key);
};
const palettesNear = new Map();
const palettesNearOf = (fam, color) => {
  const key = `${fam.id}:${color}`;
  if (!palettesNear.has(key)) palettesNear.set(key, [...new Set(colorsNear(color, MATCH_MAX).flatMap((id) => fam.numbersOf(id)))]);
  return palettesNear.get(key);
};

// The higher gain first, then basics before set colours, then the order of BASICS, then the
// colour id (FIL-6).
const rank = (s) => [-s.gain, s.kind === 'basic' ? 0 : 1, s.kind === 'basic' ? BASICS.findIndex((b) => b.id === s.basic) : 0, s.color];
const byRank = (a, b) => {
  const [ka, kb] = [rank(a), rank(b)];
  const i = ka.findIndex((v, j) => v !== kb[j]);
  return i === -1 ? 0 : ka[i] - kb[i];
};

// The higher gain first; on a tie the lower colour id, then the slot order of GAR-2.
const byGain = (a, b) => b.gain - a.gain || a.color - b.color || SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot);

// One set candidate: a palette colour in a slot, as a garment of all seasons (FIL-3).
const candidate = (color, slot) => ({ id: `set:${color}:${slot}`, name: '', slot, season: 'all', color });

// The open palettes near `color` that the candidate gives an outfit, sorted (FIL-3).
// A palette with a colour that no garment and not the candidate is near stays open: it is not
// searched.
const completesOf = (cand, open, fit, garments, season, match, fam) => {
  const covered = (color) => near(cand.color, color) || fit.some((garment) => near(garment.color, color));
  return palettesNearOf(fam, cand.color)
    .filter((n) => open.has(n) && fam.combination(n).every(covered) && outfitsFor(n, [...garments, cand], { season, match, family: fam.id }).length > 0)
    .sort((a, b) => a - b);
};

// The missing basics and the colours that complete open sets of the family in use, in one ranked list
// (FIL-2 to FIL-6). `of` reads the outfits of one combination of the wardrobe, so a caller can
// give a cached reader. With a colour type, a row whose colour does not suit it leaves (FIL-8).
export const fillSuggestions = (garments, { season = 'any', max = MAX_FILL, of = outfitsFor, match = MATCHING, family = 'wada' } = {}) => {
  const fam = familyOf(family);
  const basics = missingBasics(garments, { season, max: Infinity, match, family }).map(({ basic, gain }) => ({
    kind: 'basic', basic: basic.id, slot: basic.slot, season: basic.season, color: basic.color, gain, completes: [],
  }));
  const open = new Set(fam.combinations.filter(({ number }) => of(number, garments, { season, match, family }).length === 0).map(({ number }) => number));
  const fit = garments.filter((garment) => fitsSeason(garment, season));
  // Only the one gap of an open palette, or any colour of an open palette with no gap, can
  // complete it: a palette two garments short stays open with one more (FIL-3).
  const colors = [...new Set([...open].flatMap((n) => {
    const gaps = fam.combination(n).filter((color) => !fit.some((garment) => near(garment.color, color)));
    return gaps.length === 0 ? fam.combination(n) : gaps.length === 1 ? gaps : [];
  }))];
  const found = colors.flatMap((color) => SLOTS.flatMap((slot) => {
    const cand = candidate(color, slot);
    if (fit.some((garment) => covers(garment, cand))) return [];
    if (basics.some((basic) => basic.slot === slot && fitsSeason(basic, season) && near(basic.color, color))) return [];
    const completes = completesOf(cand, open, fit, garments, season, match, fam);
    if (completes.length === 0) return [];
    return [{ kind: 'set', basic: null, slot, season: 'all', color, gain: outfitsWith(cand, garments, { season, match, family }).length, completes }];
  }));
  // Of two candidates of one slot within MATCH_MAX, the better one stays (FIL-4).
  const kept = [];
  for (const s of [...found].sort(byGain)) {
    if (!kept.some((other) => other.slot === s.slot && near(other.color, s.color))) kept.push(s);
  }
  // Each colour keeps its best slot (FIL-5).
  const sets = kept.filter((s, _, all) => all.find((other) => other.color === s.color) === s);
  return [...basics, ...sets].filter((s) => suits(s.color, match.colorType)).sort(byRank).slice(0, max);
};
