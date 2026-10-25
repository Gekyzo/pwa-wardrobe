import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_FITTINGS_KEY,
  MAX_CATEGORY,
  MAX_MEASURES,
  parseValue,
  addFitting,
  editFitting,
  deleteFitting,
  findFitting,
  sortFittings,
  groupFittings,
  categoriesOf,
  brandsOf,
  measuresOf,
  matches,
  normalizeFittings,
  normalizeFittingList,
  adoptFittings,
} from '#fittings';

// The fittings part of the doc of the app (GAR-1): the operations keep the other fields.
const emptyFittings = () => ({ version: 3, garments: [], fittings: [] });

const fitting = (over = {}) => ({ category: 'Pants', brand: 'Levi', size: '32', fit: 'good', measures: [], note: '', ...over });
const build = (...list) => ({ version: 1, fittings: list.map((over, i) => ({ id: `f${i}`, ...fitting(over) })) });

test('the key of the Fittings app is its own slug, not the slug of this app (FIT-15)', () => {
  assert.equal(LEGACY_FITTINGS_KEY, 'pwa-fittings.fittings');
});

test('the operations keep the garments of the doc', () => {
  const state = { version: 3, garments: [{ id: 'g' }], fittings: [] };
  const { state: next } = addFitting(state, fitting(), 'x');
  assert.equal(next.garments, state.garments);
  assert.equal(next.version, 3);
});

test('parseValue takes a point or a comma as the decimal mark', () => {
  assert.equal(parseValue('84'), 84);
  assert.equal(parseValue(' 84.5 '), 84.5);
  assert.equal(parseValue('84,5'), 84.5);
  assert.equal(parseValue(12.5), 12.5);
});

test('parseValue gives null for a value that is not a positive number', () => {
  for (const value of ['', ' ', 'abc', '0', '-3', '1.2.3', '8a', null, undefined, 0, -1, Infinity, NaN]) {
    assert.equal(parseValue(value), null, String(value));
  }
});

test('a fitting is added first, with clean fields, and the input state is unchanged', () => {
  const state = build({});
  const fields = { category: ' Shirt ', brand: ' Zara ', size: ' M ', fit: 'small', note: ' tight ', measures: [{ name: ' Chest ', value: '96,5', unit: ' cm ' }] };
  const { state: next, error } = addFitting(state, fields, 'x');
  assert.equal(error, undefined);
  assert.deepEqual(next.fittings[0], {
    id: 'x',
    category: 'Shirt',
    brand: 'Zara',
    size: 'M',
    fit: 'small',
    measures: [{ name: 'Chest', value: 96.5, unit: 'cm' }],
    note: 'tight',
  });
  assert.equal(next.fittings[1].id, 'f0');
  assert.deepEqual(state, build({}));
});

test('the optional fields default to empty', () => {
  const { state } = addFitting(emptyFittings(), { category: 'Ring', size: '14' }, 'x');
  assert.deepEqual(state.fittings[0], { id: 'x', category: 'Ring', brand: '', size: '14', fit: '', measures: [], note: '' });
});

test('a fitting without an id gets a fresh one', () => {
  const { state } = addFitting(emptyFittings(), fitting());
  assert.ok(typeof state.fittings[0].id === 'string' && state.fittings[0].id.length > 0);
});

test('a blank or too long category is an error', () => {
  const state = emptyFittings();
  assert.deepEqual(addFitting(state, fitting({ category: '  ' })), { state, error: { key: 'error.categoryRequired' } });
  assert.deepEqual(addFitting(state, fitting({ category: 'a'.repeat(MAX_CATEGORY + 1) })), {
    state,
    error: { key: 'error.categoryTooLong', params: { max: MAX_CATEGORY } },
  });
});

test('a too long brand, size or note is an error', () => {
  const state = emptyFittings();
  assert.equal(addFitting(state, fitting({ brand: 'a'.repeat(41) })).error.key, 'error.brandTooLong');
  assert.equal(addFitting(state, fitting({ size: 'a'.repeat(21) })).error.key, 'error.sizeTooLong');
  assert.equal(addFitting(state, fitting({ note: 'a'.repeat(201) })).error.key, 'error.noteTooLong');
});

test('another fit is an error', () => {
  assert.equal(addFitting(emptyFittings(), fitting({ fit: 'perfect' })).error.key, 'error.fitInvalid');
});

test('a fitting with no size and no measure is an error', () => {
  const state = emptyFittings();
  assert.deepEqual(addFitting(state, fitting({ size: ' ', measures: [] })), { state, error: { key: 'error.sizeOrMeasureRequired' } });
});

