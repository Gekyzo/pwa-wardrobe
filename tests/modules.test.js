import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES, switchModule, visibleSections } from '#modules';

test('MODULES is combinations and fill (MOD-1)', () => {
  assert.deepEqual(MODULES, ['combinations', 'fill']);
});

test('visibleSections with no module off is the full navigation', () => {
  assert.deepEqual(visibleSections([]), ['wardrobe', 'fill', 'combinations', 'settings']);
});

test('visibleSections without combinations keeps the wardrobe and settings', () => {
  assert.deepEqual(visibleSections(['combinations']), ['wardrobe', 'fill', 'settings']);
});

test('visibleSections ignores an unknown id', () => {
  assert.deepEqual(visibleSections(['shops']), ['wardrobe', 'fill', 'combinations', 'settings']);
});

test('switchModule turns a module off and on', () => {
  assert.deepEqual(switchModule([], 'combinations', false), ['combinations']);
  assert.deepEqual(switchModule(['combinations'], 'combinations', true), []);
  assert.deepEqual(switchModule([], 'combinations', true), []);
});

test('switchModule ignores an unknown id and does not change its input', () => {
  const off = ['combinations'];
  assert.deepEqual(switchModule(off, 'shops', false), ['combinations']);
  assert.deepEqual(off, ['combinations']);
});

test('visibleSections without fill keeps the other sections (MOD-1)', () => {
  assert.deepEqual(visibleSections(['fill']), ['wardrobe', 'combinations', 'settings']);
  assert.deepEqual(visibleSections(['combinations', 'fill']), ['wardrobe', 'settings']);
});

test('switchModule keeps the order of MODULES', () => {
  assert.deepEqual(switchModule(['fill'], 'combinations', false), ['combinations', 'fill']);
});
