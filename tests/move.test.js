import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportJson } from '#storage';
import { addGarment, emptyGarments } from '#garments';
import { OLD_HOST, NEW_ORIGIN, MAX_HASH, isOldOrigin, encodeMove, decodeMove, moveUrl, moveMode, takeMove } from '#move';

const sample = [{ name: 'Shirt', slot: 'top', season: 'all', color: 3 }, { name: 'Jeans', slot: 'bottom', season: 'all', color: 5 }]
  .reduce((doc, garment) => addGarment(doc, garment).state, emptyGarments());
const base64url = (text) => Buffer.from(text).toString('base64url');
const deflate = async (text) => {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return Buffer.from(await new Response(stream).arrayBuffer()).toString('base64url');
};
const NOT_BACKUP = { error: { key: 'error.notBackup' } };

test('the old origin is the Pages host only (ADDR-1)', () => {
  assert.equal(OLD_HOST, 'gekyzo.github.io');
  assert.equal(isOldOrigin('gekyzo.github.io'), true);
  for (const host of ['attire.artisandevs.duckdns.org', 'localhost', '']) assert.equal(isOldOrigin(host), false, host);
});

test('a moved backup comes back as the same state (ADDR-3, ADDR-5)', async () => {
  assert.equal(sample.garments.length, 2);
  const hash = await encodeMove(exportJson(sample));
  assert.match(hash, /^#import=[\w-]+$/);
  assert.deepEqual(await decodeMove(hash), { state: sample });
});

test('a hash with no import is not a move (ADDR-5)', async () => {
  assert.equal(await decodeMove(''), null);
  assert.equal(await decodeMove('#x=1'), null);
  assert.equal(await decodeMove('#top'), null);
});

test('a hash that is not base64url or not deflate is not a backup (ADDR-5)', async () => {
  assert.deepEqual(await decodeMove('#import=***'), NOT_BACKUP);
  assert.deepEqual(await decodeMove(`#import=${base64url('not deflate at all')}`), NOT_BACKUP);
  assert.deepEqual(await decodeMove('#import='), NOT_BACKUP);
});

test('a moved text that is not a backup gets the errors of Import (ADDR-5)', async () => {
  assert.deepEqual(await decodeMove(`#import=${await deflate('{"a":1}')}`), NOT_BACKUP);
  assert.deepEqual(await decodeMove(`#import=${await deflate('nope')}`), { error: { key: 'error.invalidJson' } });
});

test('a truncated move is an error, never a state (ADDR-5)', async () => {
  const hash = await encodeMove(exportJson(sample));
  const result = await decodeMove(hash.slice(0, Math.floor(hash.length / 2)));
  assert.ok(result.error, 'expected an error');
  assert.equal(result.state, undefined);
});

test('moveUrl opens the new origin with the query and the hash (ADDR-3)', () => {
  assert.equal(NEW_ORIGIN, 'https://attire.artisandevs.duckdns.org');
  assert.equal(moveUrl('#import=abc', '?arrival'), 'https://attire.artisandevs.duckdns.org/?arrival#import=abc');
  assert.equal(moveUrl('#import=abc', ''), 'https://attire.artisandevs.duckdns.org/#import=abc');
});

test('a hash over the limit gives no URL, so the user exports (ADDR-4)', () => {
  assert.equal(MAX_HASH, 1_000_000);
  assert.equal(moveUrl(`#import=${'a'.repeat(MAX_HASH - '#import='.length)}`, ''), `${NEW_ORIGIN}/#import=${'a'.repeat(MAX_HASH - 8)}`);
  assert.equal(moveUrl(`#import=${'a'.repeat(MAX_HASH)}`, ''), null);
});

test('moveMode: signed out carries the data (ADDR-3)', () => {
  assert.equal(moveMode({ signedIn: false, online: false }), 'carry');
  assert.equal(moveMode({ signedIn: false, online: true }), 'carry');
});

test('moveMode: signed in syncs first, and waits offline (ADDR-2)', () => {
  assert.equal(moveMode({ signedIn: true, online: true }), 'sync');
  assert.equal(moveMode({ signedIn: true, online: false }), 'wait');
});

test('moveMode: after a clean sync of an approved account the move needs no data (ADDR-2)', () => {
  assert.equal(moveMode({ signedIn: true, online: true, sync: { result: 'ok', pending: 0, approved: true } }), 'go');
});

test('moveMode: any other sync end carries the data, so nothing is stranded (ADDR-2)', () => {
  const cases = [
    { result: 'ok', pending: 0, approved: false },
    { result: 'ok', pending: 2, approved: true },
    { result: 'auth', pending: 1, approved: true },
    { result: 'offline', pending: 0, approved: true },
  ];
  for (const sync of cases) assert.equal(moveMode({ signedIn: true, online: true, sync }), 'carry', JSON.stringify(sync));
});

test('takeMove clears the fragment before it decodes, so a reload imports nothing (ADDR-5)', async () => {
  const hash = await encodeMove(exportJson(sample));
  const order = [];
  const result = await takeMove(hash, () => order.push('clear'));
  order.push('decoded');
  assert.deepEqual(order, ['clear', 'decoded']);
  assert.deepEqual(result, { state: sample });
});

test('takeMove leaves a hash with no move alone (ADDR-5)', async () => {
  let cleared = false;
  assert.equal(await takeMove('#top', () => { cleared = true; }), null);
  assert.equal(cleared, false);
});

test('encodeMove is null with no CompressionStream, so the user exports (ADDR-4)', async () => {
  const saved = globalThis.CompressionStream;
  globalThis.CompressionStream = undefined;
  try {
    assert.equal(await encodeMove('{}'), null);
  } finally {
    globalThis.CompressionStream = saved;
  }
});

test('a Bodega backup is not a garments backup (ADDR-5)', async () => {
  assert.deepEqual(await decodeMove(`#import=${await deflate('{"version":10,"items":[],"recipes":[]}')}`), NOT_BACKUP);
});

test('the moved payload holds the garments document only (ADDR-3)', async () => {
  const { state } = await decodeMove(await encodeMove(exportJson(sample)));
  assert.deepEqual(Object.keys(state).sort(), Object.keys(emptyGarments()).sort());
  assert.deepEqual(state, sample);
});
