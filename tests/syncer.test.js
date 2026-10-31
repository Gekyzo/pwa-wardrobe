import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSyncer, SYNC_KEY, QUEUE_KEY } from '#syncer';
import { PocketBaseError } from '#pocketbase';
import { saveSession, loadSession, SESSION_KEY, OFFLINE_KEY } from '#session';
import { LANGUAGE_KEY } from '#storage';
import { normalizeGarments, emptyGarments } from '#garments';
import { toRecords } from '#records';

const garment = (id, name = id, creation_date = '') => ({ id, name, slot: 'top', season: 'all', color: 0, creation_date });
const docOf = (...garments) => normalizeGarments({ version: 4, garments });

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const tokenOf = (id, n = 0) => `${base64url({ alg: 'none' })}.${base64url({ id, exp: 4_000_000_000, n })}.sig`;
const sessionOf = (id, approved = true) => ({ token: tokenOf(id), user: { id, email: `${id}@example.test`, name: id, approved } });

const fakeStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
};

const storedSync = (storage) => JSON.parse(storage.getItem(SYNC_KEY));
const storedQueue = (storage) => JSON.parse(storage.getItem(QUEUE_KEY) ?? '[]');

// An in-memory server of one owner's records, with increasing `updated` strings.
const fakeServer = () => {
  let clock = 0;
  const rows = [];
  const stamp = () => {
    clock += 1;
    return `2026-10-31 07:00:00.${String(clock).padStart(3, '0')}Z`;
  };
  return {
    rows,
    add: (owner, { id: key, ...data }) => rows.push({ id: `pb${rows.length + 1}`, owner, kind: 'garment', key, data, deleted: false, updated: stamp() }),
    stamp,
  };
};

const ownerOf = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).id;
const recOf = ({ owner: _, ...row }) => ({ ...row });

const fakeClient = (server) => {
  const calls = [];
  const client = {
    calls,
    pushed: [],
    pushes: 0,
    failPush: null,
    failPull: null,
    failRefresh: null,
    hold: null,
    streams: [],
    refresh: async (token) => {
      calls.push('refresh');
      if (client.failRefresh) throw client.failRefresh;
      const id = ownerOf(token);
      return { token: tokenOf(id, calls.length), user: { id, email: `${id}@example.test`, name: id, approved: true } };
    },
    pull: async (token, since, owner) => {
      calls.push('pull');
      if (client.hold) await client.hold('pull');
      if (client.failPull) throw client.failPull;
      return server.rows
        .filter((row) => row.owner === owner && (!since || row.updated >= since))
        .sort((a, b) => (a.updated < b.updated ? -1 : 1))
        .map(recOf);
    },
    push: async (token, change, owner) => {
      calls.push('push');
      client.pushes += 1;
      const failure = client.failPush?.(client.pushes, change);
      if (failure) throw failure;
      client.pushed.push(change);
      let row = server.rows.find((r) => r.owner === owner && r.kind === change.kind && r.key === change.key);
      if (!row && change.op === 'delete') return null;
      if (!row) {
        row = { id: `pb${server.rows.length + 1}`, owner, kind: change.kind, key: change.key };
        server.rows.push(row);
      }
      Object.assign(row, change.op === 'delete' ? { deleted: true } : { deleted: false, data: change.data }, { updated: server.stamp() });
      return recOf(row);
    },
    subscribe: (tokenFn, onChange, { onReconnect }) => {
      const stream = { tokenFn, onChange, onReconnect, closed: false };
      client.streams.push(stream);
      return () => {
        stream.closed = true;
      };
    },
  };
  return client;
};

const START = Date.parse('2026-10-31T08:00:00Z');

