import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMBINATIONS, combination, colorsNear, distance, colorOf } from '#palette';
import { MATCH_MAX, MAX_OUTFITS, MAX_CANDIDATES, SEASON_FILTERS, fitsSeason, outfitsFor, outfitsWith, whyNone, outfitKey, randomOutfit, countOutfits, countKey } from '#outfits';
import { MATCHING, isNeutral, contrastOf, inBand } from '#matching';

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

test('the cap keeps the nearest garments of each slot, so many accessories hide no bottom (OUT-6)', () => {
  const [p, q, r] = three.colors;
  // Accessories first in id order: a cap blind to the slot fills with them and drops the bottom.
  const accessories = Array.from({ length: 50 }, (_, i) => ({ ...g(p, 'accessory'), id: `a${String(i).padStart(2, '0')}` }));
  const bottom = { ...g(p, 'bottom'), id: 'z-bottom' };
  const garments = [...accessories, bottom, g(q, 'top'), g(r, 'shoes')];
  const outfits = outfitsFor(three.number, garments);
  assert.ok(outfits.some((o) => ids(o).includes('z-bottom')));
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

// Every outfit of a wardrobe, in the order of the combinations (OUT-9).
const poolOf = (garments, options) => COMBINATIONS.flatMap(({ number }) => outfitsFor(number, garments, options));

test('randomOutfit is null for a wardrobe with no outfit (OUT-9)', () => {
  assert.equal(randomOutfit([]), null);
  assert.equal(randomOutfit([g(two.colors[0], 'top')]), null);
});

test('randomOutfit takes the outfit of the pool that the random number names (OUT-9)', () => {
  const [a, b] = two.colors;
  const garments = [g(a, 'top'), g(a, 'top'), g(b, 'bottom')];
  const pool = poolOf(garments);
  assert.ok(pool.length >= 2);
  assert.deepEqual(randomOutfit(garments, { random: () => 0 }), pool[0]);
  assert.deepEqual(randomOutfit(garments, { random: () => 0.9999 }), pool.at(-1));
});

test('randomOutfit keeps to the season filter (OUT-7, OUT-9)', () => {
  const [a, b] = two.colors;
  const garments = [g(a, 'top', { season: 'cold' }), g(b, 'bottom')];
  assert.equal(randomOutfit(garments, { season: 'warm' }), null);
  assert.ok(randomOutfit(garments, { season: 'cold' }));
});

test('randomOutfit gives another outfit than `except` while the pool has one (OUT-9)', () => {
  const [a, b] = two.colors;
  const garments = [g(a, 'top'), g(a, 'top'), g(b, 'bottom')];
  const pool = poolOf(garments);
  for (const random of [() => 0, () => 0.5, () => 0.9999]) {
    const outfit = randomOutfit(garments, { except: outfitKey(pool[0]), random });
    assert.notEqual(outfitKey(outfit), outfitKey(pool[0]));
  }
  const single = [g(a, 'top'), g(b, 'bottom')];
  const [only, ...rest] = poolOf(single);
  assert.equal(rest.length, 0);
  assert.deepEqual(randomOutfit(single, { except: outfitKey(only) }), only);
});

test('countOutfits reads the outfits of a combination through `of` when given (OUT-10)', () => {
  const [a, b] = two.colors;
  const garments = [g(a, 'top'), g(b, 'bottom')];
  const asked = [];
  const of = (number, list, { season }) => {
    asked.push(season);
    return outfitsFor(number, list, { season });
  };
  assert.equal(countOutfits(garments, { season: 'warm', of }), countOutfits(garments, { season: 'warm' }));
  assert.equal(asked.length, COMBINATIONS.length);
  assert.ok(asked.every((season) => season === 'warm'));
  assert.equal(countOutfits(garments, { of: () => [1, 2] }), 2 * COMBINATIONS.length);
});

test('countOutfits sums the outfits of every combination under the season filter (OUT-10)', () => {
  const [a, b] = two.colors;
  const garments = [g(a, 'top'), g(b, 'bottom'), g(a, 'top', { season: 'cold' })];
  assert.equal(countOutfits(garments), COMBINATIONS.reduce((n, { number }) => n + outfitsFor(number, garments).length, 0));
  assert.ok(countOutfits(garments) >= 2);
  assert.equal(countOutfits([]), 0);
  assert.ok(countOutfits(garments, { season: 'warm' }) < countOutfits(garments));
});

test('countKey reads a full count as 20+ and any other count, 0 too, by its plural (WAR-1)', () => {
  assert.equal(countKey(MAX_OUTFITS), 'combinations.countMax');
  assert.equal(countKey(MAX_OUTFITS + 3), 'combinations.countMax');
  assert.equal(countKey(0), 'combinations.count');
  assert.equal(countKey(MAX_OUTFITS - 1), 'combinations.count');
});

// The matching rules (OUT-11 to OUT-13).
const on = (changes) => ({ ...MATCHING, ...changes });
const neutralOf = () => colorsNearAll().find((id) => isNeutral(id));

test('with every rule off the outfits are those of OUT-5 (OUT-11)', () => {
  const [a, b] = two.colors;
  const garments = [g(a, 'top'), g(b, 'bottom'), g(neutralOf(), 'shoes')];
  assert.deepEqual(outfitsFor(two.number, garments, { match: MATCHING }), outfitsFor(two.number, garments));
});

test('formality removes an outfit whose levels span more than one step (OUT-12)', () => {
  const [a, b] = two.colors;
  const top = g(a, 'top', { formality: 'sport' });
  const far = g(b, 'bottom', { formality: 'formal' });
  const near = g(b, 'bottom', { formality: 'casual' });
  const blank = g(b, 'bottom');
  assert.equal(outfitsFor(two.number, [top, far]).length, 1, 'the rule off keeps it');
  assert.deepEqual(outfitsFor(two.number, [top, far], { match: on({ formality: true }) }), []);
  assert.equal(outfitsFor(two.number, [top, near], { match: on({ formality: true }) }).length, 1);
  assert.equal(outfitsFor(two.number, [top, blank], { match: on({ formality: true }) }).length, 1);
  assert.deepEqual(outfitsWith(top, [top, far], { match: on({ formality: true }) }), []);
});

test('each outfit carries the contrast of its garments (OUT-13)', () => {
  const [a, b] = two.colors;
  const top = g(a, 'top');
  const bottom = g(b, 'bottom');
  const [outfit] = outfitsFor(two.number, [top, bottom]);
  assert.equal(outfit.contrast, contrastOf([top, bottom]));
});

test('a contrast band ranks its outfits first, after the exact ones, and removes none (OUT-13)', () => {
  // Two tops of one colour, near the first colour of `two`: one far in lightness from the bottom.
  const pairs = COMBINATIONS.filter(({ colors }) => colors.length === 2).map(({ number, colors }) => ({ number, colors }));
  const found = pairs.map(({ number, colors: [a, b] }) => {
    const tops = colorsNear(a, MATCH_MAX).filter((id) => id !== a);
    const hi = tops.find((id) => inBand(contrastOf([{ color: id }, { color: b }]), 'high'));
    const lo = tops.find((id) => !inBand(contrastOf([{ color: id }, { color: b }]), 'high'));
    return hi !== undefined && lo !== undefined && distance(a, lo) < distance(a, hi) ? { number, a, b, hi, lo } : null;
  }).find(Boolean);
  assert.ok(found, 'a fixture of two tops');
  const high = g(found.hi, 'top');
  const low = g(found.lo, 'top');
  const bottom = g(found.b, 'bottom');
  const plain = outfitsFor(found.number, [high, low, bottom]);
  assert.equal(plain[0].picks[0].garment.id, low.id, 'the lower score first with the rule off');
  const ranked = outfitsFor(found.number, [high, low, bottom], { match: on({ contrast: 'high' }) });
  assert.equal(ranked.length, plain.length);
  assert.equal(ranked[0].picks[0].garment.id, high.id);
});

test('neutral completion adds the neutral shoes nearest to the colours of an outfit (OUT-14)', () => {
  const [a, b] = two.colors;
  const top = g(a, 'top');
  const bottom = g(b, 'bottom');
  const neutrals = colorsNearAll().filter((id) => isNeutral(id));
  const [n1, n2] = neutrals;
  const near = Math.min(distance(n1, a), distance(n1, b)) <= Math.min(distance(n2, a), distance(n2, b)) ? n1 : n2;
  const far = near === n1 ? n2 : n1;
  const shoesNear = g(near, 'shoes');
  const shoesFar = g(far, 'shoes');
  const bright = g(colorsNearAll().find((id) => !isNeutral(id)), 'shoes');
  const garments = [top, bottom, shoesFar, shoesNear, bright];
  const [outfit] = outfitsFor(two.number, garments, { match: on({ neutrals: true }) }).filter((o) => o.picks.length > 0 && ids(o).includes(top.id) && ids(o).includes(bottom.id));
  const added = outfit.picks.filter((pick) => pick.added);
  assert.equal(added.length, 1);
  assert.equal(added[0].garment.id, shoesNear.id);
  assert.equal(added[0].color, null);
  assert.equal(added[0].distance, 0);
  assert.equal(outfit.score, outfitsFor(two.number, [top, bottom])[0].score, 'the score stays');
  assert.equal(outfit.exact, true, 'exact stays');
});

test('neutral completion adds no shoes to an outfit that has shoes, and no outer out of cold (OUT-14)', () => {
  const [a, b] = two.colors;
  const top = g(a, 'top');
  const bottom = g(b, 'bottom');
  const coat = g(neutralOf(), 'outer');
  const outfits = outfitsFor(two.number, [top, bottom, coat], { match: on({ neutrals: true }) });
  assert.ok(outfits.every((o) => !o.picks.some((pick) => pick.added)), 'no outer under any');
  const cold = outfitsFor(two.number, [top, bottom, coat], { season: 'cold', match: on({ neutrals: true }) });
  assert.deepEqual(cold[0].picks.filter((pick) => pick.added).map((pick) => pick.garment.id), [coat.id]);
  const warmCoat = g(neutralOf(), 'outer', { season: 'warm' });
  const cold2 = outfitsFor(two.number, [top, bottom, warmCoat], { season: 'cold', match: on({ neutrals: true }) });
  assert.ok(cold2.every((o) => !o.picks.some((pick) => pick.added)), 'a garment out of the season filter is not added');
});

test('neutral completion keeps the formality of the outfit, and the count of outfits stays (OUT-14)', () => {
  const [a, b] = two.colors;
  const top = g(a, 'top', { formality: 'smart' });
  const bottom = g(b, 'bottom', { formality: 'smart' });
  const sneakers = g(neutralOf(), 'shoes', { formality: 'sport' });
  const both = on({ neutrals: true, formality: true });
  assert.ok(outfitsFor(two.number, [top, bottom, sneakers], { match: both }).every((o) => !o.picks.some((pick) => pick.added)));
  const garments = [top, bottom, g(neutralOf(), 'shoes')];
  assert.equal(countOutfits(garments, { match: on({ neutrals: true }) }), countOutfits(garments));
  assert.equal(outfitsWith(garments[2], garments, { match: on({ neutrals: true }) }).length, outfitsWith(garments[2], garments).length);
});

test('randomOutfit and outfitsWith take the rules too (OUT-11)', () => {
  const [a, b] = two.colors;
  const top = g(a, 'top');
  const bottom = g(b, 'bottom');
  const shoes = g(neutralOf(), 'shoes');
  const outfit = randomOutfit([top, bottom, shoes], { match: on({ neutrals: true }), random: () => 0 });
  assert.ok(outfit.picks.some((pick) => pick.garment.id === shoes.id));
  const withTop = outfitsWith(top, [top, bottom, shoes], { match: on({ neutrals: true }) });
  assert.ok(withTop.some((o) => o.picks.some((pick) => pick.added && pick.garment.id === shoes.id)));
});

function colorsNearAll() {
  return Array.from({ length: 159 }, (_, id) => id).filter((id) => !two.colors.some((c) => distance(c, id) <= MATCH_MAX));
}
