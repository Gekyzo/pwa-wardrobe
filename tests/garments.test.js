import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_SLUG } from '#config';
import {
  GARMENTS_KEY,
  MAX_NAME,
  MAX_BRAND,
  MAX_LINK,
  MAX_IMAGES,
  SLOTS,
  SEASONS,
  emptyGarments,
  findGarment,
  addGarment,
  editGarment,
  deleteGarment,
  sortGarments,
  normalizeGarments,
  brandsOf,
  mainImage,
  toggleImage,
  makeMain,
} from '#garments';

const shirt = { name: 'Shirt', slot: 'top', season: 'all', color: 3 };
const extra = { brand: '', link: '', images: [], size: '', fit: '', measures: [] };
const build = (...list) => ({ version: 3, garments: list.map((fields, i) => ({ id: `g${i}`, ...fields })) });

test('the key of the garments has the slug (GAR-1)', () => {
  assert.equal(GARMENTS_KEY, `${APP_SLUG}.garments`);
});

test('the slots and the seasons (GAR-2)', () => {
  assert.deepEqual(SLOTS, ['top', 'bottom', 'outer', 'shoes', 'accessory']);
  assert.deepEqual(SEASONS, ['all', 'warm', 'cold']);
});

test('a garment is added first with a trimmed name, and the input state is unchanged', () => {
  const state = build(shirt);
  const before = structuredClone(state);
  const { state: next, error } = addGarment(state, { ...shirt, name: '  Coat  ', slot: 'outer' }, 'x');
  assert.equal(error, undefined);
  assert.deepEqual(next.garments[0], { id: 'x', name: 'Coat', slot: 'outer', season: 'all', color: 3, ...extra });
  assert.equal(next.garments.length, 2);
  assert.deepEqual(state, before);
});

test('a garment without an id gets a fresh one', () => {
  const { state } = addGarment(emptyGarments(), shirt);
  assert.equal(typeof state.garments[0].id, 'string');
  assert.ok(state.garments[0].id.length > 0);
});

test('each field is checked, and an error keeps the same state (GAR-3)', () => {
  const state = emptyGarments();
  const cases = [
    [{ ...shirt, name: '  ' }, { key: 'error.nameRequired' }],
    [{ ...shirt, name: undefined }, { key: 'error.nameRequired' }],
    [{ ...shirt, name: 'a'.repeat(MAX_NAME + 1) }, { key: 'error.nameTooLong', params: { max: MAX_NAME } }],
    [{ ...shirt, slot: 'hat' }, { key: 'error.slotInvalid' }],
    [{ ...shirt, season: 'spring' }, { key: 'error.seasonInvalid' }],
    [{ ...shirt, color: null }, { key: 'error.colorInvalid' }],
    [{ ...shirt, color: 159 }, { key: 'error.colorInvalid' }],
    [{ ...shirt, color: -1 }, { key: 'error.colorInvalid' }],
    [{ ...shirt, color: 1.5 }, { key: 'error.colorInvalid' }],
    [{ ...shirt, color: '3' }, { key: 'error.colorInvalid' }],
  ];
  for (const [fields, error] of cases) {
    const result = addGarment(state, fields, 'x');
    assert.equal(result.state, state);
    assert.deepEqual(result.error, error, JSON.stringify(fields));
  }
  assert.equal(addGarment(state, { ...shirt, name: 'a'.repeat(MAX_NAME) }, 'x').error, undefined);
});

test('an edit changes the fields of one garment', () => {
  const { state } = editGarment(build(shirt, { ...shirt, name: 'Jeans', slot: 'bottom' }), 'g1', { ...shirt, name: ' Chinos ', slot: 'bottom', color: 9 });
  assert.deepEqual(state.garments[1], { id: 'g1', name: 'Chinos', slot: 'bottom', season: 'all', color: 9, ...extra });
  assert.equal(state.garments[0].name, 'Shirt');
});

test('an edit with a bad field is an error', () => {
  const state = build(shirt);
  assert.deepEqual(editGarment(state, 'g0', { ...shirt, slot: '' }), { state, error: { key: 'error.slotInvalid' } });
});

test('a delete removes one garment', () => {
  const { state } = deleteGarment(build(shirt, shirt), 'g0');
  assert.deepEqual(state.garments.map((g) => g.id), ['g1']);
});

test('an id that is not in the doc is an error (GAR-4)', () => {
  const state = build(shirt);
  const missing = { state, error: { key: 'error.garmentMissing' } };
  assert.deepEqual(editGarment(state, 'zz', shirt), missing);
  assert.deepEqual(deleteGarment(state, 'zz'), missing);
});