// A device: its storage, its doc, a clock and timers that run only when the test says so.
const device = ({ server = fakeServer(), user = 'u1', doc = emptyGarments(), synced = true, storage: given, lost, local } = {}) => {
  const storage = given ?? fakeStorage();
  if (!given) {
    saveSession(storage, sessionOf(user));
    if (synced) storage.setItem(SYNC_KEY, JSON.stringify({ owner: user, cursor: '', server: [], local: local ?? [...toRecords(doc)], lastSync: null }));
  }
  const client = fakeClient(server);
  const box = { doc, statuses: [], timers: [], sets: 0, clock: START };
  const syncer = createSyncer({
    client,
    storage,
    getDoc: () => box.doc,
    // As the app: a doc that cannot be saved stays out, and setDoc gives false.
    setDoc: (next) => {
      box.sets += 1;
      if (box.failSet) return false;
      box.doc = next;
      return true;
    },
    now: () => box.clock,
    onStatus: (status) => box.statuses.push(status),
    setTimer: (fn, ms) => {
      const timer = { fn, ms, cleared: false };
      box.timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => {
      if (timer) timer.cleared = true;
    },
    lost,
  });
  // Saves a doc as the app does: it puts it in place, then tells the syncer.
  const save = (next, options) => {
    box.doc = next;
    syncer.notify(next, options);
  };
  const live = () => box.timers.filter((timer) => !timer.cleared);
  return { storage, client, server, box, syncer, save, live };
};

// A gate that holds a call of the client until the test opens it.
const gate = () => {
  let open;
  const opened = new Promise((resolve) => {
    open = resolve;
  });
  return { opened, open };
};

test('a save queues its diff and a run 1500 ms later sends it, empties the queue and stores lastSync (SYNC-2, SYNC-3, SYNC-4)', async () => {
  const d = device();
  d.save(docOf(garment('a', 'Shirt')));
  assert.deepEqual(storedQueue(d.storage).map(({ key, op }) => [key, op]), [['a', 'upsert']]);
  assert.equal(d.client.calls.length, 0);
  const [timer] = d.live();
  assert.equal(timer.ms, 1500);
  assert.equal(await timer.fn(), 'ok');
  assert.deepEqual(d.client.pushed.map(({ key }) => key), ['a']);
  assert.deepEqual(storedQueue(d.storage), []);
  assert.equal(storedSync(d.storage).lastSync, new Date(START).toISOString());
  assert.equal(d.syncer.status().pending, 0);
  assert.equal(d.syncer.status().lastSync, new Date(START).toISOString());
});

test('a new save within 1500 ms starts the delay again (SYNC-3)', () => {
  const d = device();
  d.save(docOf(garment('a')));
  d.save(docOf(garment('a'), garment('b')));
  assert.equal(d.live().length, 1);
  assert.equal(d.box.timers.length, 2);
  assert.equal(d.syncer.status().pending, 2);
});

test('a save of a device with no account queues nothing (SYNC-2)', () => {
  const d = device();
  d.storage.removeItem(SESSION_KEY);
  d.save(docOf(garment('a')));
  assert.equal(d.syncer.status().pending, 0);
  assert.equal(d.live().length, 0);
});

test('a network error keeps the queue and reports online false (SYNC-4, SYNC-11)', async () => {
  const d = device();
  d.save(docOf(garment('a')));
  d.client.failPush = () => new PocketBaseError('network');
  assert.equal(await d.syncer.run(), 'offline');
  assert.equal(storedQueue(d.storage).length, 1);
  assert.equal(d.syncer.status().online, false);
  assert.equal(d.box.statuses.at(-1).online, false);
});

test('a 429 keeps the queue and schedules a retry at 5000, then at 15000 (SYNC-3)', async () => {
  const d = device();
  d.save(docOf(garment('a')));
  d.client.failPush = () => new PocketBaseError('rate', 429);
  assert.equal(await d.syncer.run(), 'rate');
  assert.equal(d.syncer.status().online, true);
  const first = d.live().at(-1);
  assert.equal(first.ms, 5000);
  assert.equal(await first.fn(), 'rate');
  assert.equal(d.live().at(-1).ms, 15000);
  assert.equal(storedQueue(d.storage).length, 1);
});

test('a 5xx retries too, as offline; a run that reaches the server ends the series (SYNC-3, SYNC-11)', async () => {
  const d = device();
  d.save(docOf(garment('a')));
  d.client.failPush = () => new PocketBaseError('server', 503);
  assert.equal(await d.syncer.run(), 'offline');
  assert.equal(d.live().at(-1).ms, 5000);
  d.client.failPush = null;
  assert.equal(await d.live().at(-1).fn(), 'ok');
  d.client.failPush = () => new PocketBaseError('server', 503);
  d.save(docOf(garment('a', 'Other')));
  await d.syncer.run();
  assert.equal(d.live().at(-1).ms, 5000);
});

test('a 400 with field errors drops that change and goes on (SYNC-4)', async () => {
  const d = device();
  d.save(docOf(garment('a'), garment('b')));
  d.client.failPush = (n) => (n === 1 ? new PocketBaseError('invalid', 400, { data: { code: 'validation_invalid' } }) : null);
  assert.equal(await d.syncer.run(), 'ok');
  assert.deepEqual(d.client.pushed.map(({ key }) => key), ['b']);
  assert.deepEqual(storedQueue(d.storage), []);
});

test('an auth error stops the sync, keeps the queue and sets auth; the next run makes no request (SYNC-4)', async () => {
  const d = device();
  d.save(docOf(garment('a')));
  d.client.failPush = () => new PocketBaseError('auth', 401);
  assert.equal(await d.syncer.run(), 'auth');
  assert.equal(storedQueue(d.storage).length, 1);
  assert.equal(d.syncer.status().auth, true);
  const before = d.client.calls.length;
  assert.equal(await d.syncer.run(), 'auth');
  assert.equal(d.client.calls.length, before);
  const timers = d.box.timers.length;
  d.save(docOf(garment('a'), garment('b')));
  assert.equal(d.syncer.status().pending, 2);
  assert.equal(d.box.timers.length, timers);
});

test('a 400 with no field error is a refused rule: an auth stop (SYNC-4)', async () => {
  const d = device();
  d.save(docOf(garment('a')));
  d.client.failPush = () => new PocketBaseError('invalid', 400, {});
  assert.equal(await d.syncer.run(), 'auth');
});

test('the token is refreshed when the last refresh is older than 600000 ms (SYNC-4)', async () => {
  const d = device();
  await d.syncer.run();
  assert.equal(d.client.calls.filter((call) => call === 'refresh').length, 1);
  d.box.clock = START + 600_000;
  await d.syncer.run();
  assert.equal(d.client.calls.filter((call) => call === 'refresh').length, 1);
  d.box.clock = START + 600_001;
  await d.syncer.run();
  assert.equal(d.client.calls.filter((call) => call === 'refresh').length, 2);
  assert.equal(loadSession(d.storage).token, tokenOf('u1', 4));
});

test('an expired token is refreshed at once (SYNC-4)', async () => {
  const d = device();
  await d.syncer.run();
  const expired = { ...sessionOf('u1'), token: `${base64url({ alg: 'none' })}.${base64url({ id: 'u1', exp: START / 1000 + 30 })}.sig` };
  saveSession(d.storage, expired);
  await d.syncer.run();
  assert.equal(d.client.calls.filter((call) => call === 'refresh').length, 2);
});

test('a run pulls the account, merges it into the doc and moves the cursor (SYNC-4)', async () => {
  const server = fakeServer();
  server.add('u1', docOf(garment('a', 'Coat')).garments[0]);
  const d = device({ server });
  assert.equal(await d.syncer.run(), 'ok');
  assert.deepEqual(d.box.doc.garments.map(({ name }) => name), ['Coat']);
  assert.equal(storedSync(d.storage).cursor, server.rows[0].updated);
  assert.equal(d.syncer.status().pending, 0);
});

test('a pulled record that the check refuses is dropped alone (SYNC-7)', async () => {
  const server = fakeServer();
  server.add('u1', docOf(garment('a', 'Coat')).garments[0]);
  server.add('u1', { ...docOf(garment('b', 'Hat')).garments[0], slot: 'hat' });
  const d = device({ server });
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args);
  try {
    assert.equal(await d.syncer.run(), 'ok');
  } finally {
    console.error = original;
  }
  assert.deepEqual(d.box.doc.garments.map(({ id }) => id), ['a']);
  assert.equal(errors.length, 1);
  assert.equal(d.syncer.status().pending, 0);
});

