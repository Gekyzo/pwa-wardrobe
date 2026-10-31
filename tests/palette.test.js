import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLORS,
  labOf,
  deltaE,
  distance,
  colorOf,
  nearestColor,
  parseColor,
  colorsNear,
  COMBINATIONS,
  combination,
  combinationsOf,
  combinationsBySize,
} from '#palette';

const close = (actual, expected, within) =>
  expected.forEach((value, i) => assert.ok(Math.abs(actual[i] - value) <= within, `${actual} ≈ ${expected}`));

test('the palette has 159 colours with unique names and hex values (PAL-1)', () => {
  assert.equal(COLORS.length, 159);
  assert.equal(new Set(COLORS.map((color) => color.name)).size, 159);
  assert.equal(new Set(COLORS.map((color) => color.hex)).size, 159);
  COLORS.forEach((color, i) => {
    assert.equal(color.id, i);
    assert.match(color.hex, /^#[0-9a-f]{6}$/);
  });
});

test('labOf gives the CIELAB values of known colours', () => {
  close(labOf('#ffffff'), [100, 0, 0], 0.01);
  close(labOf('#000000'), [0, 0, 0], 0.01);
  close(labOf('#ff0000'), [53.24, 80.09, 67.2], 0.05);
});

test('deltaE is 0 for one colour and symmetric', () => {
  const [a, b] = [labOf('#f9c1ce'), labOf('#ae5224')];
  assert.equal(deltaE(a, a), 0);
  assert.equal(deltaE(a, b), deltaE(b, a));
  assert.ok(deltaE(a, b) > 0);
  assert.equal(distance(3, 3), 0);
  assert.equal(distance(3, 7), distance(7, 3));
});

test('nearestColor of each palette hex is that colour', () => {
  for (const color of COLORS) assert.equal(nearestColor(color.hex), color.id, color.name);
});

test('nearestColor ignores case and refuses a value that is not a hex', () => {
  assert.equal(nearestColor('#F9C1CE'), 0);
  for (const value of ['red', '#fff', '', null, undefined, '#gggggg']) assert.equal(nearestColor(value), null, String(value));
});

test('colorOf returns the colour or null', () => {
  assert.equal(colorOf(0).name, 'Hermosa Pink');
  assert.equal(colorOf(159), null);
  assert.equal(colorOf(-1), null);
});

test('colorsNear includes the colour and only colours within the distance', () => {
  const near = colorsNear(10, 10);
  assert.ok(near.includes(10));
  for (const id of near) assert.ok(distance(10, id) <= 10);
  assert.deepEqual(colorsNear(10, 0), [10]);
});

test('there are 348 combinations of 2, 3 or 4 colours, numbered 1 to 348 (PAL-1)', () => {
  assert.equal(COMBINATIONS.length, 348);
  assert.deepEqual(COMBINATIONS.map((c) => c.number), Array.from({ length: 348 }, (_, i) => i + 1));
  for (const { colors } of COMBINATIONS) assert.ok(colors.length >= 2 && colors.length <= 4);
  assert.equal(combinationsBySize(2).length + combinationsBySize(3).length + combinationsBySize(4).length, 348);
  assert.equal(combinationsBySize(null).length, 348);
});

test('combination and combinationsOf agree with the dataset', () => {
  for (const color of COLORS) {
    assert.deepEqual(combinationsOf(color.id), color.combinations);
    for (const n of color.combinations) assert.ok(combination(n).includes(color.id));
  }
  assert.equal(combination(0), null);
  assert.equal(combination(349), null);
  assert.deepEqual(combinationsOf(999), []);
});

test('combination keeps the order of the dataset', () => {
  for (const { colors } of COMBINATIONS) assert.deepEqual(colors, [...colors].sort((a, b) => a - b));
});

test('parseColor reads a hex, rgb or hsl text as #rrggbb (PAL-4)', () => {
  const cases = [
    ['#A1B2C3', '#a1b2c3'],
    ['#abc', '#aabbcc'],
    [' #ff0000 ', '#ff0000'],
    ['rgb(255, 0, 0)', '#ff0000'],
    ['rgb(0 128 255)', '#0080ff'],
    ['RGBA(0, 128, 255, 0.5)', '#0080ff'],
    ['rgb(0 128 255 / 50%)', '#0080ff'],
    ['rgb(100%, 50%, 0%)', '#ff8000'],
    ['hsl(0, 100%, 50%)', '#ff0000'],
    ['hsl(120deg 100% 25%)', '#008000'],
    ['hsla(240, 100%, 50%, 0.3)', '#0000ff'],
    ['hsl(-120, 100%, 50%)', '#0000ff'],
    ['hsl(210 50% 40%)', '#336699'],
  ];
  for (const [text, hex] of cases) assert.equal(parseColor(text), hex, text);
});

test('parseColor gives null for a text that is not a colour (PAL-4)', () => {
  for (const text of ['', 'red', '#12', '#1234567', 'rgb(256, 0, 0)', 'rgb(1, 2)', 'rgb(-1, 0, 0)', 'hsl(0, 101%, 50%)', 'hsl(0, 50, 50)', 'rgb(1, 2, 3', null, 7]) {
    assert.equal(parseColor(text), null, String(text));
  }
});
