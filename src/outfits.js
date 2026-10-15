import { combination, colorOf, colorsNear, distance } from '#palette';

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

// Every assignment of a different garment to each colour, with distinct slots, a top and a bottom.
const search = (lists, picks = [], found = []) => {
  if (picks.length === lists.length) {
    if (wearable(picks)) found.push(picks);
    return found;
  }
  for (const pick of lists[picks.length]) {
    if (picks.some((other) => other.garment.id === pick.garment.id) || !slotFree(picks, pick.garment)) continue;
    search(lists, [...picks, pick], found);
  }
  return found;
};

const outfitOf = (number, picks) => ({
  combination: number,
  picks,
  score: picks.reduce((sum, pick) => sum + pick.distance, 0),
  exact: picks.every((pick) => pick.distance === 0),
});

const keyOf = (outfit) => `${outfit.combination}:${outfit.picks.map((pick) => pick.garment.id).sort().join(',')}`;

// Exact first, then the lower score, then a stable order; one outfit for one set of garments.
const best = (outfits) => {
  const sorted = [...outfits].sort(
    (a, b) => Number(b.exact) - Number(a.exact) || a.score - b.score || a.combination - b.combination || byId(keyOf(a), keyOf(b)),
  );
  const seen = new Set();
  return sorted.filter((outfit) => !seen.has(keyOf(outfit)) && seen.add(keyOf(outfit))).slice(0, MAX_OUTFITS);
};

export const outfitsFor = (number, garments, { season = 'any' } = {}) => {
  const colors = combination(number);
  if (!colors) return [];
  const fit = garments.filter((garment) => fitsSeason(garment, season));
  return best(search(colors.map((color) => candidates(color, fit))).map((picks) => outfitOf(number, picks)));
};

// The outfits that contain `garment`: for each combination of a colour near it, and each place
// of that combination that it can take, the hero holds that place and the others are searched.
export const outfitsWith = (garment, garments, { season = 'any' } = {}) => {
  if (!fitsSeason(garment, season)) return [];
  const others = garments.filter((other) => other.id !== garment.id && fitsSeason(other, season));
  const numbers = [...new Set(colorsNear(garment.color, MATCH_MAX).flatMap((id) => colorOf(id).combinations))];
  const outfits = numbers.flatMap((number) => {
    const colors = combination(number);
    return colors.flatMap((color, place) => {
      const d = distance(color, garment.color);
      if (d > MATCH_MAX) return [];
      const lists = colors.map((other, i) => (i === place ? [{ color, garment, distance: d }] : candidates(other, others)));
      return search(lists).map((picks) => outfitOf(number, picks));
    });
  });
  return best(outfits);
};

// Why a combination gives no outfit: the first colour with no garment near it, or no set of
// candidates that is wearable.
export const whyNone = (number, garments, { season = 'any' } = {}) => {
  const colors = combination(number) ?? [];
  const fit = garments.filter((garment) => fitsSeason(garment, season));
  const empty = colors.find((color) => candidates(color, fit).length === 0);
  return empty === undefined ? { key: 'outfits.noSet' } : { key: 'outfits.noColor', params: { color: colorOf(empty).name } };
};
