import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, PocketBaseError } from '#pocketbase';
import { apiUrl, LOCAL_API, PRODUCTION_API } from '#config';

const URL_ = 'https://pb.test';
const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
const userRecord = { id: 'user1', email: 'a@b.c', name: 'Ana' };
const auth = reply(200, { token: 'T', record: { ...userRecord, extra: 1 } });
// The access row of the user for this app (ACC-3); no status: no row.
const access = (status) => reply(200, { items: status ? [{ id: 'acc1', user: 'user1', app: 'app1', status }] : [], page: 1, totalPages: status ? 1 : 0 });
const app = reply(200, { items: [{ id: 'app1', slug: 'wardrobe' }] });
const unique = reply(400, { data: { user: { code: 'validation_not_unique' }, app: { code: 'validation_not_unique' } } });
const methods = reply(200, {
  oauth2: { providers: [{ name: 'github', authURL: 'x' }, { name: 'google', state: 'S', codeVerifier: 'V', authURL: 'https://g.test/auth?redirect_uri=' }] },
});
const PENDING = { provider: 'google', state: 'S', codeVerifier: 'V' };

// A fake fetch that records each request and answers from a list of replies, in order.
const fake = (...replies) => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: new globalThis.URL(url), method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    const next = replies.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { calls, client: createClient({ url: `${URL_}/`, fetch }) };
};

test('apiUrl gives the local server on a local host and the production one elsewhere', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) assert.equal(apiUrl(host), LOCAL_API);
  assert.equal(apiUrl('gekyzo.github.io'), PRODUCTION_API);
});

test('oauthStart appends the encoded redirect URL to the authURL of google', async () => {
  const { calls, client } = fake(methods);
  const started = await client.oauthStart('https://app.test/x?a=1');
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].url.href, 'https://pb.test/api/collections/users/auth-methods');
  assert.equal(started.url, 'https://g.test/auth?redirect_uri=https%3A%2F%2Fapp.test%2Fx%3Fa%3D1');
  assert.deepEqual(started.pending, PENDING);
});

test('oauthStart without a google provider is an invalid error', async () => {
  const { client } = fake(reply(200, { oauth2: { providers: [] } }));
  await assert.rejects(client.oauthStart('u'), { type: 'invalid' });
});

test('oauthFinish refuses a state that is not the one sent, with no request', async () => {
  const { calls, client } = fake();
  await assert.rejects(client.oauthFinish({ code: 'C', state: 'other' }, PENDING, 'u'), { type: 'state' });
  assert.equal(calls.length, 0);
});

test('oauthFinish exchanges the code and reads the approved access row of the app', async () => {
  const { calls, client } = fake(auth, access('approved'));
  const session = await client.oauthFinish({ code: 'C', state: 'S' }, PENDING, 'https://app.test/');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].url.pathname, '/api/collections/users/auth-with-oauth2');
  assert.deepEqual(calls[0].body, { provider: 'google', code: 'C', codeVerifier: 'V', redirectURL: 'https://app.test/' });
  assert.equal(calls[1].url.pathname, '/api/collections/app_access/records');
  assert.equal(calls[1].url.searchParams.get('filter'), 'user = "user1" && app.slug = "wardrobe"');
  assert.equal(calls[1].headers.Authorization, 'T');
  assert.deepEqual(session, { token: 'T', user: { ...userRecord, approved: true } });
});

test('a pending or revoked row is not approved', async () => {
  for (const status of ['pending', 'revoked']) {
    const { client } = fake(auth, access(status));
    const session = await client.oauthFinish({ code: 'C', state: 'S' }, PENDING, 'u');
    assert.equal(session.user.approved, false, status);
  }
});

test('with no access row, a sign-in asks for access with a pending row (ACC-3)', async () => {
  const { calls, client } = fake(auth, access(null), app, reply(200, { id: 'acc1', status: 'pending' }));
  const session = await client.oauthFinish({ code: 'C', state: 'S' }, PENDING, 'u');
  assert.equal(calls[2].url.searchParams.get('filter'), 'slug = "wardrobe"');
  assert.equal(calls[3].method, 'POST');
  assert.deepEqual(calls[3].body, { user: 'user1', app: 'app1', status: 'pending' });
  assert.equal(session.user.approved, false);
});

test('a duplicate access row made meanwhile is read again', async () => {
  const { client } = fake(auth, access(null), app, unique, access('approved'));
  const session = await client.oauthFinish({ code: 'C', state: 'S' }, PENDING, 'u');
  assert.equal(session.user.approved, true);
});

