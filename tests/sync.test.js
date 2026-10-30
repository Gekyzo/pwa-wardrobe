import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enqueue, mergePulled, cursorOf, validRecords } from '#sync';
import { toRecords } from '#records';

const up = (key, name = key) => ({ kind: 'garment', key, op: 'upsert', data: { name } });
const rec = (key, name, updated, extra = {}) => ({ kind: 'garment', key, data: { name }, updated, ...extra });

test('the queue keeps one entry for each record, the later one, at the end (SYNC-5)', () => {
  const queue = enqueue([up('a', 'one'), up('b')], [up('a', 'two'), up('c')]);
  assert.deepEqual(queue.map(({ key }) => key), ['b', 'a', 'c']);
  assert.equal(queue[1].data.name, 'two');
});

test('enqueue leaves its inputs alone (SYNC-5)', () => {
  const queue = [up('a')];
  enqueue(queue, [up('b')]);
  assert.equal(queue.length, 1);
});

test('a queued key ignores the pulled record, and the server copy updates (SYNC-5)', () => {
  const local = new Map([['garment:a', { kind: 'garment', key: 'a', data: { name: 'mine' } }]]);
  const pulled = [rec('a', 'theirs', '2026-01-02')];
  const merged = mergePulled({ local, server: new Map(), queue: [up('a', 'mine')], pulled });
  assert.equal(merged.local.get('garment:a').data.name, 'mine');
  assert.equal(merged.server.get('garment:a').data.name, 'theirs');
});

test('a pulled record with no queued change replaces the local one (SYNC-5)', () => {
  const merged = mergePulled({ local: new Map(), server: new Map(), queue: [], pulled: [rec('a', 'theirs', '2026-01-02')] });
  assert.deepEqual(merged.local.get('garment:a'), { kind: 'garment', key: 'a', data: { name: 'theirs' } });
});

test('a pulled deleted record removes the local record (SYNC-6)', () => {
  const local = new Map([['garment:a', { kind: 'garment', key: 'a', data: { name: 'mine' } }]]);
  const merged = mergePulled({ local, server: new Map(), queue: [], pulled: [rec('a', 'x', '2026-01-02', { deleted: true })] });
  assert.equal(merged.local.has('garment:a'), false);
  assert.equal(local.has('garment:a'), true);
});

test('the cursor is the greatest updated, or the previous one (SYNC-1)', () => {
  assert.equal(cursorOf([rec('a', 'a', '2026-01-02'), rec('b', 'b', '2026-01-05'), rec('c', 'c', '2026-01-03')], ''), '2026-01-05');
  assert.equal(cursorOf([], '2026-01-01'), '2026-01-01');
  assert.equal(cursorOf([rec('a', 'a', '2026-01-02')], '2026-02-01'), '2026-02-01');
});

test('a bad record is dropped alone and the rest stay (SYNC-7)', () => {
  const doc = { version: 4, garments: [
    { id: 'a', name: 'Cap', slot: 'accessory', season: 'all', color: 0, creation_date: '' },
    { id: 'b', name: 'Fedora', slot: 'accessory', season: 'all', color: 0, creation_date: '' },
  ] };
  const map = toRecords(doc);
  map.set('garment:b', { ...map.get('garment:b'), data: { ...map.get('garment:b').data, slot: 'hat' } });
  const { local, dropped } = validRecords(map);
  assert.deepEqual(dropped, ['garment:b']);
  assert.deepEqual([...local.keys()], ['garment:a']);
  assert.equal(map.size, 2);
});
