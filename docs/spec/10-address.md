# The move to the new address

Rules of `src/move.js` and `src/ui/move.js`. The app moved from
`https://gekyzo.github.io/pwa-wardrobe/` (the old address) to
`https://attire.artisandevs.duckdns.org/` (the new address, VER-9). Both serve the same files, and
the browser keeps the data of each origin apart, so the data moves by a copy. The old origin
`gekyzo.github.io` also holds the data of the other apps there; the move copies the garments
document only.

- **ADDR-1** On the old address (`gekyzo.github.io`) the app shows a full screen over the app:
  the app moved to the new address, and one button, **Move my data**. The screen has no close,
  and the app does not leave by itself. On any other host the screen never shows.
- **ADDR-2** A session never goes into a URL. With a session, the button first runs a sync
  (SYNC-3). Offline, the screen says that the move waits for the connection, and it goes
  on when the device is online. After a sync that ends `ok`, with nothing pending and an approved
  account, it opens the new address with no data: the user signs in there and gets the account
  (ACC-3). Any other end (a pending approval, a stopped session, a failed send) carries the data
  as ADDR-3 does, so no garment stays behind.
- **ADDR-3** With no session, the button packs the backup that Export writes (the garments
  document) into the fragment `#import=<data>`, compressed (`deflate-raw`) and in
  base64url, and opens the new address with the query of the old one. The fragment never reaches a
  server.
- **ADDR-4** When the fragment would pass 1 000 000 characters, or the browser has no
  `CompressionStream`, the button opens no address: the
  screen asks the user to export, then to import the file on the new address.
- **ADDR-5** At the start, the new address reads `#import=` and removes the fragment from the URL
  before anything else, so a reload or the back button imports nothing. Data that is not a backup
  gets the error of Import as a message, and the state stays as it was.
- **ADDR-6** A backup that arrives on an app with no data is imported, with the message that the
  data moved and an undo. With no session, the arrival also sets the flag of **Use offline** (ACC-1),
  so the app opens and not **Sign in**: the user had the app open on the old address. On an app with
  data the app asks first whether to replace this device's
  data; with a session it asks the question of Import, since the account is replaced on every
  device (SYNC-9). No keeps it. The move never merges.
- **ADDR-7** The old address keeps its data: the move copies it.
- **ADDR-8** After a move, the new address tells the user to install the new address and to remove
  the icon of the old one.
