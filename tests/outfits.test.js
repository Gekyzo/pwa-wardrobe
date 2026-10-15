import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMBINATIONS, combination, colorsNear, distance, colorOf } from '#palette';
import { MATCH_MAX, MAX_OUTFITS, MAX_CANDIDATES, SEASON_FILTERS, fitsSeason, outfitsFor, outfitsWith, whyNone } from '#outfits';

let next = 0;
const g = (color, slot, extra = {}) => ({ id: `g${next++}`, name: `${slot} ${color}`, slot, season: 'all', color, ...extra });
const ids = (outfit) => outfit.picks.map((pick) => pick.garment.id);

// A palette colour at a distance in (lo, hi] of `id`, or null.
const colourAt = (id, lo, hi) => {
  for (let other = 0; other < 159; other += 1) {
    const d = distance(id, other);
    if (d > lo && d <= hi) return other;
  }
  return null;
};

// Combinations whose colours are far apart, so that no garment can match two of them. The first
// colour of `two` has a palette colour inside MATCH_MAX and one just beyond it.
const apart = (colors) => colors.every((a, i) => colors.every((b, j) => i === j || distance(a, b) > 30));
const two = COMBINATIONS.find(({ colors }) =>
  colors.length === 2 && apart(colors) && colourAt(colors[0], 0, MATCH_MAX) !== null && colourAt(colors[0], MATCH_MAX, MATCH_MAX + 15) !== null);
const three = COMBINATIONS.find(({ colors }) => colors.length === 3 && apart(colors));
const four = COMBINATIONS.find(({ colors }) => colors.length === 4 && apart(colors));

test('the fixtures exist in the palette', () => {
  assert.ok(two && three && four);
});

test('the constants (OUT-1)', () => {
  assert.equal(MATCH_MAX, 10);
  assert.equal(MAX_OUTFITS, 20);
  assert.equal(MAX_CANDIDATES, 8);
  assert.deepEqual(SEASON_FILTERS, ['any', 'warm', 'cold']);
});

test('a two-colour outfit is a top and a bottom of the two colours, exact (OUT-3, OUT-5)', () => {
  const [a, b] = two.colors;
  const top = g(a, 'top');
  const bottom = g(b, 'bottom');
  const outfits = outfitsFor(two.number, [top, bottom]);
  assert.equal(outfits.length, 1);
  assert.deepEqual(ids(outfits[0]), [top.id, bottom.id]);
  assert.deepEqual(outfits[0].picks.map((pick) => pick.color), [a, b]);
  assert.equal(outfits[0].combination, two.number);
  assert.equal(outfits[0].score, 0);
  assert.equal(outfits[0].exact, true);
});

test('an outfit needs a top and a bottom (OUT-4)', () => {
  const [a, b] = two.colors;
  assert.deepEqual(outfitsFor(two.number, [g(a, 'top'), g(b, 'shoes')]), []);
  assert.deepEqual(outfitsFor(two.number, [g(a, 'outer'), g(b, 'bottom')]), []);
});

test('no two garments share a slot, except accessories (OUT-4)', () => {
  const [a, b, c] = three.colors;
  assert.deepEqual(outfitsFor(three.number, [g(a, 'top'), g(b, 'bottom'), g(c, 'top')]), []);
  const [p, q, r, s] = four.colors;
  const outfits = outfitsFor(four.number, [g(p, 'top'), g(q, 'bottom'), g(r, 'accessory'), g(s, 'accessory')]);
  assert.equal(outfits.length, 1);
});

test('one garment is used for one colour only (OUT-3)', () => {
  const [a] = two.colors;
  assert.deepEqual(outfitsFor(two.number, [g(a, 'top')]), []);
});

test('a garment matches a colour up to MATCH_MAX, and not beyond (OUT-2)', () => {
  const [a, b] = two.colors;
  const inside = colourAt(a, 0, MATCH_MAX);
  const outside = colourAt(a, MATCH_MAX, MATCH_MAX + 15);
  const near = outfitsFor(two.number, [g(inside, 'top'), g(b, 'bottom')]);
  assert.equal(near.length, 1);
  assert.equal(near[0].exact, false);
  assert.equal(near[0].score, distance(a, inside));
  assert.deepEqual(outfitsFor(two.number, [g(outside, 'top'), g(b, 'bottom')]), []);
});

test('exact outfits come first, then the lower score (OUT-5)', () => {
  const [a, b] = two.colors;
  const inside = colourAt(a, 0, MATCH_MAX);
  const exactTop = g(a, 'top');
  const nearTop = g(inside, 'top');
  const bottom = g(b, 'bottom');
  const outfits = outfitsFor(two.number, [nearTop, bottom, exactTop]);
  assert.deepEqual(outfits.map(ids), [[exactTop.id, bottom.id], [nearTop.id, bottom.id]]);
  assert.deepEqual(outfits.map((o) => o.exact), [true, false]);
});

