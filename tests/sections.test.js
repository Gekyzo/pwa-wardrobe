import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS, direction, slideDirection, slideTo, slideBack, historyStep } from '#sections';

// A longer list than the template's, so that a slide has a middle section to pass.
const FIVE = ['a', 'b', 'c', 'd', 'settings'];

test('SECTIONS has the order of the navigation', () => {
  assert.deepEqual(SECTIONS, ['wardrobe', 'combinations', 'settings']);
});

test('slideDirection is 1 for a slide to the left and -1 for a slide to the right', () => {
  assert.equal(slideDirection(-80, 0), 1);
  assert.equal(slideDirection(80, 0), -1);
});

test('slideDirection is 0 for a short slide', () => {
  assert.equal(slideDirection(-59, 0), 0);
  assert.equal(slideDirection(59, 0), 0);
  assert.equal(slideDirection(0, 0), 0);
  assert.equal(slideDirection(-60, 0), 1);
});

test('slideDirection is 0 for a slide that is not horizontal', () => {
  assert.equal(slideDirection(-80, 41), 0);
  assert.equal(slideDirection(80, -120), 0);
  assert.equal(slideDirection(-80, 40), 1);
  assert.equal(slideDirection(80, -40), -1);
});

test('slideTo goes between the sections of the app, through the combinations', () => {
  assert.equal(slideTo('wardrobe', -80, 0), 'combinations');
  assert.equal(slideTo('combinations', -80, 0), 'settings');
  assert.equal(slideTo('settings', 80, 0), 'combinations');
  assert.equal(slideTo('combinations', 80, 0), 'wardrobe');
  assert.equal(direction('wardrobe', 'combinations'), 1);
});

test('slideTo goes to the next section on a slide to the left', () => {
  assert.equal(slideTo('a', -80, 0, FIVE), 'b');
  assert.equal(slideTo('d', -80, 0, FIVE), 'settings');
});

test('slideTo goes to the previous section on a slide to the right', () => {
  assert.equal(slideTo('settings', 80, 0, FIVE), 'd');
  assert.equal(slideTo('b', 80, 0, FIVE), 'a');
});

test('slideTo stops at the first and at the last section', () => {
  assert.equal(slideTo('wardrobe', 200, 0), null);
  assert.equal(slideTo('settings', -200, 0), null);
});

test('slideTo ignores a short slide and a slide that is not horizontal', () => {
  assert.equal(slideTo('b', -59, 0, FIVE), null);
  assert.equal(slideTo('b', -80, 41, FIVE), null);
  assert.equal(slideTo('b', -80, -40, FIVE), 'c');
});

test('slideTo ignores a view that is not a section', () => {
  assert.equal(slideTo('other', -80, 0), null);
  assert.equal(slideTo('other', 80, 0), null);
});

test('direction is 1 towards a later section and -1 towards an earlier one', () => {
  assert.equal(direction('wardrobe', 'settings'), 1);
  assert.equal(direction('settings', 'wardrobe'), -1);
  assert.equal(direction('a', 'd', FIVE), 1);
});

test('direction is 0 for the same section and for a view that is not a section', () => {
  assert.equal(direction('wardrobe', 'wardrobe'), 0);
  assert.equal(direction('other', 'wardrobe'), 0);
  assert.equal(direction('wardrobe', 'other'), 0);
});

test('slideTo skips the sections that are not in the given list', () => {
  assert.equal(slideTo('a', -80, 0, ['a', 'c', 'settings']), 'c');
  assert.equal(slideTo('c', 80, 0, ['a', 'c', 'settings']), 'a');
});

test('slideBack is true for a slide to the right while a detail shows alone (NAV-3)', () => {
  assert.equal(slideBack(80, 0, true), true);
  assert.equal(slideBack(80, 10, true), true);
});

test('slideBack is false for a slide to the left, a short or vertical slide, or a detail beside its list (NAV-3)', () => {
  assert.equal(slideBack(-80, 0, true), false);
  assert.equal(slideBack(30, 0, true), false);
  assert.equal(slideBack(80, 60, true), false);
  assert.equal(slideBack(80, 0, false), false);
});

test('historyStep adds an entry when a detail opens with no entry of its own (NAV-7)', () => {
  assert.equal(historyStep(true, false), 'push');
});

test('historyStep goes back over the entry when a detail closes in the app (NAV-7)', () => {
  assert.equal(historyStep(false, true), 'back');
});

test('historyStep does nothing when the history already matches the detail (NAV-7)', () => {
  assert.equal(historyStep(true, true), null);
  assert.equal(historyStep(false, false), null);
});