test('a fitting with measures and no size is valid', () => {
  const { error } = addFitting(emptyFittings(), fitting({ size: '', measures: [{ name: 'Waist', value: 80, unit: 'cm' }] }));
  assert.equal(error, undefined);
});

test('a measure line with no value is dropped, with or without a name', () => {
  const lines = [{ name: ' ', value: '', unit: 'cm' }, { name: 'Waist', value: ' ', unit: 'cm' }, { name: 'Leg', value: '81' }];
  const { state } = addFitting(emptyFittings(), fitting({ measures: lines }), 'x');
  assert.deepEqual(state.fittings[0].measures, [{ name: 'Leg', value: 81, unit: '' }]);
});

test('a measure with no name, a bad value or a long unit is an error', () => {
  const state = emptyFittings();
  assert.equal(addFitting(state, fitting({ measures: [{ name: '', value: '3' }] })).error.key, 'error.measureNameRequired');
  assert.equal(addFitting(state, fitting({ measures: [{ name: 'a'.repeat(31), value: '3' }] })).error.key, 'error.measureNameTooLong');
  assert.deepEqual(addFitting(state, fitting({ measures: [{ name: 'Leg', value: 'long' }] })).error, {
    key: 'error.measureValueInvalid',
    params: { name: 'Leg' },
  });
  assert.equal(addFitting(state, fitting({ measures: [{ name: 'Leg', value: '3', unit: 'a'.repeat(11) }] })).error.key, 'error.unitTooLong');
});

test('more measures than the maximum is an error', () => {
  const measures = Array.from({ length: MAX_MEASURES + 1 }, (_, i) => ({ name: `m${i}`, value: 1 }));
  assert.deepEqual(addFitting(emptyFittings(), fitting({ measures })).error, { key: 'error.measuresFull', params: { max: MAX_MEASURES } });
});

test('an edit changes the fields of one fitting and keeps its id', () => {
  const { state } = editFitting(build({}, { brand: 'Zara' }), 'f1', fitting({ brand: 'Mango', size: 'L' }));
  assert.deepEqual(state.fittings.map((f) => [f.id, f.brand, f.size]), [['f0', 'Levi', '32'], ['f1', 'Mango', 'L']]);
});

test('an invalid edit is an error and the state is unchanged', () => {
  const state = build({});
  assert.deepEqual(editFitting(state, 'f0', fitting({ category: '' })), { state, error: { key: 'error.categoryRequired' } });
});

test('a delete removes one fitting', () => {
  const { state } = deleteFitting(build({}, { brand: 'Zara' }), 'f0');
  assert.deepEqual(state.fittings.map((f) => f.id), ['f1']);
});

test('an id that does not exist is an error for edit and delete', () => {
  const state = build({});
  const missing = { state, error: { key: 'error.fittingMissing' } };
  assert.deepEqual(editFitting(state, 'zz', fitting()), missing);
  assert.deepEqual(deleteFitting(state, 'zz'), missing);
});

test('findFitting gives the fitting or null', () => {
  assert.equal(findFitting(build({}), 'f0').brand, 'Levi');
  assert.equal(findFitting(build({}), 'zz'), null);
});

test('sortFittings orders by category, then brand, then size, with numbers in order', () => {
  const list = build(
    { category: 'shirt', brand: 'Zara', size: 'M' },
    { category: 'Pants', brand: 'Levi', size: '33' },
    { category: 'Pants', brand: 'Levi', size: '9' },
    { category: 'Pants', brand: 'Acme', size: '40' },
  ).fittings;
  assert.deepEqual(sortFittings(list).map((f) => f.id), ['f3', 'f2', 'f1', 'f0']);
  assert.deepEqual(list.map((f) => f.id), ['f0', 'f1', 'f2', 'f3']);
});

test('groupFittings gives one sorted group for each category, case aside', () => {
  const list = build({ category: 'Shirt' }, { category: 'pants', brand: 'B' }, { category: 'Pants', brand: 'A' }).fittings;
  assert.deepEqual(
    groupFittings(list).map(({ category, fittings }) => [category, fittings.map((f) => f.id)]),
    [['Pants', ['f2', 'f1']], ['Shirt', ['f0']]],
  );
});

test('categoriesOf and brandsOf give each value once, the first spelling, sorted, without blanks', () => {
  const list = build({ category: 'Shirt', brand: 'zara' }, { category: 'pants', brand: 'Zara' }, { category: 'shirt', brand: '' }).fittings;
  assert.deepEqual(categoriesOf(list), ['pants', 'Shirt']);
  assert.deepEqual(brandsOf(list), ['zara']);
});