test('findGarment returns the garment or null', () => {
  assert.equal(findGarment(build(shirt), 'g0').name, 'Shirt');
  assert.equal(findGarment(build(shirt), 'zz'), null);
});

test('sortGarments orders by slot, then by name, without changing its input (WAR-1)', () => {
  const list = build(
    { ...shirt, name: 'Scarf', slot: 'accessory' },
    { ...shirt, name: 'Tee', slot: 'top' },
    { ...shirt, name: 'Jeans', slot: 'bottom' },
    { ...shirt, name: 'Blouse', slot: 'top' },
  ).garments;
  const before = [...list];
  assert.deepEqual(sortGarments(list).map((g) => g.name), ['Blouse', 'Tee', 'Jeans', 'Scarf']);
  assert.deepEqual(list, before);
});

test('normalizeGarments keeps a valid doc, trims names and drops unknown fields (GAR-5)', () => {
  const garment = { id: 'a', ...shirt, name: ' x ', brand: ' Uniqlo ', link: 'https://shop.example/a', images: ['https://cdn.example/1.jpg'], more: 1 };
  assert.deepEqual(normalizeGarments({ version: 3, garments: [{ ...garment, size: ' 32 ', fit: 'small', measures: [{ name: 'Waist', value: 84, unit: 'cm', x: 1 }] }] }), {
    version: 3,
    garments: [
      {
        id: 'a',
        name: 'x',
        slot: 'top',
        season: 'all',
        color: 3,
        brand: 'Uniqlo',
        link: 'https://shop.example/a',
        images: ['https://cdn.example/1.jpg'],
        size: '32',
        fit: 'small',
        measures: [{ name: 'Waist', value: 84, unit: 'cm' }],
      },
    ],
  });
  assert.deepEqual(normalizeGarments(emptyGarments()), emptyGarments());
});

test('normalizeGarments migrates a version 1 doc (GAR-5)', () => {
  assert.deepEqual(normalizeGarments({ version: 1, garments: [{ id: 'a', ...shirt }] }), {
    version: 3,
    garments: [{ id: 'a', ...shirt, ...extra }],
  });
});

test('normalizeGarments migrates a version 2 doc: no size, fit or measures (GAR-5)', () => {
  const garment = { id: 'a', ...shirt, brand: 'Zara', link: '', images: [] };
  assert.deepEqual(normalizeGarments({ version: 2, garments: [garment] }), { version: 3, garments: [{ ...garment, size: '', fit: '', measures: [] }] });
});

test('emptyGarments is a version 3 doc with no garment (GAR-1)', () => {
  assert.deepEqual(emptyGarments(), { version: 3, garments: [] });
});

test('a garment keeps its size, fit and measures, and an error of them is the error of the garment (GAR-3)', () => {
  const sizing = { size: 'M', fit: 'good', measures: [{ name: 'Chest', value: '96', unit: 'cm' }, { name: '', value: '' }] };
  const { state } = addGarment(emptyGarments(), { ...shirt, ...sizing }, 'x');
  assert.deepEqual(state.garments[0], { id: 'x', ...shirt, ...extra, size: 'M', fit: 'good', measures: [{ name: 'Chest', value: 96, unit: 'cm' }] });
  const bad = emptyGarments();
  assert.deepEqual(addGarment(bad, { ...shirt, fit: 'tight' }), { state: bad, error: { key: 'error.fitInvalid' } });
  const { state: edited } = editGarment(state, 'x', { ...shirt, size: 'L' });
  assert.deepEqual(edited.garments[0], { id: 'x', ...shirt, ...extra, size: 'L' });
});

test('normalizeGarments refuses a doc that is not a garments doc', () => {
  const bad = [
    null,
    'x',
    [],
    { version: 4, garments: [] },
    { version: 3, garments: [{ id: 'a', ...shirt, measures: [{ name: '', value: 3 }] }] },
    { version: 3, garments: [{ id: 'a', ...shirt, fit: 'tight' }] },
    { version: 2, garments: [{ id: 'a', ...shirt, link: 'ftp://x' }] },
    { version: 2, garments: [{ id: 'a', ...shirt, images: 'x' }] },
    { version: 1 },
    { version: 1, notes: [] },
    { version: 1, garments: [null] },
    { version: 1, garments: [{ ...shirt }] },
    { version: 1, garments: [{ id: '', ...shirt }] },
    { version: 1, garments: [{ id: 'a', ...shirt, name: ' ' }] },
    { version: 1, garments: [{ id: 'a', ...shirt, slot: 'hat' }] },
    { version: 1, garments: [{ id: 'a', ...shirt, season: 'spring' }] },
    { version: 1, garments: [{ id: 'a', ...shirt, color: 159 }] },
    { version: 1, garments: [{ id: 'a', ...shirt, color: -1 }] },
    { version: 1, garments: [{ id: 'a', ...shirt, color: 1.5 }] },
    { version: 1, garments: [{ id: 'a', ...shirt, color: '3' }] },
    { version: 1, garments: [{ id: 'a', ...shirt }, { id: 'a', ...shirt }] },
  ];
  for (const data of bad) assert.equal(normalizeGarments(data), null, JSON.stringify(data));
});

