import { distance } from '#palette';
import { MATCH_MAX, outfitsWith } from '#outfits';

// The basics that a wardrobe is built on (data), the most needed first: the order breaks a tie of
// gain (BAS-4). `color` is the id of a palette colour; the name is the catalog key `basic.<id>`.
export const BASICS = [
  { id: 'whiteTee', slot: 'top', season: 'all', color: 153 },
  { id: 'jeans', slot: 'bottom', season: 'all', color: 129 },
  { id: 'whiteSneakers', slot: 'shoes', season: 'all', color: 153 },
  { id: 'navyCoat', slot: 'outer', season: 'cold', color: 131 },
  { id: 'blackTee', slot: 'top', season: 'all', color: 158 },
  { id: 'blackTrousers', slot: 'bottom', season: 'all', color: 158 },
  { id: 'greySweater', slot: 'top', season: 'cold', color: 154 },
  { id: 'beigeChinos', slot: 'bottom', season: 'warm', color: 53 },
  { id: 'trench', slot: 'outer', season: 'warm', color: 41 },
  { id: 'blackShoes', slot: 'shoes', season: 'all', color: 158 },
  { id: 'brownBoots', slot: 'shoes', season: 'cold', color: 86 },
  { id: 'brownBelt', slot: 'accessory', season: 'all', color: 31 },
];

export const MAX_BASICS = 4;

const overlap = (a, b) => a === 'all' || b === 'all' || a === b;

// True when `garment` stands for `basic`: its slot, a colour within MATCH_MAX, a season in common.
export const covers = (garment, basic) =>
  garment.slot === basic.slot && overlap(garment.season, basic.season) && distance(garment.color, basic.color) <= MATCH_MAX;

// The basic as a garment of the outfit search.
const asGarment = (basic) => ({ id: `basic:${basic.id}`, name: basic.id, slot: basic.slot, season: basic.season, color: basic.color });

// The basics that no garment covers, each with the outfits that it would add under the season
// filter: the higher gain first, then the order of BASICS; at most `max`.
export const missingBasics = (garments, { season = 'any', max = MAX_BASICS } = {}) =>
  BASICS.filter((basic) => !garments.some((garment) => covers(garment, basic)))
    .map((basic, order) => ({ basic, order, gain: outfitsWith(asGarment(basic), garments, { season }).length }))
    .sort((a, b) => b.gain - a.gain || a.order - b.order)
    .slice(0, max)
    .map(({ basic, gain }) => ({ basic, gain }));