test('at most MAX_OUTFITS outfits (OUT-5)', () => {
  const [a, b] = two.colors;
  const garments = [...Array.from({ length: 5 }, () => g(a, 'top')), ...Array.from({ length: 5 }, () => g(b, 'bottom'))];
  assert.equal(outfitsFor(two.number, garments).length, MAX_OUTFITS);
});

test('a colour keeps at most MAX_CANDIDATES candidates (OUT-6)', () => {
  const [p, q, r, s] = four.colors;
  const many = (color, slot) => Array.from({ length: 40 }, () => g(color, slot));
  const garments = [...many(p, 'top'), ...many(q, 'bottom'), ...many(r, 'accessory'), ...many(s, 'accessory')];
  const started = Date.now();
  const outfits = outfitsFor(four.number, garments);
  assert.ok(Date.now() - started < 2000);
  assert.equal(outfits.length, MAX_OUTFITS);
});

test('an outfit with the same garments is listed once (OUT-5)', () => {
  // Two colours of one combination near each other (combination 337): their two garments can
  // swap places, which gives two assignments of one set of garments.
  const nearPair = (colors) => colors.some((a, i) => colors.some((b, j) => i < j && distance(a, b) <= MATCH_MAX));
  const pair = COMBINATIONS.find(({ colors }) => nearPair(colors));
  assert.ok(pair);
  const { colors } = pair;
  const i = colors.findIndex((a, k) => colors.some((b, j) => k < j && distance(a, b) <= MATCH_MAX));
  const j = colors.findIndex((b, k) => k > i && distance(colors[i], b) <= MATCH_MAX);
  const rest = ['bottom', 'shoes'];
  const garments = colors.map((color, k) => g(color, k === i ? 'top' : k === j ? 'accessory' : rest.shift()));
  assert.equal(outfitsFor(pair.number, garments).length, 1);
});

test('the season filter keeps garments of all year and of that season (OUT-7)', () => {
  assert.equal(fitsSeason({ season: 'all' }, 'warm'), true);
  assert.equal(fitsSeason({ season: 'warm' }, 'warm'), true);
  assert.equal(fitsSeason({ season: 'cold' }, 'warm'), false);
  assert.equal(fitsSeason({ season: 'cold' }, 'any'), true);
  const [a, b] = two.colors;
  const garments = [g(a, 'top', { season: 'cold' }), g(b, 'bottom')];
  assert.equal(outfitsFor(two.number, garments, { season: 'warm' }).length, 0);
  assert.equal(outfitsFor(two.number, garments, { season: 'cold' }).length, 1);
  assert.equal(outfitsFor(two.number, garments).length, 1);
});

test('an empty wardrobe or an unknown combination gives no outfit', () => {
  assert.deepEqual(outfitsFor(two.number, []), []);
  assert.deepEqual(outfitsFor(0, [g(0, 'top')]), []);
});

test('outfitsWith gives outfits that contain the garment, over its combinations (OUT-8)', () => {
  const [a, b] = two.colors;
  const hero = g(a, 'top');
  const bottom = g(b, 'bottom');
  const other = g(a, 'top');
  const outfits = outfitsWith(hero, [hero, bottom, other]);
  assert.ok(outfits.length >= 1);
  for (const outfit of outfits) assert.ok(ids(outfit).includes(hero.id));
  assert.ok(outfits.some((o) => o.combination === two.number));
});

test('outfitsWith keeps the hero beyond the candidate cap (OUT-8)', () => {
  const [a, b] = two.colors;
  const inside = colourAt(a, 0, MATCH_MAX);
  const hero = g(inside, 'top');
  const exactTops = Array.from({ length: MAX_CANDIDATES + 2 }, () => g(a, 'top'));
  const outfits = outfitsWith(hero, [...exactTops, hero, g(b, 'bottom')]);
  assert.ok(outfits.some((o) => o.combination === two.number && ids(o).includes(hero.id)));
});

test('outfitsWith is empty for a garment out of the season', () => {
  const [a, b] = two.colors;
  const hero = g(a, 'top', { season: 'cold' });
  assert.deepEqual(outfitsWith(hero, [hero, g(b, 'bottom')], { season: 'warm' }), []);
});

test('outfitsWith covers each combination of the colours near the garment', () => {
  const [a] = two.colors;
  const near = new Set(colorsNear(a, MATCH_MAX));
  const hero = g(a, 'top');
  const outfits = outfitsWith(hero, [hero, ...COMBINATIONS.flatMap(({ colors }) => colors.map((color) => g(color, 'bottom')))]);
  assert.ok(outfits.length > 0);
  for (const outfit of outfits) assert.ok(combination(outfit.combination).some((color) => near.has(color)));
});

test('whyNone names the first colour with no garment, else the missing set', () => {
  const [a, b] = two.colors;
  assert.deepEqual(whyNone(two.number, [g(a, 'top')]), { key: 'outfits.noColor', params: { color: colorOf(b).name } });
  assert.deepEqual(whyNone(two.number, [g(a, 'top'), g(b, 'shoes')]), { key: 'outfits.noSet' });
});
