import { test } from 'node:test';
import assert from 'node:assert/strict';

// context.js reads the page at load; a stub of the page lets node load it. The storage is real
// enough to fail on demand.
const stub = () => new Proxy(function () {}, { get: (_, key) => (key === Symbol.toPrimitive ? () => '' : stub()), apply: () => stub(), set: () => true });
const storage = {
  fail: false,
  map: new Map(),
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  },
  setItem(key, value) {
    if (this.fail) throw new Error('quota');
    this.map.set(key, value);
  },
  removeItem(key) {
    this.map.delete(key);
  },
};
Object.assign(globalThis, { document: stub(), window: { localStorage: storage } });
const context = await import('#ui/context');

const withGarments = (...ids) => ({ ...context.state, garments: ids.map((id) => ({ id, name: id })) });

test('commit calls the save hook only when the save succeeded, with explicit', () => {
  const calls = [];
  context.setOnSave((doc, options) => calls.push([doc, options]));
  storage.fail = true;
  assert.equal(context.commit(withGarments()), false);
  assert.deepEqual(calls, []);
  storage.fail = false;
  const next = withGarments();
  assert.equal(context.commit(next, { explicit: true }), true);
  assert.deepEqual(calls, [[next, { explicit: true }]]);
  context.setOnSave(() => {});
});

test('commit renders before the save hook, and its error skips no render (SYNC-2)', (t) => {
  const order = [];
  t.mock.method(console, 'error', () => {});
  context.setRender(() => order.push('render'));
  context.setOnSave(() => {
    order.push('hook');
    throw new Error('sync');
  });
  assert.equal(context.commit(withGarments()), true);
  assert.deepEqual(order, ['render', 'hook']);
  assert.equal(console.error.mock.callCount(), 1);
  context.setOnSave(() => {});
  context.setRender(() => {});
});

test('a doc that the sync puts in place hides an open Undo, saves, and calls no save hook (SYNC-2)', () => {
  const calls = [];
  context.setOnSave(() => calls.push('hook'));
  const before = context.state;
  context.showToast('Deleted', { undo: before });
  assert.equal(context.undoDoc, before);
  assert.notEqual(context.toastAction, null);
  const merged = withGarments();
  context.replaceDoc(merged);
  assert.equal(context.undoDoc, null);
  assert.equal(context.toastAction, null);
  assert.equal(context.state, merged);
  assert.deepEqual(calls, []);
  context.setOnSave(() => {});
});

test('a doc that the sync puts in place keeps a toast with no Undo', () => {
  const action = { label: 'Update', run: () => {} };
  context.showToast('New version', { action });
  context.replaceDoc(context.state);
  assert.equal(context.toastAction, action);
  context.hideToast();
});
