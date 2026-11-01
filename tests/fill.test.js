import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_FILL, fillSuggestions } from '#fill';
import { BASICS } from '#basics';
import { SLOTS } from '#garments';
import { COMBINATIONS, combination, distance } from '#palette';
import { MATCH_MAX, outfitsFor, outfitsWith } from '#outfits';
import { MATCHING, suits } from '#matching';
import { familyOf } from '#families';

const garment = (id, slot, color, season = 'all') => ({ id, name: id, slot, season, color });
const near = (a, b) => distance(a, b) <= MATCH_MAX;
const asGarment = (s) => ({ id: `wada:${s.color}:${s.slot}`, name: 'wada', slot: s.slot, season: s.season, color: s.color });
const wadaOf = (list) => list.filter((s) => s.kind === 'set');

// A 2-colour combination [x, y], far apart, with x far from every basic top: a bottom in y leaves
// it open, and a top in x completes it.
const { number, colors: [x, y] } = COMBINATIONS.find(({ colors }) =>
  colors.length === 2 && !near(colors[0], colors[1]) && !BASICS.some((basic) => basic.slot === 'top' && near(basic.color, colors[0])));
const bottomY = garment('b', 'bottom', y);

// A wardrobe of some size: the first colours of the first combinations, as tops and bottoms.
const mixed = COMBINATIONS.slice(0, 8).map(({ colors }, i) => garment(`m${i}`, i % 2 ? 'bottom' : 'top', colors[0]));

// The order key of FIL-6.
const order = (s) => [-s.gain, s.kind === 'basic' ? 0 : 1, s.kind === 'basic' ? BASICS.findIndex((b) => b.id === s.basic) : 0, s.color];
const before = (a, b) => {
  const [ka, kb] = [order(a), order(b)];
  const i = ka.findIndex((v, j) => v !== kb[j]);
  return i === -1 || ka[i] < kb[i];
};

test('MAX_FILL is 12 (FIL-1)', () => {
  assert.equal(MAX_FILL, 12);
});

test('an empty wardrobe gives the basics only, with no gain (FIL-2)', () => {
  const list = fillSuggestions([]);
  assert.ok(list.length > 0 && list.length <= MAX_FILL);
  assert.ok(list.every((s) => s.kind === 'basic' && s.gain === 0 && s.completes.length === 0));
  assert.ok(list.every((s) => BASICS.some((b) => b.id === s.basic && b.slot === s.slot && b.color === s.color && b.season === s.season)));
});

test('a Wada suggestion completes an open palette and gains outfits (FIL-3)', () => {
  const list = fillSuggestions([bottomY], { max: 100 });
  const s = wadaOf(list).find((it) => near(it.color, x));
  assert.ok(s, 'a wada row near x');
  assert.equal(s.slot, 'top');
  assert.equal(s.season, 'all');
  assert.equal(s.basic, null);
  assert.ok(s.completes.includes(number));
  assert.ok(s.gain > 0);
});

test('completes is sorted, distinct, and only lists open palettes (FIL-3)', () => {
  for (const wardrobe of [[bottomY], mixed]) {
    for (const s of wadaOf(fillSuggestions(wardrobe, { max: 100 }))) {
      assert.ok(s.completes.length > 0);
      assert.deepEqual(s.completes, [...new Set(s.completes)].sort((a, b) => a - b));
      for (const n of s.completes) {
        assert.equal(outfitsFor(n, wardrobe).length, 0, `palette ${n} is open`);
        assert.ok(outfitsFor(n, [...wardrobe, asGarment(s)]).length > 0, `palette ${n} is completed`);
      }
    }
  }
});

test('a colour that a garment of the filter season covers is not suggested (FIL-4)', () => {
  const list = fillSuggestions([bottomY, garment('t', 'top', x)], { max: 100 });
  assert.ok(!wadaOf(list).some((s) => s.slot === 'top' && near(s.color, x)));
});

test('a covering garment out of the filter season does not hide a suggestion (FIL-4)', () => {
  const list = fillSuggestions([bottomY, garment('t', 'top', x, 'cold')], { season: 'warm', max: 100 });
  const s = wadaOf(list).find((it) => it.slot === 'top' && near(it.color, x));
  assert.ok(s, 'the cold top does not cover under warm');
  assert.ok(s.completes.includes(number));
});

test('a missing basic beats a Wada colour near it in the same slot (FIL-4)', () => {
  for (const wardrobe of [[bottomY], mixed]) {
    const list = fillSuggestions(wardrobe, { max: 100 });
    const basics = list.filter((s) => s.kind === 'basic');
    for (const s of wadaOf(list)) assert.ok(!basics.some((b) => b.slot === s.slot && near(b.color, s.color)), `wada ${s.color}`);
  }
});

test('two Wada rows of one slot are never within MATCH_MAX (FIL-4)', () => {
  for (const wardrobe of [[bottomY], mixed]) {
    const wada = wadaOf(fillSuggestions(wardrobe, { max: 100 }));
    wada.forEach((a, i) => wada.slice(i + 1).forEach((b) => assert.ok(a.slot !== b.slot || !near(a.color, b.color), `${a.color} ${b.color}`)));
  }
});

test('each colour shows in one slot only, after the drops (FIL-5)', () => {
  for (const wardrobe of [[bottomY], mixed]) {
    const colors = wadaOf(fillSuggestions(wardrobe, { max: 100 })).map((s) => s.color);
    assert.equal(new Set(colors).size, colors.length);
    for (const s of wadaOf(fillSuggestions(wardrobe, { max: 100 }))) assert.ok(SLOTS.includes(s.slot));
  }
});