test('lost with an empty doc pulls the account and queues no delete (SYNC-2)', async () => {
  const server = fakeServer();
  const coat = docOf(garment('a', 'Coat'));
  server.add('u1', coat.garments[0]);
  const d = device({ server, lost: true, local: [...toRecords(coat)] });
  assert.equal(await d.syncer.run(), 'ok');
  assert.deepEqual(d.client.pushed, []);
  assert.deepEqual(d.box.doc.garments.map(({ name }) => name), ['Coat']);
});

// The console.error of the SYNC-2 guard is expected in these tests.
const quiet = async (fn) => {
  const original = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = original;
  }
};

test('a save with none of the garments of the account sends no delete of them, unless explicit (SYNC-2)', async () => {
  const server = fakeServer();
  const coat = docOf(garment('a', 'Coat'));
  server.add('u1', coat.garments[0]);
  const d = device({ server, local: [...toRecords(coat)] });
  await quiet(() => {
    d.save(docOf(garment('b', 'Hat')));
    assert.deepEqual(storedQueue(d.storage).map(({ key, op }) => [key, op]), [['b', 'upsert']]);
    d.save(docOf(garment('b', 'Hat')), { explicit: true });
  });
  assert.deepEqual(storedQueue(d.storage).map(({ key, op }) => [key, op]), [['b', 'upsert'], ['a', 'delete']]);
});

