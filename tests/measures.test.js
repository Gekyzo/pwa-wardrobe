import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FITS, MAX_SIZE, MAX_MEASURES, MAX_MEASURE_NAME, MAX_UNIT, parseValue, checkSizing, measuresOf } from '#measures';

test('FITS is not said, fits, too small and too large (GAR-8)', () => {
  assert.deepEqual(FITS, ['', 'good', 'small', 'large']);
});

test('parseValue takes a point or a comma as the decimal mark (GAR-9)', () => {
  assert.equal(parseValue('84'), 84);
  assert.equal(parseValue(' 81,5 '), 81.5);
  assert.equal(parseValue('81.25'), 81.25);
  assert.equal(parseValue(12), 12);
});

test('parseValue gives null for a value that is not a positive number (GAR-9)', () => {
  for (const value of ['', ' ', '0', '-3', 'abc', '1,2,3', '1e3', '.5', null, undefined, 0, -1, Infinity, NaN]) {
    assert.equal(parseValue(value), null, String(value));
  }
});

test('checkSizing gives empty values for a garment with no size, fit or measures (GAR-8)', () => {
  assert.deepEqual(checkSizing({}), { fields: { size: '', fit: '', measures: [] } });
});

test('checkSizing trims the texts and parses the values (GAR-8)', () => {
  const { fields } = checkSizing({ size: ' 32 ', fit: 'good', measures: [{ name: ' Waist ', value: '84,5', unit: ' cm ' }] });
  assert.deepEqual(fields, { size: '32', fit: 'good', measures: [{ name: 'Waist', value: 84.5, unit: 'cm' }] });
});

test('a measure line with no value is dropped, with or without a name (GAR-8)', () => {
  const { fields } = checkSizing({ measures: [{ name: 'Waist', value: '' }, { name: '', value: ' ' }, { name: 'Leg', value: '81' }] });
  assert.deepEqual(fields.measures, [{ name: 'Leg', value: 81, unit: '' }]);
});

test('a size over the maximum and another fit are errors (GAR-8)', () => {
  assert.deepEqual(checkSizing({ size: 'x'.repeat(MAX_SIZE + 1) }).error, { key: 'error.sizeTooLong', params: { max: MAX_SIZE } });
  assert.deepEqual(checkSizing({ size: 3 }).error, { key: 'error.sizeTooLong', params: { max: MAX_SIZE } });
  assert.deepEqual(checkSizing({ fit: 'perfect' }).error, { key: 'error.fitInvalid' });
});

test('measures that are not a list of objects are an error (GAR-8)', () => {
  for (const measures of ['x', null, [null], ['a']]) {
    assert.deepEqual(checkSizing({ measures }).error, { key: 'error.measuresInvalid' }, JSON.stringify(measures));
  }
});

test('a measure with no name, a long name, a bad value or a long unit is an error (GAR-8)', () => {
  assert.deepEqual(checkSizing({ measures: [{ name: ' ', value: '3' }] }).error, { key: 'error.measureNameRequired' });
  assert.deepEqual(checkSizing({ measures: [{ name: 'x'.repeat(MAX_MEASURE_NAME + 1), value: '3' }] }).error, {
    key: 'error.measureNameTooLong',
    params: { max: MAX_MEASURE_NAME },
  });
  assert.deepEqual(checkSizing({ measures: [{ name: 'Waist', value: 'abc' }] }).error, { key: 'error.measureValueInvalid', params: { name: 'Waist' } });
  assert.deepEqual(checkSizing({ measures: [{ name: 'Waist', value: '3', unit: 'x'.repeat(MAX_UNIT + 1) }] }).error, {
    key: 'error.unitTooLong',
    params: { max: MAX_UNIT },
  });
});

test('more measures than the maximum is an error (GAR-8)', () => {
  const measures = Array.from({ length: MAX_MEASURES + 1 }, (_, i) => ({ name: `m${i}`, value: '1' }));
  assert.deepEqual(checkSizing({ measures }).error, { key: 'error.measuresFull', params: { max: MAX_MEASURES } });
});

test('checkSizing does not change its input', () => {
  const input = { size: ' M ', fit: '', measures: [{ name: ' Chest ', value: '96' }] };
  const copy = structuredClone(input);
  checkSizing(input);
  assert.deepEqual(input, copy);
});

test('measuresOf gives the measure names and units of a slot, newest garment first, each name once, case aside (GAR-10)', () => {
  const garments = [
    { slot: 'bottom', measures: [{ name: 'Waist', value: 84, unit: 'cm' }, { name: 'Leg', value: 81, unit: 'cm' }] },
    { slot: 'top', measures: [{ name: 'Chest', value: 96, unit: 'cm' }] },
    { slot: 'bottom', measures: [{ name: 'waist', value: 33, unit: 'in' }, { name: 'Hip', value: 100, unit: '' }] },
  ];
  assert.deepEqual(measuresOf(garments, 'bottom'), [
    { name: 'Waist', unit: 'cm' },
    { name: 'Leg', unit: 'cm' },
    { name: 'Hip', unit: '' },
  ]);
  assert.deepEqual(measuresOf(garments, 'shoes'), []);
});
