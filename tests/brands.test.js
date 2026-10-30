import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRANDS, suggestBrands } from '#brands';
import { MAX_BRAND } from '#garments';

test('an empty text suggests no brand (GAR-11)', () => {
  assert.deepEqual(suggestBrands(['Zara'], ''), []);
  assert.deepEqual(suggestBrands(['Zara'], '   '), []);
});

test('the seed brands that start with the text, case aside (GAR-11)', () => {
  assert.deepEqual(suggestBrands([], 'z'), ['Zadig & Voltaire', 'Zara', 'Zegna']);
  assert.deepEqual(suggestBrands([], 'MAN'), ['Mango']);
});

test('the brands of the wardrobe come first, then the other seed brands (GAR-11)', () => {
  const seed = ['Zadig', 'Zara', 'Zegna'];
  assert.deepEqual(suggestBrands(['zara', 'Zulu', 'Mango'], 'z', seed), ['zara', 'Zulu', 'Zadig', 'Zegna']);
});

test('a seed brand that the wardrobe holds in another case or accent shows one time (GAR-11)', () => {
  assert.deepEqual(suggestBrands(['hermes'], 'her', ['Hermès']), ['hermes']);
});

test('accents of the text and of the brand are aside (GAR-11)', () => {
  assert.deepEqual(suggestBrands([], 'uterq', ['Uterqüe']), ['Uterqüe']);
  assert.deepEqual(suggestBrands([], 'Ü', ['Uterqüe']), ['Uterqüe']);
});

test('the seed list has each brand one time, each one a valid brand (GAR-3, GAR-11)', () => {
  const folded = BRANDS.map((brand) => brand.toLowerCase());
  assert.equal(new Set(folded).size, BRANDS.length);
  assert.ok(BRANDS.every((brand) => brand === brand.trim() && brand.length > 0 && brand.length <= MAX_BRAND));
});