test('a garment added to a doc that fell back to empty reaches the server and stays in the doc (SYNC-2)', async () => {
  const server = fakeServer();
  const coat = docOf(garment('a', 'Coat'));
  server.add('u1', coat.garments[0]);
  const d = device({ server, local: [...toRecords(coat)] });
  await quiet(async () => {
    d.save(docOf(garment('b', 'Hat')));
    d.save(docOf(garment('b', 'Hat'), garment('c', 'Scarf')));
    d.save(docOf(garment('b', 'Hat')));
    assert.equal(await d.syncer.run(), 'ok');
  });
  // The garment that the user added and deleted again goes as a delete; the coat gets none.
  assert.deepEqual(d.client.pushed.map(({ key, op }) => [key, op]), [['b', 'upsert'], ['c', 'delete']]);
  assert.deepEqual(d.box.doc.garments.map(({ id }) => id).sort(), ['a', 'b']);
  assert.deepEqual(server.rows.filter((row) => !row.deleted).map(({ key }) => key).sort(), ['a', 'b']);
  assert.equal(d.syncer.status().pending, 0);
});

test('a refused save keeps its garment across a restart before the merge (SYNC-2)', async () => {
  const server = fakeServer();
  const coat = docOf(garment('a', 'Coat'));
  server.add('u1', coat.garments[0]);
  const d = device({ server, local: [...toRecords(coat)] });
  await quiet(() => d.save(docOf(garment('b', 'Hat'))));
  const again = device({ server, storage: d.storage, doc: d.box.doc });
  assert.equal(await quiet(() => again.syncer.run()), 'ok');
  assert.ok(again.client.pushed.every(({ op }) => op === 'upsert'));
  assert.deepEqual(again.box.doc.garments.map(({ id }) => id).sort(), ['a', 'b']);
});

test('a user who deletes the garments one by one still sends the deletes (SYNC-2)', () => {
  const both = docOf(garment('a'), garment('b'));
  const d = device({ doc: both });
  d.save(docOf(garment('b')));
  d.save(emptyGarments());
  assert.deepEqual(storedQueue(d.storage).map(({ key, op }) => [key, op]), [['a', 'delete'], ['b', 'delete']]);
});

test('a save during a run survives the merge (SYNC-5)', async () => {
  const server = fakeServer();
  server.add('u1', docOf(garment('a', 'Coat')).garments[0]);
  const d = device({ server });
  const held = gate();
  const arrived = gate();
  d.client.hold = () => {
    arrived.open();
    return held.opened;
  };
  const running = d.syncer.run();
  await arrived.opened;
  d.save(docOf(garment('b', 'Hat')));
  held.open();
  assert.equal(await running, 'ok');
  assert.deepEqual(d.box.doc.garments.map(({ id }) => id).sort(), ['a', 'b']);
  assert.deepEqual(storedQueue(d.storage).map(({ key }) => key), ['b']);
});

test('the merge does not queue what it puts in place (SYNC-2)', async () => {
  const server = fakeServer();
  server.add('u1', docOf(garment('a', 'Coat')).garments[0]);
  const d = device({ server });
  await d.syncer.run();
  await d.syncer.run();
  assert.deepEqual(d.client.pushed, []);
  assert.equal(d.syncer.status().pending, 0);
});

test('a run while one runs gets the promise of that run', async () => {
  const d = device();
  const first = d.syncer.run();
  assert.equal(d.syncer.run(), first);
  await first;
});

test('reset during a run makes the run save nothing', async () => {
  const server = fakeServer();
  server.add('u1', docOf(garment('a', 'Coat')).garments[0]);
  const d = device({ server, doc: docOf(garment('b')) });
  const held = gate();
  const arrived = gate();
  d.client.hold = () => {
    arrived.open();
    return held.opened;
  };
  const running = d.syncer.run();
  await arrived.opened;
  d.syncer.reset();
  const sets = d.box.sets;
  held.open();
  assert.equal(await running, 'ok');
  assert.equal(d.box.sets, sets);
  assert.deepEqual(d.box.doc, emptyGarments());
  assert.equal(d.storage.getItem(SYNC_KEY), null);
  assert.equal(d.storage.getItem(QUEUE_KEY), null);
  assert.equal(d.storage.getItem(SESSION_KEY), null);
  assert.equal(d.syncer.status().lastSync, null);
});

