import { colorOf, colorsNear, distance } from '#palette';
import { familyOf } from '#families';
import { MATCHING, contrastOf, formalityFits, inBand, isNeutral } from '#matching';

// The largest colour distance of a match, the outfits of one search, and the garments that one
// colour keeps: the cap bounds the search to MAX_CANDIDATES ** 4 for a combination of 4 colours.
export const MATCH_MAX = 10;
export const MAX_OUTFITS = 20;
export const MAX_CANDIDATES = 8;
export const SEASON_FILTERS = ['any', 'warm', 'cold'];

export const fitsSeason = (garment, season = 'any') => season === 'any' || garment.season === 'all' || garment.season === season;

const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const nearest = (a, b) => a.distance - b.distance || byId(a.garment.id, b.garment.id);

// The picks of one colour: the garments near it, nearest first, at most MAX_CANDIDATES. The
// nearest garment of each slot is kept first, so that many garments of one slot hide no other.
const candidates = (color, garments) => {
  const near = garments
    .map((garment) => ({ color, garment, distance: distance(color, garment.color) }))
    .filter((pick) => pick.distance <= MATCH_MAX)
    .sort(nearest);
  const firsts = near.filter((pick, i) => near.findIndex((other) => other.garment.slot === pick.garment.slot) === i);
  const rest = near.filter((pick) => !firsts.includes(pick));
  return [...firsts, ...rest.slice(0, MAX_CANDIDATES - firsts.length)].sort(nearest);
};

const slotFree = (picks, garment) => garment.slot === 'accessory' || !picks.some((pick) => pick.garment.slot === garment.slot);

const wearable = (picks) => ['top', 'bottom'].every((slot) => picks.some((pick) => pick.garment.slot === slot));

const garmentsOf = (picks) => picks.map((pick) => pick.garment);

// Every assignment of a different garment to each colour, with distinct slots, a top and a bottom;
// with the formality rule, levels that span one step or less (OUT-12).
const search = (lists, match = MATCHING, picks = [], found = []) => {
  if (picks.length === lists.length) {
    if (wearable(picks) && (!match.formality || formalityFits(garmentsOf(picks)))) found.push(picks);
    return found;
  }
  for (const pick of lists[picks.length]) {
    if (picks.some((other) => other.garment.id === pick.garment.id) || !slotFree(picks, pick.garment)) continue;
    search(lists, match, [...picks, pick], found);
  }
  return found;
};

const outfitOf = (number, picks) => ({
  combination: number,
  picks,
  score: picks.reduce((sum, pick) => sum + pick.distance, 0),
  exact: picks.every((pick) => pick.distance === 0),
  contrast: contrastOf(garmentsOf(picks)),
});

export const outfitKey = (outfit) => `${outfit.combination}:${outfit.picks.map((pick) => pick.garment.id).sort().join(',')}`;

// The slots that neutral completion fills: shoes, and an outer under the season filter `cold`.
const completedSlots = (season) => (season === 'cold' ? ['shoes', 'outer'] : ['shoes']);

// Neutral completion (OUT-14): each empty slot of `completedSlots` gets the neutral garment of
// that slot nearest to a colour of the outfit, out of `pool`. An added pick has no colour and no
// distance, so the score, the exact mark and the contrast stay those of the colours of the set.
const complete = (outfit, pool, season, match) => {
  let picks = outfit.picks;
  for (const slot of completedSlots(season)) {
    if (picks.some((pick) => pick.garment.slot === slot)) continue;
    const near = (garment) => Math.min(...picks.map((pick) => distance(pick.garment.color, garment.color)));
    const [pick] = pool
      .filter((garment) => garment.slot === slot && isNeutral(garment.color) && !picks.some((other) => other.garment.id === garment.id))
      .filter((garment) => !match.formality || formalityFits([...garmentsOf(picks), garment]))
      .map((garment) => ({ garment, d: near(garment) }))
      .sort((a, b) => a.d - b.d || byId(a.garment.id, b.garment.id));
    if (pick) picks = [...picks, { color: null, garment: pick.garment, distance: 0, added: true }];
  }
  return picks === outfit.picks ? outfit : { ...outfit, picks };
};