test('an app that the server does not list is an invalid error', async () => {
  const { client } = fake(auth, access(null), reply(200, { items: [] }));
  await assert.rejects(client.oauthFinish({ code: 'C', state: 'S' }, PENDING, 'u'), { type: 'invalid', status: 404 });
});

test('refresh posts the token and reads the access row again', async () => {
  const { calls, client } = fake(reply(200, { token: 'T2', record: userRecord }), access('revoked'));
  const session = await client.refresh('T');
  assert.equal(calls[0].url.pathname, '/api/collections/users/auth-refresh');
  assert.equal(calls[0].headers.Authorization, 'T');
  assert.deepEqual(session, { token: 'T2', user: { ...userRecord, approved: false } });
});

test('the errors have a type: network, auth, rate, server', async () => {
  const cases = [
    [new TypeError('offline'), 'network'],
    [reply(401, {}), 'auth'],
    [reply(403, {}), 'auth'],
    [reply(429, {}), 'rate'],
    [reply(500, {}), 'server'],
  ];
  for (const [answer, type] of cases) {
    const { client } = fake(answer);
    await assert.rejects(client.refresh('T'), (error) => error instanceof PocketBaseError && error.type === type);
  }
});

test('a body that is not JSON is a server error', async () => {
  const { client } = fake({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } });
  await assert.rejects(client.refresh('T'), { type: 'server' });
});

// The records (SYNC-4).
const rec = (over = {}) => ({ id: 'r1', kind: 'garment', key: 'g1', data: { name: 'Shirt' }, deleted: false, updated: '2026-01-01 00:00:00.000Z', ...over });
const page = (items, totalPages = 1) => reply(200, { items, page: 1, totalPages });
const upsert = { op: 'upsert', kind: 'garment', key: 'g1', data: { name: 'Shirt' } };

test('pull sends the owner and cursor filter and walks every page sorted by updated (SYNC-4)', async () => {
  const { calls, client } = fake(page([rec({ id: 'a' })], 2), page([rec({ id: 'b' })], 2));
  const records = await client.pull('T', '2026-01-01 00:00:00.000Z', 'u1');
  assert.deepEqual(records.map(({ id }) => id), ['a', 'b']);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.pathname, '/api/collections/wardrobe_records/records');
  assert.equal(calls[0].url.searchParams.get('filter'), 'owner = "u1" && updated >= "2026-01-01 00:00:00.000Z"');
  assert.equal(calls[0].url.searchParams.get('sort'), 'updated');
  assert.equal(calls[0].url.searchParams.get('perPage'), '200');
  assert.deepEqual([calls[0].url.searchParams.get('page'), calls[1].url.searchParams.get('page')], ['1', '2']);
  assert.equal(calls[0].headers.Authorization, 'T');
});

test('pull with no cursor filters by owner only and keeps the fields of a record (SYNC-4)', async () => {
  const { calls, client } = fake(page([{ ...rec(), owner: 'u1', extra: 1, deleted: undefined }]));
  const [first] = await client.pull('T', '', 'u1');
  assert.equal(calls[0].url.searchParams.get('filter'), 'owner = "u1"');
  assert.deepEqual(first, rec({ deleted: false }));
});

test('pull and push without an owner throw an auth error with no request (SYNC-4)', async () => {
  const { calls, client } = fake();
  await assert.rejects(client.pull('T', '', ''), { type: 'auth' });
  await assert.rejects(client.push('T', upsert, ''), { type: 'auth' });
  assert.equal(calls.length, 0);
});

test('push of an upsert on a tombstoned record patches deleted false with the data (SYNC-4)', async () => {
  const { calls, client } = fake(page([rec({ deleted: true })]), reply(200, rec()));
  const result = await client.push('T', upsert, 'u1');
  assert.equal(calls[0].url.searchParams.get('filter'), 'owner = "u1" && kind = "garment" && key = "g1"');
  assert.equal(calls[1].method, 'PATCH');
  assert.equal(calls[1].url.pathname, '/api/collections/wardrobe_records/records/r1');
  assert.deepEqual(calls[1].body, { deleted: false, data: { name: 'Shirt' } });
  assert.equal(result.deleted, false);
});