test('brand, link and images are optional, and each is checked (GAR-3)', () => {
  const state = emptyGarments();
  const ok = addGarment(state, { ...shirt, brand: '  Zara ', link: ' https://zara.com/p/1 ', images: ['https://a.example/1.jpg', 'http://a.example/2.png'] }, 'x');
  assert.equal(ok.error, undefined);
  assert.deepEqual(ok.state.garments[0], { id: 'x', ...shirt, brand: 'Zara', link: 'https://zara.com/p/1', images: ['https://a.example/1.jpg', 'http://a.example/2.png'], size: '', fit: '', measures: [] });
  const url = (n) => `https://a.example/${n}.jpg`;
  const cases = [
    [{ ...shirt, brand: 'b'.repeat(MAX_BRAND + 1) }, { key: 'error.brandTooLong', params: { max: MAX_BRAND } }],
    [{ ...shirt, brand: 7 }, { key: 'error.brandTooLong', params: { max: MAX_BRAND } }],
    [{ ...shirt, link: 'zara.com' }, { key: 'error.linkInvalid' }],
    [{ ...shirt, link: 'javascript:alert(1)' }, { key: 'error.linkInvalid' }],
    [{ ...shirt, link: `https://a.example/${'x'.repeat(MAX_LINK)}` }, { key: 'error.linkInvalid' }],
    [{ ...shirt, images: 'x' }, { key: 'error.imagesInvalid' }],
    [{ ...shirt, images: ['data:image/png;base64,AA'] }, { key: 'error.imagesInvalid' }],
    [{ ...shirt, images: [url(1), url(1)] }, { key: 'error.imagesInvalid' }],
    [{ ...shirt, images: Array.from({ length: MAX_IMAGES + 1 }, (_, i) => url(i)) }, { key: 'error.imagesInvalid' }],
  ];
  for (const [fields, error] of cases) {
    const result = addGarment(state, fields, 'x');
    assert.equal(result.state, state);
    assert.deepEqual(result.error, error, JSON.stringify(fields).slice(0, 80));
  }
});

test('brandsOf lists each brand once, first spelling, sorted (GAR-6)', () => {
  const garments = build({ ...shirt, brand: 'zara' }, { ...shirt, brand: 'Mango' }, { ...shirt, brand: 'ZARA' }, { ...shirt, brand: '' }, shirt).garments;
  assert.deepEqual(brandsOf(garments), ['Mango', 'zara']);
});

test('the main image is the first image, or null (GAR-7)', () => {
  assert.equal(mainImage({ images: ['https://a/1.jpg', 'https://a/2.jpg'] }), 'https://a/1.jpg');
  assert.equal(mainImage({ images: [] }), null);
  assert.equal(mainImage({}), null);
});

test('toggleImage adds an image at the end or removes it, up to MAX_IMAGES (WAR-6)', () => {
  const a = 'https://a/1.jpg';
  const b = 'https://a/2.jpg';
  const images = [a];
  assert.deepEqual(toggleImage(images, b), { images: [a, b] });
  assert.deepEqual(toggleImage([a, b], a), { images: [b] });
  assert.deepEqual(images, [a]);
  const full = Array.from({ length: MAX_IMAGES }, (_, i) => `https://a/${i}.png`);
  assert.deepEqual(toggleImage(full, b), { images: full, error: { key: 'error.imagesFull', params: { max: MAX_IMAGES } } });
});

test('makeMain moves a chosen image first, and ignores another one (GAR-7)', () => {
  const [a, b, c] = ['https://a/1.jpg', 'https://a/2.jpg', 'https://a/3.jpg'];
  assert.deepEqual(makeMain([a, b, c], c), [c, a, b]);
  assert.deepEqual(makeMain([a, b], 'https://x/y.jpg'), [a, b]);
});
