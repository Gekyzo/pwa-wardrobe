# Sync between devices

The garments sync between the devices of one account through the server. Each garment is one
record on the server. A device sends its changes as records and pulls the changes of the other
devices. Its files are `src/records.js`, `src/sync.js`, `tests/records.test.js` and
`tests/sync.test.js`. Both modules are pure: they read no storage and no clock. The client of the
server (`src/pocketbase.js`) sends and receives the records (SYNC-4).

## Records

- **SYNC-1** A garment is one record `{ kind: 'garment', key: <id>, data }`. `data` is the garment
  without its `id`. The record id is `garment:<id>`. A doc built from records has version 4 and
  its garments are newest first by `creation_date`, a garment with no date last, then by `id`. The
  diff of two sets of records gives the deletes first, then the upserts, each sorted by record id.
  Two `data` values that differ only in the order of their keys are equal. The cursor of a pull is
  the greatest `updated` of the pulled records.
- **SYNC-4** The client finds a record by owner, kind and key. A push of an upsert patches the found
  record with `deleted: false` and the `data`, so a tombstone comes back. With no record, it creates
  one. A push of a delete patches the found record with `deleted: true` and keeps its `data`. A
  delete with no record creates nothing and gives no record. A create that the server refuses as a
  duplicate patches the record that another device made. A pull asks for the records of the owner
  with `updated >= cursor`, sorted by `updated`, and walks all pages. With no cursor it pulls all
  records. A request with no owner fails with an auth error and sends nothing. The stream
  subscribes to `wardrobe_records` with the current token at each connect, and a connect after the
  first reports a reconnect. A delete event gives a record with `deleted: true`.
- **SYNC-5** A change that waits in the queue wins. A pulled record with the same id does not
  change the local record. The copy of the server still takes the pulled record.
- **SYNC-6** A pulled record with `deleted` counts as absent. It removes the local record, unless
  a change of that record waits in the queue.
- **SYNC-7** The app checks each record alone, as a doc with that one garment. A record that the
  check refuses is dropped and its id is reported. The other records stay.