test('push of a delete patches deleted true and keeps the data (SYNC-4)', async () => {
  const { calls, client } = fake(page([rec()]), reply(200, rec({ deleted: true })));
  const result = await client.push('T', { op: 'delete', kind: 'garment', key: 'g1' }, 'u1');
  assert.deepEqual(calls[1].body, { deleted: true });
  assert.equal(result.deleted, true);
});

test('push of a delete with no record resolves null and posts nothing (SYNC-4)', async () => {
  const { calls, client } = fake(page([]));
  assert.equal(await client.push('T', { op: 'delete', kind: 'garment', key: 'g1' }, 'u1'), null);
  assert.equal(calls.length, 1);
});

test('push of an upsert with no record posts the whole record (SYNC-4)', async () => {
  const { calls, client } = fake(page([]), reply(200, rec()));
  assert.equal((await client.push('T', upsert, 'u1')).id, 'r1');
  assert.equal(calls[1].method, 'POST');
  assert.deepEqual(calls[1].body, { owner: 'u1', kind: 'garment', key: 'g1', deleted: false, data: { name: 'Shirt' } });
});

test('push whose post is a duplicate finds the record again and patches it (SYNC-4)', async () => {
  const { calls, client } = fake(page([]), unique, page([rec()]), reply(200, rec()));
  await client.push('T', upsert, 'u1');
  assert.deepEqual(calls.map(({ method }) => method), ['GET', 'POST', 'GET', 'PATCH']);
});

test('push whose post fails for another reason rethrows it (SYNC-4)', async () => {
  const { calls, client } = fake(page([]), reply(400, {}));
  await assert.rejects(client.push('T', upsert, 'u1'), { type: 'invalid' });
  assert.equal(calls.length, 2);
});

test('push whose duplicate post finds nothing rethrows the duplicate (SYNC-4)', async () => {
  const { client } = fake(page([]), unique, page([]));
  await assert.rejects(client.push('T', upsert, 'u1'), { status: 400 });
});

// A fake EventSource: the test fires its events.
const stream = () => {
  const sources = [];
  class EventSource {
    constructor(url) {
      this.url = url;
      this.handlers = {};
      this.closed = false;
      sources.push(this);
    }
    addEventListener(name, handler) { this.handlers[name] = handler; }
    close() { this.closed = true; }
  }
  return { sources, EventSource };
};

test('subscribe posts the subscription with the current token at each connect and reports a reconnect (SYNC-4)', async () => {
  const { sources, EventSource } = stream();
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url: new globalThis.URL(url), body: JSON.parse(init.body), headers: init.headers }); return { ok: true, status: 204, json: async () => { throw new SyntaxError('x'); } }; };
  const client = createClient({ url: URL_, fetch, EventSource });
  let token = 'T1';
  let reconnects = 0;
  const close = client.subscribe(() => token, () => {}, { onReconnect: () => { reconnects += 1; } });
  assert.equal(sources[0].url, `${URL_}/api/realtime`);
  await sources[0].handlers.PB_CONNECT({ data: '{"clientId":"c1"}' });
  assert.equal(reconnects, 0);
  assert.deepEqual(calls[0].body, { clientId: 'c1', subscriptions: ['wardrobe_records'] });
  assert.equal(calls[0].headers.Authorization, 'T1');
  token = 'T2';
  await sources[0].handlers.PB_CONNECT({ data: '{"clientId":"c2"}' });
  assert.equal(reconnects, 1);
  assert.equal(calls[1].headers.Authorization, 'T2');
  close();
  assert.equal(sources[0].closed, true);
});

test('subscribe gives a record, a delete action as deleted true, and drops a malformed event (SYNC-4)', () => {
  const { sources, EventSource } = stream();
  const client = createClient({ url: URL_, fetch: async () => reply(204, null), EventSource });
  const got = [];
  client.subscribe('T', (record) => got.push(record));
  const fire = sources[0].handlers.wardrobe_records;
  fire({ data: JSON.stringify({ action: 'update', record: { ...rec(), owner: 'u1' } }) });
  fire({ data: JSON.stringify({ action: 'delete', record: rec() }) });
  fire({ data: 'not json' });
  assert.deepEqual(got, [rec(), rec({ deleted: true })]);
});

test('subscribe survives a failed subscription post (SYNC-4)', async () => {
  const { sources, EventSource } = stream();
  const client = createClient({ url: URL_, fetch: async () => { throw new Error('offline'); }, EventSource });
  client.subscribe('T', () => {});
  await sources[0].handlers.PB_CONNECT({ data: '{"clientId":"c1"}' });
});
