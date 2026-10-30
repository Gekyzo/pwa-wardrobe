// The garments doc as records, one for each garment (SYNC-1), and the diff of two such sets.
// Pure: no storage, no clock, no DOM.
export const recordKey = (kind, key) => `${kind}:${key}`;

export const toRecords = (doc) =>
  new Map(doc.garments.map(({ id, ...data }) => [recordKey('garment', id), { kind: 'garment', key: id, data }]));

const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Newest first, a garment with no date last, then by key. The result is not validated.
export const fromRecords = (records) => ({
  version: 4,
  garments: [...records.values()]
    .map(({ key, data }) => ({ id: key, ...data }))
    .sort((a, b) => byKey(b.creation_date ?? '', a.creation_date ?? '') || byKey(a.id, b.id)),
});

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((name) => [name, canonical(value[name])]));
  }
  return value;
};

const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

// Deletes first, then upserts, each by record id.
export const diffRecords = (prev, next) => {
  const deletes = [...prev.keys()]
    .filter((id) => !next.has(id))
    .sort(byKey)
    .map((id) => ({ kind: prev.get(id).kind, key: prev.get(id).key, op: 'delete' }));
  const upserts = [...next.keys()]
    .filter((id) => !prev.has(id) || !same(prev.get(id).data, next.get(id).data))
    .sort(byKey)
    .map((id) => ({ kind: next.get(id).kind, key: next.get(id).key, op: 'upsert', data: next.get(id).data }));
  return [...deletes, ...upserts];
};
