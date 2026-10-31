# Sync between devices

The garments sync between the devices of one account through the server. Each garment is one
record on the server. A device sends its changes as records and pulls the changes of the other
devices. Its files are `src/records.js`, `src/sync.js`, `tests/records.test.js` and
`tests/sync.test.js`. Both modules are pure: they read no storage and no clock. The client of the
server (`src/pocketbase.js`) sends and receives the records (SYNC-4). The sync driver
(`src/syncer.js`, `tests/syncer.test.js`) queues the saves and runs the sync; it takes the client,
the storage, the clock and the timer as parameters.

## Records

- **SYNC-1** A garment is one record `{ kind: 'garment', key: <id>, data }`. `data` is the garment
  without its `id`. The record id is `garment:<id>`. A doc built from records, and the check of
  SYNC-7, take the `id` of a garment from the key, also when `data` holds an `id`. The doc has version 4 and
  its garments are newest first by `creation_date`, a garment with no date last, then by `id`. The
  diff of two sets of records gives the deletes first, then the upserts, each sorted by record id.
  Two `data` values that differ only in the order of their keys are equal. The cursor of a pull is
  the greatest `updated` of the pulled records.
- **SYNC-2** Each save of a device with an approved session and a stored owner queues its diff
  against the last state that the driver knows, and that state moves to the saved doc. A doc that
  the driver puts in place after a merge is not a save: it queues nothing, and it hides an open
  **Undo** toast, whose doc of before the merge would delete the merged garments. A run first queues a
  save that the driver did not see (no session yet, an auth stop). A save that holds none of the
  garments of the account, from a doc that held none of them since the start, queues no delete of
  them and is logged: a doc that fell back to the empty one deletes nothing. Such a save still
  queues its new and changed garments, and the deletes of the garments that it added, and they
  join the base (with their ids in `wardrobe.sync` until the next merge), so the merge keeps them
  next to the garments of the account. A user who deletes the garments
  one by one, or an explicit save such as an import, still queues the deletes. When the start could
  not read the garments (`lost`), the account is pulled again in full with an empty base, so
  nothing is deleted.
- **SYNC-3** A sync starts at the start of the app and at the `online` event (after the refresh
  of ACC-6, through the login), when the app shows again (`visibilitychange` to visible) while the
  browser is online, 1.5 s after the last save of a burst (a new save in that time starts the delay
  again) and at each event of the realtime stream. Over **Sign in** after an auth stop, the
  `online` event only runs the sync, which waits for the login. A run asked for while one runs gets that run; a stream event during a run starts
  one more run after it. The stream opens after a run that ends `ok`, and closes at a reset, at an
  auth stop and at the `offline` event. A stop at a rate limit (429) or a server error (5xx)
  starts the next run after 5, 15, 30 and then 60 s, the last delay again for each further stop; a
  run that reaches the server ends the series.
- **SYNC-4** The client finds a record by owner, kind and key. A push of an upsert patches the found
  record with `deleted: false` and the `data`, so a tombstone comes back. With no record, it creates
  one. A push of a delete patches the found record with `deleted: true` and keeps its `data`. A
  delete with no record creates nothing and gives no record. A create that the server refuses as a
  duplicate patches the record that another device made. A pull asks for the records of the owner
  with `updated >= cursor`, sorted by `updated`, and walks all pages. With no cursor it pulls all
  records. A request with no owner fails with an auth error and sends nothing. The stream
  subscribes to `wardrobe_records` with the current token at each connect, and a connect after the
  first reports a reconnect. A delete event gives a record with `deleted: true`.
  A run refreshes the token when it expires within 60 s, when it cannot be read, or when the last
  refresh is more than 10 min old; a session that the refresh finds no longer approved (ACC-3)
  makes no request for data. The run then sends the queue in order, then pulls from the cursor and
  merges. A change leaves the queue only when the server took it, and the queue is saved at once.
  The run stops at the first change that fails, and keeps the queue: a network or server error is
  `offline`, a 429 is `rate`. A 400 with field errors drops that change and goes on. A 401, a 403
  or a 400 with no field error (a refused rule) is an auth stop: the queue stays, the status has
  `auth`, and no run makes a request until the next login; a save still queues. The app then shows
  **Sign in** over the app, which can close (ACC-2), and keeps the garments and the queue. A run that ends
  stores the time of the sync. A reset (a logout, Delete all data, or a login of another user)
  makes a run in progress stale: it saves nothing and changes no doc (SYNC-10).
- **SYNC-5** A change that waits in the queue wins. A pulled record with the same id does not
  change the local record. The copy of the server still takes the pulled record.
- **SYNC-6** A pulled record with `deleted` counts as absent. It removes the local record, unless
  a change of that record waits in the queue.
- **SYNC-7** The app checks each record alone, as a doc with that one garment. A record that the
  check refuses is dropped and its id is reported. The other records stay.

## Login, import and reset

- **SYNC-8** The first login on a device with no stored owner merges. The base of the sync is
  empty, so each local garment is queued as an upsert, and the pull brings the garments of the
  account. A garment on both sides (the same id) keeps the copy of the device, as a queued change
  wins (SYNC-5). A device with no garments takes the account and sends nothing. No garment is
  dropped, so the device keeps no copy of the list of before the login. A login of the stored
  owner goes on with the queue and the state. A login starts a run of its own; a run in progress
  with the token of before the login becomes stale, so its auth error cannot stop this sync.
- **SYNC-9** An import replaces the garments of the account, so on every device. With a session
  its question is `import.confirmAccount`, which says so. It is an explicit save: the next run
  sends a tombstone for each garment of the account that the device knows and the import does not
  hold, and an upsert for the others, with no regard to the guard of SYNC-2. A garment that another
  device added after the last sync, or a pulled record that the check dropped (SYNC-7), is not
  known: it stays on the server. The first comes into the doc at the next pull.
- **SYNC-10** **Delete all data** (SET-3) clears this device only. The sync stops first, before
  the storage is removed: a run in
  progress becomes stale and saves nothing, the timers and the stream stop, and the queue is
  dropped. The driver sends nothing; it removes the session, the sync state and the queue, puts
  the empty doc in place, and the status starts again (online, nothing pending, `reached` 0).
  The garments of the account stay on the server.

## Status

- **SYNC-11** The status is `{ online, pending, lastSync, auth, reached }`. `online` is false
  after the `offline` event or a run that stopped at the network or at a server error, and true
  again after a run that reached the server. A rate limit keeps it. `pending` is the length of the
  queue, and `reached` counts the runs that the server answered. While a session is saved and
  `online` is false, the note `sync.offline` shows above Wardrobe and Combinations, not in
  Settings. The status also gives the last sync of Settings (ACC-8).

## Keys

- `wardrobe.sync`: the owner, the cursor, the last server records, the base records, the time
  of the last sync and the ids that a refused save added (SYNC-2).
- `wardrobe.queue`: the changes that the server has not taken, in order.