test('measuresOf gives the measure names and units of a category, newest first, each name once', () => {
  const list = build(
    { category: 'Pants', measures: [{ name: 'Waist', value: 80, unit: 'cm' }, { name: 'Leg', value: 81, unit: 'cm' }] },
    { category: 'pants', measures: [{ name: 'waist', value: 32, unit: 'in' }, { name: 'Hip', value: 99, unit: 'cm' }] },
    { category: 'Shirt', measures: [{ name: 'Chest', value: 96, unit: 'cm' }] },
  ).fittings;
  assert.deepEqual(measuresOf(list, ' PANTS '), [
    { name: 'Waist', unit: 'cm' },
    { name: 'Leg', unit: 'cm' },
    { name: 'Hip', unit: 'cm' },
  ]);
  assert.deepEqual(measuresOf(list, 'Shoes'), []);
});

test('matches finds every word of the query in the fields, case and accents aside', () => {
  const item = fitting({ category: 'Pantalón', brand: "Levi's", size: '32', note: 'slim', measures: [{ name: 'Cintura', value: 80, unit: 'cm' }] });
  assert.equal(matches(item, ''), true);
  assert.equal(matches(item, '  '), true);
  assert.equal(matches(item, 'pantalon'), true);
  assert.equal(matches(item, 'levi 32'), true);
  assert.equal(matches(item, 'CINTURA slim'), true);
  assert.equal(matches(item, 'zara'), false);
  assert.equal(matches(item, 'levi zara'), false);
});

test('normalizeFittings keeps a valid doc, cleans it and drops unknown fields', () => {
  const data = { version: 1, fittings: [{ id: 'a', category: ' Pants ', size: '32', more: 1, measures: [{ name: 'Leg', value: 81, unit: 'cm', x: 1 }] }] };
  assert.deepEqual(normalizeFittings(data), {
    version: 1,
    fittings: [{ id: 'a', category: 'Pants', brand: '', size: '32', fit: '', measures: [{ name: 'Leg', value: 81, unit: 'cm' }], note: '' }],
  });
});

test('normalizeFittings refuses a doc that is not valid', () => {
  for (const data of [
    null,
    'x',
    { version: 2, fittings: [] },
    { version: 1 },
    { version: 1, fittings: [{ category: 'Pants', size: '1' }] },
    { version: 1, fittings: [{ id: 'a', category: '', size: '1' }] },
    { version: 1, fittings: [{ id: 'a', category: 'P', size: '1', measures: 'x' }] },
    { version: 1, fittings: [{ id: 'a', category: 'P', size: '1' }, { id: 'a', category: 'Q', size: '2' }] },
  ]) {
    assert.equal(normalizeFittings(data), null, JSON.stringify(data));
  }
});

test('normalizeFittings keeps an empty doc', () => {
  assert.deepEqual(normalizeFittings({ version: 1, fittings: [] }), { version: 1, fittings: [] });
});

test('normalizeFittingList cleans a list, and refuses one that is not valid (FIT-3)', () => {
  assert.deepEqual(normalizeFittingList([{ id: 'a', category: ' Ring ', size: '14' }]), [
    { id: 'a', category: 'Ring', brand: '', size: '14', fit: '', measures: [], note: '' },
  ]);
  assert.deepEqual(normalizeFittingList([]), []);
  for (const list of [null, {}, [null], [{ id: 'a', category: 'P' }], [{ id: 'a', category: 'P', size: '1' }, { id: 'a', category: 'P', size: '2' }]]) {
    assert.equal(normalizeFittingList(list), null, JSON.stringify(list));
  }
});

const legacy = { version: 1, fittings: [{ id: 'a', category: 'Pants', size: '32' }] };

test('adoptFittings takes the fittings of a valid Fittings doc when the doc has none (FIT-15)', () => {
  const state = { version: 3, garments: [{ id: 'g' }], fittings: [] };
  const { state: next, moved } = adoptFittings(state, legacy);
  assert.equal(moved, 1);
  assert.equal(next.garments, state.garments);
  assert.deepEqual(next.fittings.map((f) => f.id), ['a']);
  assert.deepEqual(state.fittings, []);
});

test('adoptFittings changes nothing when the doc has fittings, or the old doc is not valid or empty (FIT-15)', () => {
  const full = build({});
  assert.deepEqual(adoptFittings(full, legacy), { state: full, moved: 0 });
  const empty = emptyFittings();
  for (const data of [null, 'x', { version: 1, fittings: [] }, { version: 2, fittings: [] }]) {
    assert.deepEqual(adoptFittings(empty, data), { state: empty, moved: 0 }, JSON.stringify(data));
  }
});