test('the order is gain, then basics before Wada, then BASICS order, then colour id (FIL-6)', () => {
  const list = fillSuggestions(mixed, { max: 100 });
  assert.ok(wadaOf(list).length > 0, 'the fixture has wada rows');
  list.slice(1).forEach((s, i) => assert.ok(before(list[i], s), `row ${i} before row ${i + 1}`));
});

test('the season filter changes the list, and each gain is outfitsWith under it (FIL-2, FIL-3)', () => {
  const warm = mixed.map((g) => ({ ...g, season: 'warm' }));
  const [a, b] = ['warm', 'cold'].map((season) => fillSuggestions(warm, { season, max: 100 }));
  assert.notDeepEqual(a, b);
  for (const s of wadaOf(a)) assert.equal(s.gain, outfitsWith(asGarment(s), warm, { season: 'warm' }).length);
  assert.equal(wadaOf(b).length, 0, 'no warm garment counts under cold');
});

test('max caps the list (FIL-6)', () => {
  assert.equal(fillSuggestions([], { max: 3 }).length, 3);
  assert.ok(fillSuggestions(mixed).length <= MAX_FILL);
});

test('no row when nothing is missing (FIL-2)', () => {
  const all = BASICS.map((b, i) => garment(`g${i}`, b.slot, b.color, b.season));
  assert.deepEqual(fillSuggestions(all, { of: () => [{}] }), []);
});

test('of is used to find the open palettes (FIL-3)', () => {
  assert.equal(wadaOf(fillSuggestions([bottomY], { max: 100, of: () => [{}] })).length, 0);
  assert.ok(wadaOf(fillSuggestions([bottomY], { max: 100, of: outfitsFor })).length > 0);
});

test('a candidate colour fills the one gap of an open palette, or is a colour of a palette with no gap (FIL-3)', () => {
  const gapsOf = (n, wardrobe) => combination(n).filter((c) => !wardrobe.some((g) => near(g.color, c)));
  for (const wardrobe of [[bottomY], mixed]) {
    const open = COMBINATIONS.filter(({ number }) => outfitsFor(number, wardrobe).length === 0).map(({ number }) => number);
    const allowed = new Set(open.flatMap((n) => {
      const gaps = gapsOf(n, wardrobe);
      return gaps.length === 0 ? combination(n) : gaps.length === 1 ? gaps : [];
    }));
    for (const s of wadaOf(fillSuggestions(wardrobe, { max: 100 }))) assert.ok(allowed.has(s.color), `colour ${s.color}`);
  }
});

test('a missing basic out of the filter season does not hide a Wada colour (FIL-4)', () => {
  const navy = BASICS.find((b) => b.id === 'navyCoat');
  assert.equal(navy.season, 'cold');
  const wardrobe = [garment('t', 'top', 113, 'warm'), garment('b', 'bottom', 154, 'warm')];
  const list = fillSuggestions(wardrobe, { season: 'warm', max: 100 });
  assert.ok(wadaOf(list).some((s) => s.slot === 'outer' && near(s.color, navy.color)), 'a Wada outer near the navy coat');
});

test('a colour type keeps only the rows whose colour suits it (FIL-8)', () => {
  const all = fillSuggestions([], { max: Infinity });
  assert.ok(all.some((s) => s.basic === 'brownBelt'), 'the fixture: the brown belt is a missing basic');
  assert.equal(suits(BASICS.find((b) => b.id === 'brownBelt').color, 'spring'), false);
  const spring = fillSuggestions([], { max: Infinity, match: { ...MATCHING, colorType: 'spring' } });
  assert.ok(!spring.some((s) => s.basic === 'brownBelt'));
  assert.deepEqual(spring, all.filter((s) => suits(s.color, 'spring')));
  assert.deepEqual(fillSuggestions([], { max: Infinity, match: MATCHING }), all);
});

test('a colour type filters the Wada rows too, before the cut (FIL-8)', () => {
  const [a] = COMBINATIONS.find(({ colors }) => colors.length === 2).colors;
  const garments = [{ id: 't', name: 't', slot: 'top', season: 'all', color: a }];
  for (const colorType of ['spring', 'summer', 'autumn', 'winter']) {
    const list = fillSuggestions(garments, { match: { ...MATCHING, colorType } });
    assert.ok(list.every((s) => suits(s.color, colorType)), colorType);
    assert.ok(list.length <= MAX_FILL);
  }
});

test('every row is a basic or a set (FIL-1)', () => {
  const [a] = COMBINATIONS.find(({ colors }) => colors.length === 2).colors;
  const list = fillSuggestions([garment('t', 'top', a)], { max: Infinity });
  assert.ok(list.some((s) => s.kind === 'set'));
  assert.ok(list.every((s) => s.kind === 'basic' || s.kind === 'set'));
});

test('Fill searches the family in use (FIL-9)', () => {
  const comp = familyOf('complementary');
  const [base] = comp.combinations[0].colors;
  const garments = [garment('t', 'top', base)];
  const list = fillSuggestions(garments, { max: Infinity, family: 'complementary' });
  const sets = list.filter((s) => s.kind === 'set');
  assert.ok(sets.length > 0);
  for (const s of sets) {
    for (const n of s.completes) {
      assert.ok(comp.combination(n), `complementary ${n} exists`);
      assert.equal(outfitsFor(n, garments, { family: 'complementary' }).length, 0, `${n} was open`);
      assert.ok(outfitsFor(n, [...garments, asGarment(s)], { family: 'complementary' }).length > 0, `${n} closes`);
    }
  }
  assert.deepEqual(fillSuggestions(garments, { max: Infinity, family: 'wada' }), fillSuggestions(garments, { max: Infinity }));
});