const ids = (doc) => doc.garments.map(({ id }) => id).sort();
const liveKeys = (server, owner) => server.rows.filter((row) => row.owner === owner && !row.deleted).map(({ key }) => key).sort();

test('a first login queues the garments of the device and merges the account; a garment on both sides keeps the copy of the device (SYNC-8)', async () => {
  const server = fakeServer();
  server.add('u1', docOf(garment('b', 'Old hat')).garments[0]);
  server.add('u1', docOf(garment('c', 'Scarf')).garments[0]);
  const storage = fakeStorage();
  const d = device({ server, storage, doc: docOf(garment('a', 'Coat'), garment('b', 'Hat')) });
  assert.equal(await d.syncer.login(sessionOf('u1')), 'synced');
  assert.equal(storedSync(storage).owner, 'u1');
  assert.equal(loadSession(storage).user.id, 'u1');
  assert.deepEqual(d.client.pushed.map(({ key, op }) => [key, op]), [['a', 'upsert'], ['b', 'upsert']]);
  assert.deepEqual(ids(d.box.doc), ['a', 'b', 'c']);
  assert.equal(d.box.doc.garments.find(({ id }) => id === 'b').name, 'Hat');
  assert.deepEqual(liveKeys(server, 'u1'), ['a', 'b', 'c']);
  assert.equal(server.rows.find(({ key }) => key === 'b').data.name, 'Hat');
  assert.equal(d.syncer.status().pending, 0);
});

test('a first login on a device with no garments takes the account and sends nothing (SYNC-8)', async () => {
  const server = fakeServer();
  server.add('u1', docOf(garment('c', 'Scarf')).garments[0]);
  const d = device({ server, storage: fakeStorage() });
  assert.equal(await d.syncer.login(sessionOf('u1')), 'synced');
  assert.deepEqual(d.client.pushed, []);
  assert.deepEqual(ids(d.box.doc), ['c']);
});

test('a login of the same user again keeps the queue and the state and goes on (ACC-11)', async () => {
  const d = device({ doc: docOf(garment('a')) });
  d.save(docOf(garment('a'), garment('b')));
  assert.equal(await d.syncer.login(sessionOf('u1')), 'synced');
  assert.deepEqual(d.client.pushed.map(({ key, op }) => [key, op]), [['b', 'upsert']]);
  assert.deepEqual(ids(d.box.doc), ['a', 'b']);
  assert.equal(d.box.sets, 0);
});

test('a login of another user with an empty queue clears the device and takes the new account, with no change sent from the old one (ACC-11)', async () => {
  const server = fakeServer();
  const coat = docOf(garment('a', 'Coat'));
  server.add('u1', coat.garments[0]);
  server.add('u2', docOf(garment('z', 'Boots')).garments[0]);
  const d = device({ server, doc: coat });
  assert.equal(await d.syncer.run(), 'ok');
  assert.notEqual(storedSync(d.storage).cursor, '');
  assert.equal(await d.syncer.login(sessionOf('u2')), 'synced');
  assert.deepEqual(d.client.pushed, []);
  assert.deepEqual(ids(d.box.doc), ['z']);
  const sync = storedSync(d.storage);
  assert.equal(sync.owner, 'u2');
  assert.deepEqual(sync.local.map(([id]) => id), ['garment:z']);
  assert.deepEqual(sync.server.map(([id]) => id), ['garment:z']);
  assert.equal(sync.cursor, server.rows.find(({ owner }) => owner === 'u2').updated);
  assert.deepEqual(sync.added, []);
  assert.equal(loadSession(d.storage).user.id, 'u2');
  assert.deepEqual(liveKeys(server, 'u2'), ['z']);
  assert.deepEqual(liveKeys(server, 'u1'), ['a']);
});

