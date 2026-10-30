import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordKey, toRecords, fromRecords, diffRecords } from '#records';

const garment = (id, creation_date, extra = {}) => ({
  id, name: `Garment ${id}`, slot: 'top', season: 'all', color: 0, brand: '', link: '', images: [],
  size: '', fit: '', measures: {}, buy_date: '', price: null, creation_date, ...extra,
});

test('a record id joins the kind and the key (SYNC-1)', () => {
  assert.equal(recordKey('garment', 'a1'), 'garment:a1');
});

test('a garment is a record whose data has no id (SYNC-1)', () => {
  const records = toRecords({ version: 4, garments: [garment('a', '2026-01-01T00:00:00.000Z')] });
  const { id, ...data } = garment('a', '2026-01-01T00:00:00.000Z');
  assert.deepEqual([...records.keys()], ['garment:a']);
  assert.deepEqual(records.get('garment:a'), { kind: 'garment', key: 'a', data });
});

test('the records give the doc back, newest first, empty dates last, then by key (SYNC-1)', () => {
  const garments = [
    garment('c', '2026-03-01T00:00:00.000Z'),
    garment('b', '2026-02-01T00:00:00.000Z'),
    garment('a', '2026-02-01T00:00:00.000Z'),
    garment('z', ''),
    garment('y', ''),
  ];
  const doc = fromRecords(toRecords({ version: 4, garments: [...garments].reverse() }));
  assert.equal(doc.version, 4);
  assert.deepEqual(doc.garments.map(({ id }) => id), ['c', 'a', 'b', 'y', 'z']);
  assert.deepEqual(doc.garments.find(({ id }) => id === 'c'), garments[0]);
});

test('an add gives one upsert (SYNC-1)', () => {
  const prev = toRecords({ version: 4, garments: [] });
  const next = toRecords({ version: 4, garments: [garment('a', '')] });
  assert.deepEqual(diffRecords(prev, next), [{ kind: 'garment', key: 'a', op: 'upsert', data: next.get('garment:a').data }]);
});

test('an edit gives one upsert (SYNC-1)', () => {
  const prev = toRecords({ version: 4, garments: [garment('a', ''), garment('b', '')] });
  const next = toRecords({ version: 4, garments: [garment('a', ''), garment('b', '', { name: 'New' })] });
  const changes = diffRecords(prev, next);
  assert.equal(changes.length, 1);
  assert.deepEqual([changes[0].key, changes[0].op, changes[0].data.name], ['b', 'upsert', 'New']);
});

test('a delete gives one delete, before the upserts (SYNC-1)', () => {
  const prev = toRecords({ version: 4, garments: [garment('a', ''), garment('b', '')] });
  const next = toRecords({ version: 4, garments: [garment('b', '', { name: 'New' }), garment('c', '')] });
  assert.deepEqual(diffRecords(prev, next).map(({ key, op }) => [key, op]), [['a', 'delete'], ['b', 'upsert'], ['c', 'upsert']]);
  assert.deepEqual(diffRecords(prev, toRecords({ version: 4, garments: [garment('b', '')] })), [{ kind: 'garment', key: 'a', op: 'delete' }]);
});

test('equal data in another key order gives no change (SYNC-1)', () => {
  const prev = new Map([['garment:a', { kind: 'garment', key: 'a', data: { name: 'A', measures: { chest: 1, waist: 2 } } }]]);
  const next = new Map([['garment:a', { kind: 'garment', key: 'a', data: { measures: { waist: 2, chest: 1 }, name: 'A' } }]]);
  assert.deepEqual(diffRecords(prev, next), []);
});
