// The queue of record changes, the merge of pulled records and the check of records (SYNC-5, SYNC-6, SYNC-7).
// Pure: no storage, no clock, no DOM. Every function returns new values and leaves its inputs alone.
import { recordKey } from '#records';
import { normalizeGarments } from '#garments';

const changeKey = (change) => recordKey(change.kind, change.key);

// One entry for each record: a later change replaces an earlier one and moves to the end.
export const enqueue = (queue, changes) => {
  const latest = new Map();
  for (const change of [...queue, ...changes]) {
    latest.delete(changeKey(change));
    latest.set(changeKey(change), change);
  }
  return [...latest.values()];
};

const plain = ({ kind, key, data }) => ({ kind, key, data });

// SYNC-5: a queued change wins over a pulled record. SYNC-6: a pulled record with `deleted` removes the record.
export const mergePulled = ({ local, server, queue, pulled }) => {
  const queued = new Set(queue.map(changeKey));
  const nextLocal = new Map(local);
  const nextServer = new Map(server);
  for (const rec of pulled) {
    const id = recordKey(rec.kind, rec.key);
    nextServer.set(id, rec);
    if (queued.has(id)) continue;
    if (rec.deleted) nextLocal.delete(id);
    else nextLocal.set(id, plain(rec));
  }
  return { local: nextLocal, server: nextServer };
};

// SYNC-7: each record is checked alone, so one bad record never empties the wardrobe.
export const validRecords = (records) => {
  const local = new Map();
  const dropped = [];
  for (const [id, rec] of records) {
    if (normalizeGarments({ version: 4, garments: [{ ...rec.data, id: rec.key }] })) local.set(id, rec);
    else dropped.push(id);
  }
  return { local, dropped };
};

export const cursorOf = (pulled, previous) =>
  pulled.reduce((greatest, rec) => (rec.updated > greatest ? rec.updated : greatest), previous);