test('a login of another user with a queue asks for an export and changes nothing; with discard it clears and goes on (ACC-11)', async () => {
  const server = fakeServer();
  const coat = docOf(garment('a', 'Coat'));
  server.add('u1', coat.garments[0]);
  const d = device({ server, local: [...toRecords(coat)] });
  // A refused save (SYNC-2): the queue holds the hat and `added` names it.
  await quiet(() => d.save(docOf(garment('b', 'Hat'))));
  const doc = d.box.doc;
  const before = { sync: d.storage.getItem(SYNC_KEY), queue: d.storage.getItem(QUEUE_KEY), session: d.storage.getItem(SESSION_KEY) };
  assert.deepEqual(storedSync(d.storage).added, ['garment:b']);
  assert.equal(await d.syncer.login(sessionOf('u2')), 'ask-export');
  assert.equal(d.box.doc, doc);
  assert.equal(d.box.sets, 0);
  assert.deepEqual({ sync: d.storage.getItem(SYNC_KEY), queue: d.storage.getItem(QUEUE_KEY), session: d.storage.getItem(SESSION_KEY) }, before);
  assert.deepEqual(d.client.calls, []);
  assert.equal(d.syncer.status().pending, 1);
  assert.equal(await d.syncer.login(sessionOf('u2'), { discard: true }), 'synced');
  assert.deepEqual(d.client.pushed, []);
  assert.deepEqual(d.box.doc, emptyGarments());
  assert.equal(storedSync(d.storage).owner, 'u2');
  assert.deepEqual(storedSync(d.storage).added, []);
  assert.deepEqual(storedSync(d.storage).local, []);
  assert.deepEqual(storedQueue(d.storage), []);
  assert.deepEqual(liveKeys(server, 'u2'), []);
});

test('a login of an account with no approval saves the session, makes no request and changes no state (ACC-3)', async () => {
  const storage = fakeStorage();
  const d = device({ storage, doc: docOf(garment('a')) });
  assert.equal(await d.syncer.login(sessionOf('u1', false)), 'waiting');
  assert.equal(d.client.calls.length, 0);
  assert.equal(loadSession(storage).user.approved, false);
  assert.equal(storage.getItem(SYNC_KEY), null);
  assert.equal(storage.getItem(QUEUE_KEY), null);
  assert.deepEqual(ids(d.box.doc), ['a']);
  // Over the data of another owner, with a queue: no question yet, and the data stays.
  const e = device({ doc: docOf(garment('a')), local: [] });
  e.save(docOf(garment('a'), garment('b')));
  const sync = e.storage.getItem(SYNC_KEY);
  assert.equal(await e.syncer.login(sessionOf('u2', false)), 'waiting');
  assert.equal(e.client.calls.length, 0);
  assert.equal(e.storage.getItem(SYNC_KEY), sync);
  assert.equal(e.syncer.status().pending, 2);
  assert.equal(e.box.sets, 0);
});

test('a login during a run makes that run stale: its auth error does not stop the sync of the login (SYNC-8)', async () => {
  const d = device();
  const held = gate();
  const arrived = gate();
  let pulls = 0;
  d.client.hold = () => {
    pulls += 1;
    if (pulls > 1) return Promise.resolve();
    arrived.open();
    return held.opened.then(() => {
      throw new PocketBaseError('auth', 401);
    });
  };
  const running = d.syncer.run();
  await arrived.opened;
  const login = d.syncer.login(sessionOf('u1'));
  held.open();
  assert.equal(await running, 'ok');
  assert.equal(await login, 'synced');
  assert.equal(d.syncer.status().auth, false);
  assert.equal(pulls, 2);
});

test('logout online sends the queue, then clears the garments, the sync state, the queue and the session; the preferences stay (ACC-12)', async () => {
  const d = device();
  d.storage.setItem(OFFLINE_KEY, '1');
  d.storage.setItem(LANGUAGE_KEY, 'es');
  d.save(docOf(garment('a')));
  await d.syncer.run();
  d.save(docOf(garment('a'), garment('b')));
  assert.equal(await d.syncer.logout({ online: true }), 'done');
  assert.deepEqual(d.client.pushed.map(({ key }) => key), ['a', 'b']);
  assert.deepEqual(d.box.doc, emptyGarments());
  for (const key of [SYNC_KEY, QUEUE_KEY, SESSION_KEY]) assert.equal(d.storage.getItem(key), null, key);
  assert.equal(d.storage.getItem(OFFLINE_KEY), '1');
  assert.equal(d.storage.getItem(LANGUAGE_KEY), 'es');
  assert.equal(d.client.streams[0].closed, true);
  assert.equal(d.syncer.status().pending, 0);
});

