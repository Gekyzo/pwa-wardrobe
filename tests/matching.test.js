import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCHING,
  CONTRASTS,
  COLOR_TYPES,
  FORMALITIES,
  NEUTRAL_CHROMA,
  CONTRAST_HIGH,
  CONTRAST_SOFT,
  normalizeMatching,
  isNeutral,
  contrastOf,
  inBand,
  formalityFits,
  suits,
  traitsOf,
} from '#matching';
import { COLORS, lchOf, labOf } from '#palette';

const garment = (id, color, formality = '') => ({ id, name: id, slot: 'top', season: 'all', color, formality });
const find = (predicate) => COLORS.findIndex((_, id) => predicate(lchOf(id)));

test('lchOf gives the lightness, the chroma and the hue in degrees of a colour (PAL-6)', () => {
  for (const { id, hex } of COLORS) {
    const [L, a, b] = labOf(hex);
    const [l, c, h] = lchOf(id);
    assert.equal(l, L);
    assert.ok(Math.abs(c - Math.hypot(a, b)) < 1e-9);
    assert.ok(h >= 0 && h < 360, `${id}`);
  }
  assert.equal(lchOf(-1), null);
});

test('the defaults turn every rule off (MAT-1)', () => {
  assert.deepEqual(MATCHING, { neutrals: false, contrast: 'off', colorType: 'off', formality: false });
  assert.deepEqual(CONTRASTS, ['off', 'high', 'soft']);
  assert.deepEqual(COLOR_TYPES, ['off', 'spring', 'summer', 'autumn', 'winter']);
  assert.deepEqual(FORMALITIES, ['', 'sport', 'casual', 'smart', 'formal']);
  assert.ok(Object.isFrozen(MATCHING));
});

test('normalizeMatching keeps the known values and gives the default for the others (MAT-1)', () => {
  assert.deepEqual(normalizeMatching(null), MATCHING);
  assert.deepEqual(normalizeMatching('x'), MATCHING);
  assert.deepEqual(normalizeMatching([]), MATCHING);
  assert.deepEqual(
    normalizeMatching({ neutrals: true, contrast: 'soft', colorType: 'autumn', formality: true, other: 1 }),
    { neutrals: true, contrast: 'soft', colorType: 'autumn', formality: true },
  );
  assert.deepEqual(normalizeMatching({ neutrals: 'yes', contrast: 'max', colorType: 'fall', formality: 1 }), MATCHING);
});

test('a colour of chroma at most NEUTRAL_CHROMA is neutral (MAT-2)', () => {
  assert.equal(NEUTRAL_CHROMA, 28);
  for (const { id } of COLORS) assert.equal(isNeutral(id), lchOf(id)[1] <= NEUTRAL_CHROMA, `${id}`);
  assert.equal(isNeutral(153), true, 'the white of the basics');
  assert.equal(isNeutral(131), true, 'the navy of the basics');
  assert.equal(isNeutral(find(([, c]) => c > 60)), false);
});

test('the contrast of some garments is the range of their lightness (MAT-3)', () => {
  const white = 153;
  const black = 158;
  assert.ok(Math.abs(contrastOf([garment('a', white), garment('b', black)]) - (lchOf(white)[0] - lchOf(black)[0])) < 1e-9);
  assert.equal(contrastOf([garment('a', white)]), 0);
  assert.equal(contrastOf([]), 0);
});

test('the bands of contrast: high from CONTRAST_HIGH, soft up to CONTRAST_SOFT (MAT-3)', () => {
  assert.equal(CONTRAST_HIGH, 40);
  assert.equal(CONTRAST_SOFT, 25);
  assert.equal(inBand(40, 'high'), true);
  assert.equal(inBand(39.9, 'high'), false);
  assert.equal(inBand(25, 'soft'), true);
  assert.equal(inBand(25.1, 'soft'), false);
  assert.equal(inBand(50, 'off'), false);
});

test('an outfit fits the formality when its set levels span one step or less (MAT-4)', () => {
  assert.equal(formalityFits([garment('a', 1, 'sport'), garment('b', 1, 'casual')]), true);
  assert.equal(formalityFits([garment('a', 1, 'sport'), garment('b', 1, 'smart')]), false);
  assert.equal(formalityFits([garment('a', 1, 'smart'), garment('b', 1, 'formal'), garment('c', 1, '')]), true);
  assert.equal(formalityFits([garment('a', 1, 'sport'), garment('b', 1, '')]), true, 'a garment with no level never blocks');
  assert.equal(formalityFits([garment('a', 1), { id: 'b', color: 1 }]), true, 'no field');
  assert.equal(formalityFits([]), true);
});

test('the traits of a colour come from its LCh (MAT-5)', () => {
  for (const { id } of COLORS) {
    const [l, c, h] = lchOf(id);
    assert.deepEqual(traitsOf(id), { warm: h >= 20 && h < 120, light: l >= 60, bright: c >= 40 }, `${id}`);
  }
});

test('a colour suits a colour type by its traits; a neutral suits every type (MAT-5)', () => {
  const rule = {
    spring: ({ warm, light, bright }) => warm && (light || bright),
    summer: ({ warm, light, bright }) => !warm && (light || !bright),
    autumn: ({ warm, light, bright }) => warm && (!light || !bright),
    winter: ({ warm, light, bright }) => !warm && (!light || bright),
  };
  for (const { id } of COLORS) {
    assert.equal(suits(id, 'off'), true);
    for (const type of COLOR_TYPES.slice(1)) {
      assert.equal(suits(id, type), isNeutral(id) || rule[type](traitsOf(id)), `${id} ${type}`);
    }
  }
  const strong = COLORS.filter(({ id }) => !isNeutral(id)).map(({ id }) => id);
  for (const type of COLOR_TYPES.slice(1)) {
    const count = strong.filter((id) => suits(id, type)).length;
    assert.ok(count > 0 && count < strong.length, `${type} keeps some colours and drops some`);
  }
});
