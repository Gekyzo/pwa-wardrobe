// The sync driver: it queues each save, sends the queue, pulls the account and merges it into the doc
// (SYNC-2 to SYNC-9), refreshes the token (SYNC-4), keeps the realtime stream (SYNC-3), runs the login
// and the logout (ACC-11, ACC-12), stops at Delete all data (SYNC-10) and reports the status
// (SYNC-11). The client, the storage, the clock and the timer are injected, so a test runs with no
// network.
import { toRecords, fromRecords, diffRecords, recordKey } from '#records';
import { enqueue, mergePulled, validRecords, cursorOf } from '#sync';
import { loadSession, saveSession, SESSION_KEY } from '#session';
import { PocketBaseError } from '#pocketbase';
import { normalizeGarments, emptyGarments } from '#garments';
import { keyOf } from '#storage';

export const SYNC_KEY = keyOf('sync');
export const QUEUE_KEY = keyOf('queue');

// SYNC-3: a save starts a sync after this delay; a new save in that time starts the delay again.
const DEBOUNCE_MS = 1500;
// SYNC-3: after a stop at the rate limit or at a server error, the next run starts after these delays
// in turn (the last one repeats); a run that reaches the server ends the series.
const RETRY_MS = [5_000, 15_000, 30_000, 60_000];
// SYNC-4: a token is refreshed at least this often, so that a lost approval stops the sync.
const REFRESH_MS = 10 * 60_000;
const MARGIN_MS = 60_000;

// SYNC-4: true when the `exp` claim of the token is within 60 s of `now` (ms), or cannot be read.
const tokenExpired = (token, now) => {
  try {
    const payload = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
    const { exp } = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    return typeof exp !== 'number' || exp * 1000 - MARGIN_MS <= now;
  } catch {
    return true;
  }
};

// `added`: the ids that saves added while the SYNC-2 guard refused their deletes, until a merge.
const emptySync = () => ({ owner: null, cursor: '', server: new Map(), local: new Map(), lastSync: null, added: [] });

const isEntries = (value) => Array.isArray(value) && value.every((entry) => Array.isArray(entry) && entry.length === 2);

const loadSync = (storage) => {
  try {
    const data = JSON.parse(storage.getItem(SYNC_KEY));
    const valid = data && (data.owner === null || typeof data.owner === 'string') && typeof data.cursor === 'string' && isEntries(data.server) && isEntries(data.local);
    if (!valid) return emptySync();
    return { owner: data.owner, cursor: data.cursor, server: new Map(data.server), local: new Map(data.local), lastSync: typeof data.lastSync === 'string' ? data.lastSync : null,
      added: Array.isArray(data.added) ? data.added.filter((id) => typeof id === 'string') : [] };
  } catch {
    return emptySync();
  }
};

const loadQueue = (storage) => {
  try {
    const queue = JSON.parse(storage.getItem(QUEUE_KEY));
    return Array.isArray(queue) ? queue : [];
  } catch {
    return [];
  }
};

// Why a request failed, as the result of the run. PocketBase answers a refused rule with a 400 and no
// field error (a token that is not valid counts as a guest), so that is an auth error too.
const stopOf = (error) => {
  if (error?.type === 'auth') return 'auth';
  if (error?.type === 'invalid' && Object.keys(error.fields ?? {}).length === 0) return 'auth';
  // SYNC-3, SYNC-11: a rate limit is not offline, and a server error is retried; both name their stop.
  if (error?.type === 'rate') return 'rate';
  if (error?.type === 'server') return 'server';
  return 'offline';
};

// An error that is not of the client is a bug: the run logs it and stops as offline.
const known = (error) => {
  if (!(error instanceof PocketBaseError)) throw error;
  return error;
};

const badData = (error) => error?.type === 'invalid' && Object.keys(error.fields ?? {}).length > 0;

// SYNC-2: `records` hold none of the garments `ids`, and there are some.
const holdsNone = (ids, records) => ids.length > 0 && ids.every((id) => !records.has(id));

// SYNC-5: the queued changes go on top of the merged records.
const withQueue = (records, queue) => {
  const next = new Map(records);
  for (const { kind, key, op, data } of queue) {
    if (op === 'delete') next.delete(recordKey(kind, key));
    else next.set(recordKey(kind, key), { kind, key, data });
  }
  return next;
};