test('logout offline with a queue asks for an export and changes nothing; with discard it clears and sends nothing (ACC-12)', async () => {
  const d = device();
  d.save(docOf(garment('a')));
  const doc = d.box.doc;
  const before = [SYNC_KEY, QUEUE_KEY, SESSION_KEY].map((key) => d.storage.getItem(key));
  assert.equal(await d.syncer.logout({ online: false }), 'ask-export');
  assert.equal(d.box.doc, doc);
  assert.equal(d.box.sets, 0);
  assert.deepEqual([SYNC_KEY, QUEUE_KEY, SESSION_KEY].map((key) => d.storage.getItem(key)), before);
  assert.deepEqual(d.client.calls, []);
  assert.equal(d.syncer.status().pending, 1);
  assert.equal(await d.syncer.logout({ online: false, discard: true }), 'done');
  assert.deepEqual(d.client.calls, []);
  assert.deepEqual(d.box.doc, emptyGarments());
  for (const key of [SYNC_KEY, QUEUE_KEY, SESSION_KEY]) assert.equal(d.storage.getItem(key), null, key);
  assert.equal(d.syncer.status().pending, 0);
});

test('logout online with a sync that stops keeps the queue and asks for an export (ACC-12)', async () => {
  const d = device();
  d.save(docOf(garment('a')));
  d.client.failPush = () => new PocketBaseError('network');
  assert.equal(await d.syncer.logout({ online: true }), 'ask-export');
  assert.equal(d.syncer.status().pending, 1);
  assert.notEqual(d.storage.getItem(SESSION_KEY), null);
});

test('an import tombstones each garment of the server that it does not hold (SYNC-9)', async () => {
  const server = fakeServer();
  const both = docOf(garment('a', 'Coat'), garment('b', 'Hat'));
  both.garments.forEach((g) => server.add('u1', g));
  const d = device({ server, doc: both });
  assert.equal(await d.syncer.run(), 'ok');
  d.save(docOf(garment('c', 'Scarf')), { explicit: true });
  assert.equal(await d.syncer.run(), 'ok');
  assert.deepEqual(d.client.pushed.map(({ key, op }) => [key, op]), [['a', 'delete'], ['b', 'delete'], ['c', 'upsert']]);
  assert.deepEqual(liveKeys(server, 'u1'), ['c']);
  assert.deepEqual(ids(d.box.doc), ['c']);
});

test('Delete all data stops the sync, clears this device only and sends nothing; the status starts again (SYNC-10)', async () => {
  const server = fakeServer();
  server.add('u1', docOf(garment('a', 'Coat')).garments[0]);
  const d = device({ server });
  assert.equal(await d.syncer.run(), 'ok');
  d.save(docOf(garment('a', 'Coat'), garment('b')));
  d.client.failPush = () => new PocketBaseError('server', 503);
  assert.equal(await d.syncer.run(), 'offline');
  assert.equal(d.syncer.status().online, false);
  const calls = d.client.calls.length;
  d.syncer.reset();
  assert.deepEqual(d.syncer.status(), { online: true, pending: 0, lastSync: null, auth: false, reached: 0 });
  assert.deepEqual(d.box.statuses.at(-1), d.syncer.status());
  assert.deepEqual(d.live(), []);
  assert.equal(d.client.calls.length, calls);
  assert.equal(d.client.streams[0].closed, true);
  for (const key of [SYNC_KEY, QUEUE_KEY, SESSION_KEY]) assert.equal(d.storage.getItem(key), null, key);
  assert.deepEqual(liveKeys(server, 'u1'), ['a']);
});

test('the stream opens after a run that reached the server, and an event starts a run (SYNC-3)', async () => {
  const d = device();
  assert.equal(d.client.streams.length, 0);
  await d.syncer.run();
  assert.equal(d.client.streams.length, 1);
  const [stream] = d.client.streams;
  assert.equal(stream.tokenFn(), loadSession(d.storage).token);
  await d.syncer.run();
  assert.equal(d.client.streams.length, 1);
  const pulls = d.client.calls.filter((call) => call === 'pull').length;
  await stream.onChange({});
  assert.equal(d.client.calls.filter((call) => call === 'pull').length, pulls + 1);
  await stream.onReconnect();
  assert.equal(d.client.calls.filter((call) => call === 'pull').length, pulls + 2);
});

