import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES, switchModule, visibleSections } from '#modules';

test('MODULES is combinations and fittings (MOD-1)', () => {
  assert.deepEqual(MODULES, ['combinations', 'fittings']);
});

test('visibleSections with no module off is the full navigation', () => {
  assert.deepEqual(visibleSections([]), ['wardrobe', 'combinations', 'fittings', 'settings']);
});

test('visibleSections without a module keeps the other sections', () => {
  assert.deepEqual(visibleSections(['combinations']), ['wardrobe', 'fittings', 'settings']);
  assert.deepEqual(visibleSections(['fittings']), ['wardrobe', 'combinations', 'settings']);
  assert.deepEqual(visibleSections(['fittings', 'combinations']), ['wardrobe', 'settings']);
});

test('visibleSections ignores an unknown id', () => {
  assert.deepEqual(visibleSections(['shops']), ['wardrobe', 'combinations', 'fittings', 'settings']);
});

test('switchModule turns a module off and on', () => {
  assert.deepEqual(switchModule([], 'combinations', false), ['combinations']);
  assert.deepEqual(switchModule(['combinations'], 'combinations', true), []);
  assert.deepEqual(switchModule([], 'combinations', true), []);
  assert.deepEqual(switchModule(['fittings'], 'combinations', false), ['combinations', 'fittings']);
});

test('switchModule ignores an unknown id and does not change its input', () => {
  const off = ['combinations'];
  assert.deepEqual(switchModule(off, 'shops', false), ['combinations']);
  assert.deepEqual(off, ['combinations']);
});