// Returned by a run that a reset made stale: it stops with no save and no change of the doc.
const STALE = Symbol('stale');

export const createSyncer = ({
  client,
  storage,
  getDoc,
  // Puts a doc in place, as the app holds and saves it. It is not a save: the syncer queues nothing for it.
  setDoc,
  now = Date.now,
  onStatus = () => {},
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  // SYNC-2: true when the start could not read the garments and fell back to the empty doc.
  lost = false,
}) => {
  let sync = loadSync(storage);
  let queue = loadQueue(storage);
  // SYNC-2: the account is pulled again in full, with the empty doc as the base, so the lost doc
  // deletes nothing.
  if (lost && sync.owner !== null) sync = { ...sync, local: new Map(), cursor: '' };
  // The records of the last doc that the syncer saw: at the start, of a save, or that it put in place.
  let seen = toRecords(getDoc());

  let online = true;
  let lastRefresh = null;
  let running = null;
  let timer = null;
  // SYNC-3: the timer of the retry after a rate limit or a server error, and the delays used in a row.
  let retryTimer = null;
  let retries = 0;
  // A reset (a logout, Delete all data, a login of another user) and a login start a new generation:
  // a run of an older one is stale.
  let generation = 0;
  // SYNC-4: after an auth stop no sync makes a request until a login, so the rate limit of the auth
  // endpoints stays free for that login.
  let authStopped = false;
  // SYNC-11: counts the runs after which the server had answered (ok, a rate limit, an auth error).
  let reached = 0;
  let stream = null;

  const persist = () => {
    try {
      storage.setItem(QUEUE_KEY, JSON.stringify(queue));
      storage.setItem(SYNC_KEY, JSON.stringify({ ...sync, server: [...sync.server], local: [...sync.local] }));
    } catch {
      // Storage is not available: the sync works in memory.
    }
  };

  const status = () => ({ online, pending: queue.length, lastSync: sync.lastSync, auth: authStopped, reached });
  const report = () => onStatus(status());

  const put = (next) => {
    seen = toRecords(next);
    setDoc(next);
  };

  // SYNC-2: a doc that never held the garments of the account since the start (a doc that fell back
  // to the empty one) does not delete them. A user who deletes them one by one, or an import
  // (`explicit`), still does.
  // The garments of the account are the base, less those that a refused save added.
  const refused = (records, explicit) => {
    const account = [...sync.local.keys()].filter((id) => !sync.added.includes(id));
    if (explicit || !holdsNone(account, records) || !holdsNone(account, seen)) return false;
    console.error('sync: a doc with none of the garments of the account sends no delete of them');
    return true;
  };

  // The run only syncs for the user that a finished login made the owner of the stored data.
  const activeSession = () => {
    const session = loadSession(storage);
    return session && session.user.approved === true && sync.owner === session.user.id ? session : null;
  };

  // SYNC-2: the changes of a doc against the last state that the syncer knows.
  // A refused doc still queues its upserts and the deletes of garments that it added, and they go
  // into the base, so the merge keeps them; the garments of the account stay in the base.
  const noted = (doc, explicit) => {
    const records = toRecords(doc);
    const guard = refused(records, explicit);
    seen = records;
    const all = diffRecords(sync.local, records);
    const changes = guard ? all.filter((c) => c.op === 'upsert' || sync.added.includes(recordKey(c.kind, c.key))) : all;
    if (changes.length === 0) return false;
    queue = enqueue(queue, changes);
    const added = guard ? [...new Set([...sync.added, ...changes.filter((c) => c.op === 'upsert').map((c) => recordKey(c.kind, c.key))])] : sync.added;
    sync = { ...sync, local: guard ? withQueue(sync.local, changes) : records, added };
    persist();
    return true;
  };

  const closeStream = () => {
    stream?.();
    stream = null;
  };

  // SYNC-3: an event of the stream starts a run; one during a run starts a new run after it, since
  // the pull of that run may have missed the change.
  const onEvent = () => (running?.generation === generation ? running.promise.then(run) : run());

  const openStream = () => {
    if (stream || !activeSession()) return;
    stream = client.subscribe(() => loadSession(storage)?.token ?? '', onEvent, { onReconnect: onEvent });
  };

  // SYNC-4: refresh an expired token, and any token after REFRESH_MS. The answer carries `approved`.
  // Resolves to `{ token }`, or to `{ stop }` with the result of the run.
  const freshToken = async (session, live) => {
    if (!tokenExpired(session.token, now()) && lastRefresh !== null && now() - lastRefresh <= REFRESH_MS) return { token: session.token };
    let fresh;
    try {
      fresh = await client.refresh(session.token);
    } catch (error) {
      return { stop: live() ? stopOf(known(error)) : STALE };
    }
    if (!live()) return { stop: STALE };
    lastRefresh = now();
    saveSession(storage, fresh);
    // ACC-3: an account that is no longer approved makes no request for data.
    return fresh.user.approved === true ? { token: fresh.token } : { stop: 'ok' };
  };

  // SYNC-4: each change in order. A change leaves the queue only after the server took it, and the
  // queue is saved at once, so a run that stops resends nothing as a new record.
  const pushAll = async (token, live) => {
    for (let change = queue[0]; change; change = queue[0]) {
      let rec;
      try {
        rec = await client.push(token, change, sync.owner);
      } catch (error) {
        if (!live()) return STALE;
        // SYNC-4: the server refuses this data (`rec` stays undefined): the change is dropped and
        // the next changes go on.
        if (!badData(known(error))) return stopOf(error);
      }
      if (!live()) return STALE;
      const id = recordKey(change.kind, change.key);
      const server = new Map(sync.server);
      if (rec) server.set(id, rec);
      else if (rec === null) server.delete(id);
      sync = { ...sync, server };
      // By identity: a save during the push may have replaced the change with a newer one.
      queue = queue.filter((queued) => queued !== change);
      persist();
    }
    return null;
  };

  // SYNC-5 to SYNC-7: the pulled records go into the doc, each checked alone; a queued change wins.
  // The doc that the merge puts in place is the new base: nothing of it is queued.
  const merge = (pulled) => {
    const merged = mergePulled({ local: sync.local, server: sync.server, queue, pulled });
    const { local, dropped } = validRecords(merged.local);
    if (dropped.length > 0) console.error('sync: records that the check refuses are dropped', dropped);
    const next = normalizeGarments(fromRecords(withQueue(local, queue)));
    if (next === null) {
      // Each record passed alone, so this is a bug: the doc, the queue and the cursor stay.
      console.error('sync: the merged garments are not a valid doc');
      return;
    }
    const nextRecords = toRecords(next);
    if (diffRecords(toRecords(getDoc()), nextRecords).length > 0) put(next);
    else seen = nextRecords;
    sync = { ...sync, server: merged.server, local: nextRecords, cursor: cursorOf(pulled, sync.cursor), added: [] };
  };

  const syncOnce = async (live) => {
    const session = activeSession();
    if (!session) return 'ok';
    // SYNC-2: a save that notify did not queue (no session yet, an auth stop) is queued now, so that
    // the merge cannot overwrite it.
    noted(getDoc(), false);
    const { token, stop } = await freshToken(session, live);
    if (stop) return stop;
    const stopped = await pushAll(token, live);
    if (stopped) return stopped;
    let pulled;
    try {
      pulled = await client.pull(token, sync.cursor, sync.owner);
    } catch (error) {
      return live() ? stopOf(known(error)) : STALE;
    }
    if (!live()) return STALE;
    merge(pulled);
    sync = { ...sync, lastSync: new Date(now()).toISOString() };
    persist();
    return 'ok';
  };

  // A run while one of the same generation is in progress gets the promise of that run.
  const run = () => {
    if (authStopped) {
      report();
      return Promise.resolve('auth');
    }
    if (running?.generation === generation) return running.promise;
    const mine = { generation };
    const live = () => mine.generation === generation;
    mine.promise = (async () => {
      let result;
      try {
        result = await syncOnce(live);
      } catch (error) {
        console.error(error);
        result = 'offline';
      } finally {
        if (running === mine) running = null;
      }
      if (result === STALE || !live()) return 'ok';
      if (result === 'auth') {
        authStopped = true;
        closeStream();
      }
      const retry = result === 'rate' || result === 'server';
      if (result === 'server') result = 'offline';
      // SYNC-11: only a stop at the network or at a server error counts as offline; a rate limit
      // keeps the queue and the online status.
      online = result !== 'offline';
      if (online) reached += 1;
      if (retry) scheduleRetry();
      else {
        cancelRetry();
        if (result === 'ok') retries = 0;
      }
      if (result === 'ok') openStream();
      report();
      return result;
    })();
    running = mine;
    return mine.promise;
  };

  const cancelTimer = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  const schedule = () => {
    cancelTimer();
    timer = setTimer(() => {
      timer = null;
      return run();
    }, DEBOUNCE_MS);
  };

  const cancelRetry = () => {
    if (retryTimer !== null) clearTimer(retryTimer);
    retryTimer = null;
  };

  const scheduleRetry = () => {
    cancelRetry();
    const delay = RETRY_MS[Math.min(retries, RETRY_MS.length - 1)];
    retries += 1;
    retryTimer = setTimer(() => {
      retryTimer = null;
      return run();
    }, delay);
  };

  // SYNC-2: the app calls it after each save, never for a doc that setDoc gave. A device with no
  // account keeps no queue. After an auth stop the change waits in the queue for the login (SYNC-4).
  // An import is `explicit` (SYNC-9): the next run deletes each garment of the account that it lacks.
  const notify = (doc, { explicit = false } = {}) => {
    if (!activeSession()) return;
    if (noted(doc, explicit)) report();
    if (!authStopped) schedule();
  };

  // SYNC-10: a run in progress becomes stale: it saves nothing and changes no doc after this. The
  // timers and the stream stop, and nothing is sent. The session, the sync state and the queue leave
  // the storage, and the status starts again; the app saves the empty doc that setDoc gives.
  const reset = () => {
    generation += 1;
    cancelTimer();
    cancelRetry();
    closeStream();
    retries = 0;
    sync = emptySync();
    queue = [];
    lastRefresh = null;
    authStopped = false;
    online = true;
    reached = 0;
    try {
      [SESSION_KEY, SYNC_KEY, QUEUE_KEY].forEach((key) => storage.removeItem(key));
    } catch {
      // Storage is not available: nothing is saved either.
    }
    put(emptyGarments());
    report();
  };

  // ACC-11, SYNC-8. With `discard` the user has exported, or declined, the queue of the previous user.
  // 'ask-export' changes nothing, the session too: the app keeps the session and logs in again.
  const login = async (session, { discard = false } = {}) => {
    const approved = session.user.approved === true;
    const other = sync.owner !== null && sync.owner !== session.user.id;
    if (approved && other && queue.length > 0 && !discard) return 'ask-export';
    authStopped = false;
    saveSession(storage, session);
    lastRefresh = now();
    // ACC-3: no request for data, and the local doc stays as it is.
    if (!approved) return 'waiting';
    if (other) {
      // ACC-11: nothing of the previous user stays, so no diff against its base reaches this account.
      reset();
      saveSession(storage, session);
      lastRefresh = now();
    } else if (sync.owner === null) {
      // SYNC-8: the base is empty, so each local garment is queued and the pull brings the account;
      // a garment on both sides keeps the copy of the device (SYNC-5).
      sync = { ...sync, cursor: '', server: new Map(), local: new Map(), added: [] };
    }
    sync = { ...sync, owner: session.user.id };
    persist();
    // A run in progress uses the token of before the login: it becomes stale, so that its auth error
    // cannot stop the sync of this login, and the login starts a run of its own.
    generation += 1;
    await run();
    return 'synced';
  };

  // ACC-12: online, the queue goes first. Changes that are still not sent need an export first, and
  // then nothing changes. The device preferences and the offline flag stay.
  const logout = async ({ online: isOnline, discard = false }) => {
    if (isOnline) await run();
    if (queue.length > 0 && !discard) return 'ask-export';
    reset();
    return 'done';
  };

  // SYNC-3, SYNC-11: the app calls these on the `online` and `offline` events of the window.
  const goOnline = () => run();
  const goOffline = () => {
    closeStream();
    online = false;
    report();
  };

  return { notify, run, login, logout, reset, status, online: goOnline, offline: goOffline };
};