test('offline closes the stream and reports offline; online runs and opens it again (SYNC-3, SYNC-11)', async () => {
  const d = device();
  await d.syncer.run();
  d.syncer.offline();
  assert.equal(d.client.streams[0].closed, true);
  assert.equal(d.syncer.status().online, false);
  assert.equal(d.box.statuses.at(-1).online, false);
  assert.equal(await d.syncer.online(), 'ok');
  assert.equal(d.syncer.status().online, true);
  assert.equal(d.client.streams.length, 2);
  assert.equal(d.client.streams[1].closed, false);
});

test('an auth stop and a reset close the stream (SYNC-3)', async () => {
  const d = device();
  await d.syncer.run();
  d.client.failRefresh = new PocketBaseError('auth', 401);
  d.box.clock = START + 600_001;
  assert.equal(await d.syncer.run(), 'auth');
  assert.equal(d.client.streams[0].closed, true);
  const e = device();
  await e.syncer.run();
  e.syncer.reset();
  assert.equal(e.client.streams[0].closed, true);
});

// A lost approval: the saves stay in the doc only, and no queue holds them.
const unapprovedEdit = () => {
  const d = device({ doc: docOf(garment('a')) });
  saveSession(d.storage, sessionOf('u1', false));
  d.save(docOf(garment('a'), garment('b')));
  assert.equal(d.syncer.status().pending, 0);
  return d;
};

test('logout after a lost approval asks for an export of an edit that no queue holds; with discard it clears (ACC-12)', async () => {
  const d = unapprovedEdit();
  const before = [SYNC_KEY, QUEUE_KEY, SESSION_KEY].map((key) => d.storage.getItem(key));
  assert.equal(await d.syncer.logout({ online: true }), 'ask-export');
  assert.deepEqual(ids(d.box.doc), ['a', 'b']);
  assert.equal(d.box.sets, 0);
  assert.deepEqual([SYNC_KEY, QUEUE_KEY, SESSION_KEY].map((key) => d.storage.getItem(key)), before);
  assert.equal(await d.syncer.logout({ online: true, discard: true }), 'done');
  assert.deepEqual(d.box.doc, emptyGarments());
  for (const key of [SYNC_KEY, QUEUE_KEY, SESSION_KEY]) assert.equal(d.storage.getItem(key), null, key);
});

test('a login of another user after a lost approval asks for an export of an edit that no queue holds; with discard it clears (ACC-11)', async () => {
  const d = unapprovedEdit();
  const before = [SYNC_KEY, QUEUE_KEY, SESSION_KEY].map((key) => d.storage.getItem(key));
  assert.equal(await d.syncer.login(sessionOf('u2')), 'ask-export');
  assert.deepEqual(ids(d.box.doc), ['a', 'b']);
  assert.equal(d.box.sets, 0);
  assert.deepEqual([SYNC_KEY, QUEUE_KEY, SESSION_KEY].map((key) => d.storage.getItem(key)), before);
  assert.deepEqual(d.client.calls, []);
  assert.equal(await d.syncer.login(sessionOf('u2'), { discard: true }), 'synced');
  assert.deepEqual(d.client.pushed, []);
  assert.deepEqual(d.box.doc, emptyGarments());
  assert.equal(storedSync(d.storage).owner, 'u2');
});

test('a merged doc that the app cannot save keeps the base and the cursor, so the next run pulls it again (SYNC-2)', async (t) => {
  t.mock.method(console, 'error', () => {});
  const server = fakeServer();
  server.add('u1', garment('a'));
  const d = device({ server, doc: docOf(garment('a')) });
  assert.equal(await d.syncer.run(), 'ok');
  const { cursor, local } = storedSync(d.storage);
  assert.notEqual(cursor, '');
  server.add('u1', garment('b'));
  d.box.failSet = true;
  assert.equal(await d.syncer.run(), 'ok');
  assert.equal(d.box.sets, 1);
  assert.deepEqual(d.box.doc.garments.map(({ id }) => id), ['a']);
  assert.equal(storedSync(d.storage).cursor, cursor);
  assert.deepEqual(storedSync(d.storage).local, local);
  assert.deepEqual(storedQueue(d.storage), []);
  d.box.failSet = false;
  assert.equal(await d.syncer.run(), 'ok');
  assert.deepEqual(d.box.doc.garments.map(({ id }) => id).sort(), ['a', 'b']);
  assert.deepEqual(storedSync(d.storage).local.map(([id]) => id).sort(), ['garment:a', 'garment:b']);
  assert.deepEqual(d.client.pushed, []);
  assert.equal(console.error.mock.callCount(), 1);
});
