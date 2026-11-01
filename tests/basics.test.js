import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASICS, MAX_BASICS, covers, missingBasics } from '#basics';
import { SLOTS, SEASONS } from '#garments';
import { COLORS, COMBINATIONS, distance } from '#palette';
import { MATCH_MAX } from '#outfits';

const byId = (id) => BASICS.find((basic) => basic.id === id);
const garment = (id, slot, color, season = 'all') => ({ id, name: id, slot, season, color });

test('each basic has a unique id, a slot, a season and a palette colour (BAS-1)', () => {
  assert.ok(BASICS.length > MAX_BASICS);
  assert.equal(new Set(BASICS.map((basic) => basic.id)).size, BASICS.length);
  for (const basic of BASICS) {
    assert.match(basic.id, /^[a-z][a-zA-Z]*$/);
    assert.ok(SLOTS.includes(basic.slot), basic.id);
    assert.ok(SEASONS.includes(basic.season), basic.id);
    assert.ok(Number.isInteger(basic.color) && basic.color >= 0 && basic.color < COLORS.length, basic.id);
  }
  assert.equal(MAX_BASICS, 4);
});

test('a garment of the slot near the colour, in an overlapping season, covers a basic (BAS-2)', () => {
  const tee = byId('whiteTee');
  assert.equal(covers(garment('a', 'top', tee.color), tee), true);
  assert.equal(covers(garment('a', 'bottom', tee.color), tee), false, 'another slot');
  const far = COLORS.findIndex((_, id) => distance(id, tee.color) > MATCH_MAX);
  assert.equal(covers(garment('a', 'top', far), tee), false, 'a far colour');
  const coat = byId('navyCoat');
  assert.equal(coat.season, 'cold');
  assert.equal(covers(garment('a', 'outer', coat.color, 'warm'), coat), false, 'seasons apart');
  assert.equal(covers(garment('a', 'outer', coat.color, 'all'), coat), true);
  assert.equal(covers(garment('a', 'top', tee.color, 'warm'), tee), true, 'a basic of all seasons');
});

test('an empty wardrobe misses the first basics of the list, with no gain (BAS-3)', () => {
  const missing = missingBasics([]);
  assert.deepEqual(missing.map(({ basic }) => basic.id), BASICS.slice(0, MAX_BASICS).map((basic) => basic.id));
  assert.ok(missing.every(({ gain }) => gain === 0));
});

test('a covered basic is not missing (BAS-3)', () => {
  const tee = byId('whiteTee');
  const missing = missingBasics([garment('a', 'top', tee.color)], { max: BASICS.length });
  assert.ok(!missing.some(({ basic }) => basic.id === 'whiteTee'));
  assert.equal(missing.length, BASICS.length - 1);
});

// A top of the other colour of a 2-colour combination of the jeans: the jeans make an outfit with it.
const jeansMate = (season = 'all') => {
  const jeans = byId('jeans');
  const { colors } = COMBINATIONS.find(({ colors: c }) => c.length === 2 && c.includes(jeans.color));
  return garment('mate', 'top', colors.find((color) => color !== jeans.color), season);
};

test('the basics that add more outfits come first, then the order of the list (BAS-4)', () => {
  const missing = missingBasics([jeansMate()], { max: BASICS.length });
  const gains = missing.map(({ gain }) => gain);
  assert.deepEqual(gains, [...gains].sort((a, b) => b - a));
  assert.equal(missing[0].basic.id, 'jeans');
  assert.ok(missing[0].gain > 0);
  const ties = missing.filter(({ gain }) => gain === 0).map(({ basic }) => BASICS.indexOf(basic));
  assert.deepEqual(ties, [...ties].sort((a, b) => a - b));
});

test('the gain follows the season filter (BAS-4)', () => {
  const wardrobe = [jeansMate('warm')];
  const gainOf = (season) => missingBasics(wardrobe, { season, max: BASICS.length }).find(({ basic }) => basic.id === 'jeans').gain;
  assert.ok(gainOf('any') > 0);
  assert.ok(gainOf('warm') > 0);
  assert.equal(gainOf('cold'), 0);
});

test('missingBasics does not change its input', () => {
  const wardrobe = Object.freeze([Object.freeze(garment('a', 'top', 153))]);
  assert.doesNotThrow(() => missingBasics(wardrobe));
});