// Exact first; with a contrast band, the outfits in it next (OUT-13); then the lower score, then a
// stable order; one outfit for one set of garments. Completion comes after the cut, so it adds
// garments, never outfits.
const best = (outfits, { pool = [], season = 'any', match = MATCHING } = {}) => {
  const band = (outfit) => Number(inBand(outfit.contrast, match.contrast));
  const sorted = [...outfits].sort(
    (a, b) => Number(b.exact) - Number(a.exact) || band(b) - band(a) || a.score - b.score || a.combination - b.combination || byId(outfitKey(a), outfitKey(b)),
  );
  const seen = new Set();
  const kept = sorted.filter((outfit) => !seen.has(outfitKey(outfit)) && seen.add(outfitKey(outfit))).slice(0, MAX_OUTFITS);
  return match.neutrals ? kept.map((outfit) => complete(outfit, pool, season, match)) : kept;
};

export const outfitsFor = (number, garments, { season = 'any', match = MATCHING, family = 'wada' } = {}) => {
  const colors = familyOf(family).combination(number);
  if (!colors) return [];
  const fit = garments.filter((garment) => fitsSeason(garment, season));
  return best(search(colors.map((color) => candidates(color, fit)), match).map((picks) => outfitOf(number, picks)), { pool: fit, season, match });
};

// The catalog key of a count of outfits: a full count reads `combinations.countMax` (20+).
export const countKey = (count) => (count >= MAX_OUTFITS ? 'combinations.countMax' : 'combinations.count');

// The number of outfits of every combination under the season filter, each capped at MAX_OUTFITS.
// `of` reads the outfits of one combination, so a caller can give a cached `outfitsFor`.
export const countOutfits = (garments, { season = 'any', match = MATCHING, family = 'wada', of = outfitsFor } = {}) =>
  familyOf(family).combinations.reduce((n, { number }) => n + of(number, garments, { season, match, family }).length, 0);

// The outfits that contain `garment`: for each combination of a colour near it, and each place
// of that combination that it can take, the hero holds that place and the others are searched.
export const outfitsWith = (garment, garments, { season = 'any', match = MATCHING, family = 'wada' } = {}) => {
  const fam = familyOf(family);
  if (!fitsSeason(garment, season)) return [];
  const others = garments.filter((other) => other.id !== garment.id && fitsSeason(other, season));
  const numbers = [...new Set(colorsNear(garment.color, MATCH_MAX).flatMap((id) => fam.numbersOf(id)))];
  const outfits = numbers.flatMap((number) => {
    const colors = fam.combination(number);
    return colors.flatMap((color, place) => {
      const d = distance(color, garment.color);
      if (d > MATCH_MAX) return [];
      const lists = colors.map((other, i) => (i === place ? [{ color, garment, distance: d }] : candidates(other, others)));
      return search(lists, match).map((picks) => outfitOf(number, picks));
    });
  });
  return best(outfits, { pool: [garment, ...others], season, match });
};

// Why a combination gives no outfit: the first colour with no garment near it, or no set of
// candidates that is wearable.
export const whyNone = (number, garments, { season = 'any', family = 'wada' } = {}) => {
  const colors = familyOf(family).combination(number) ?? [];
  const fit = garments.filter((garment) => fitsSeason(garment, season));
  const empty = colors.find((color) => candidates(color, fit).length === 0);
  return empty === undefined ? { key: 'outfits.noSet' } : { key: 'outfits.noColor', params: { color: colorOf(empty).name } };
};

// One outfit at random among those of every combination, or null with none. `except` is the key
// of the outfit in view, so that the next pick is another one while the wardrobe has another.
export const randomOutfit = (garments, { season = 'any', match = MATCHING, family = 'wada', except = null, random = Math.random } = {}) => {
  const all = familyOf(family).combinations.flatMap(({ number }) => outfitsFor(number, garments, { season, match, family }));
  const others = all.filter((outfit) => outfitKey(outfit) !== except);
  const pool = others.length ? others : all;
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
};
