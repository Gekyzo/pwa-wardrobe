import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAMILIES, FAMILY_MAX, DISTINCT_MIN, MONO_STEP_MIN, familyOf, switchFamily, activeFamily } from '#families';
import { MATCH_MAX } from '#outfits';
import { COLORS, COMBINATIONS, deltaE, labOf, lchOf } from '#palette';
import { isNeutral } from '#matching';

const LABS = COLORS.map(({ hex }) => labOf(hex));
const ideal = (l, c, h) => [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
const GENERATED = FAMILIES.slice(1);
const key = (colors) => [...colors].sort((a, b) => a - b).join(',');

test('the families and the limit (FAM-1)', () => {
  assert.deepEqual(FAMILIES, ['wada', 'complementary', 'analogous', 'triadic', 'split', 'accent', 'mono']);
  assert.equal(FAMILY_MAX, 25);
});

test('wada is the combinations of the book; an unknown id is wada (FAM-2)', () => {
  const wada = familyOf('wada');
  assert.equal(wada.id, 'wada');
  assert.deepEqual(wada.combinations, COMBINATIONS);
  assert.equal(familyOf('nope'), wada);
  for (const { id, combinations } of COLORS) assert.deepEqual(wada.numbersOf(id), combinations);
  assert.deepEqual(wada.combination(1), COMBINATIONS[0].colors);
  assert.equal(wada.combination(9999), null);
});

test('each generated family numbers its sets 1..n by base, with distinct colours and no duplicate (FAM-3)', () => {
  for (const id of GENERATED) {
    const { combinations } = familyOf(id);
    assert.ok(combinations.length > 0, id);
    combinations.forEach(({ number, colors }, i) => {
      assert.equal(number, i + 1, id);
      assert.equal(new Set(colors).size, colors.length, `${id} ${number}`);
      assert.ok(colors.length === 2 || colors.length === 3, `${id} ${number}`);
      assert.equal(isNeutral(colors[0]), false, `${id} ${number}: the base is not neutral`);
      if (i > 0) assert.ok(colors[0] > combinations[i - 1].colors[0], `${id} ${number}: bases increase`);
    });
    assert.equal(new Set(combinations.map(({ colors }) => key(colors))).size, combinations.length, `${id}: no duplicate`);
  }
});

test('the hue families take targets at their offsets within FAMILY_MAX (FAM-4)', () => {
  const offsets = { complementary: [180], analogous: [-30, 30], triadic: [120, 240], split: [150, 210] };
  for (const [id, list] of Object.entries(offsets)) {
    for (const { number, colors } of familyOf(id).combinations) {
      const [l, c, h] = lchOf(colors[0]);
      assert.equal(colors.length, list.length + 1, `${id} ${number}`);
      list.forEach((offset, i) => {
        assert.ok(deltaE(ideal(l, c, (h + offset + 360) % 360), LABS[colors[i + 1]]) <= FAMILY_MAX, `${id} ${number}`);
      });
    }
  }
});

test('mono takes the same hue and chroma at L* - 25 and L* + 25, clamped (FAM-4)', () => {
  for (const { number, colors } of familyOf('mono').combinations) {
    const [l, c, h] = lchOf(colors[0]);
    [-25, 25].forEach((dl, i) => {
      const target = ideal(Math.min(98, Math.max(5, l + dl)), c, h);
      assert.ok(deltaE(target, LABS[colors[i + 1]]) <= FAMILY_MAX, `mono ${number}`);
    });
  }
});

test('accent is the base, the nearest light neutral and the nearest dark neutral, each distinct (FAM-4)', () => {
  const neutrals = COLORS.map(({ id }) => id).filter(isNeutral);
  const distinct = (set) => (id) => set.every((other) => deltaE(LABS[id], LABS[other]) > DISTINCT_MIN);
  const nearestOf = (base, list) => list.reduce((a, b) => (deltaE(LABS[b], LABS[base]) < deltaE(LABS[a], LABS[base]) ? b : a));
  for (const { number, colors } of familyOf('accent').combinations) {
    const [base, light, dark] = colors;
    assert.equal(colors.length, 3, `accent ${number}`);
    assert.equal(light, nearestOf(base, neutrals.filter((id) => lchOf(id)[0] >= 60).filter(distinct([base]))));
    assert.equal(dark, nearestOf(base, neutrals.filter((id) => lchOf(id)[0] < 40).filter(distinct([base, light]))));
  }
});

test('the counts at FAMILY_MAX, as measured for the design (FAM-3)', () => {
  assert.equal(familyOf('complementary').combinations.length, 54);
  assert.equal(familyOf('analogous').combinations.length, 100);
  assert.equal(familyOf('triadic').combinations.length, 60);
  assert.equal(familyOf('split').combinations.length, 60);
  assert.equal(familyOf('mono').combinations.length, 57);
  assert.equal(familyOf('accent').combinations.length, 103);
});

test('combination and numbersOf agree with the list of each family (FAM-2)', () => {
  for (const id of FAMILIES) {
    const family = familyOf(id);
    assert.equal(familyOf(id), family, 'built once');
    for (const { number, colors } of family.combinations) {
      assert.deepEqual(family.combination(number), colors);
      for (const color of colors) assert.ok(family.numbersOf(color).includes(number), `${id} ${number}`);
    }
    for (const { id: color } of COLORS) {
      const expected = family.combinations.filter(({ colors }) => colors.includes(color)).map(({ number }) => number);
      assert.deepEqual(family.numbersOf(color), expected, `${id} colour ${color}`);
    }
  }
});

test('switchFamily keeps the order and never turns off the last family (FAM-5)', () => {
  assert.deepEqual(switchFamily([], 'mono', false), ['mono']);
  assert.deepEqual(switchFamily(['mono', 'wada'], 'wada', true), ['mono']);
  assert.deepEqual(switchFamily(['mono'], 'wada', false), ['wada', 'mono']);
  const allButOne = FAMILIES.slice(1);
  assert.deepEqual(switchFamily(allButOne, 'wada', false), allButOne);
});

test('activeFamily falls back to the first family that is on (FAM-5)', () => {
  assert.equal(activeFamily('triadic', []), 'triadic');
  assert.equal(activeFamily('triadic', ['triadic']), 'wada');
  assert.equal(activeFamily('wada', ['wada']), 'complementary');
  assert.equal(activeFamily('nope', []), 'wada');
});

test('no two colours of a generated set are within DISTINCT_MIN, the MATCH_MAX of the outfits (FAM-4)', () => {
  assert.equal(DISTINCT_MIN, MATCH_MAX);
  for (const id of FAMILIES.slice(1)) {
    for (const { number, colors } of familyOf(id).combinations) {
      colors.forEach((a, i) => colors.slice(i + 1).forEach((b) => {
        assert.ok(deltaE(LABS[a], LABS[b]) > DISTINCT_MIN, `${id} ${number}: ${a} and ${b}`);
      }));
    }
  }
});

test('mono takes a darker and a lighter colour, each at least MONO_STEP_MIN from the base (FAM-4)', () => {
  assert.equal(MONO_STEP_MIN, 12);
  for (const { number, colors: [base, dark, light] } of familyOf('mono').combinations) {
    const l = lchOf(base)[0];
    assert.ok(lchOf(dark)[0] <= l - MONO_STEP_MIN, `mono ${number}: darker`);
    assert.ok(lchOf(light)[0] >= l + MONO_STEP_MIN, `mono ${number}: lighter`);
  }
});
