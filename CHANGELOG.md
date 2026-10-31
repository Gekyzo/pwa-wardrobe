# Changelog

Technical changes, newest first. What a user sees of a version goes to `release-notes/`, in each language of the app.

## Unreleased

No change.

## 0.1.15 - 2026-10-31

- **Sync of the garments** between the devices of an approved account (09-sync.md, ACC-6, ACC-8, ACC-11, ACC-12, SET-3). Each garment is a record of `wardrobe_records` on the account server: `src/records.js` (records, diff), `src/sync.js` (queue, merge, tombstones, check of each record), the record calls of `src/pocketbase.js` (pull, push, realtime stream over `EventSource`) and the driver `src/syncer.js` (queue of each save, debounce of 1.5 s, retries 5/15/30/60 s, token refresh every 10 min, generations, stream, status). Keys `wardrobe.sync` and `wardrobe.queue`.
- The app wires the driver in `src/ui/account.js`: the login after the Google return and after each refresh (ACC-6) goes through `syncer.login`, with `account.exportAsk` for unsent changes of another user (the session waits in memory); **Log out** goes through `syncer.logout`, with `account.logoutAsk` and `account.logoutExport`; Log out of Waiting for approval drops only the session of an account that does not own the garments; an auth stop shows Sign in over the app, which can close; `online`, `offline` and `visibilitychange` run or pause the sync. `commit` of `src/ui/context.js` calls a save hook (`setOnSave`) that queues the save, an import passes `explicit` (SYNC-9), and a merged doc goes in place through `replaceDoc`, with no hook. `isDocLost` of `src/storage.js` gives the `lost` flag of SYNC-2. The export file comes from `exportDoc` of `src/ui/context.js`.
- Settings › Account shows the last sync under the email (`account.lastSync`, `account.never`; component `account-row`); the note `sync.offline` (component `sync-note`) shows over Wardrobe and Combinations while the sync cannot reach the server. **Delete all data** stops the sync first (`stopSync`, SYNC-10), and `reset.confirmLocal` says the account keeps the garments; an import with a session asks `import.confirmAccount`. The shell cache goes to `wardrobe-shell-v8`.
- A `storage` event of another tab that changes the garments, the queue, the sync state (other than `lastSync` and the server copy), the user or the approval of the session stops the syncer of this tab (`syncer.stop`) and loads the page again (`reloadsOn` of `src/syncer.js`, `goStale` of `src/ui/account.js`, SYNC-12), so two tabs never pair the doc of one with the sync base of the other.

## 0.1.14 - 2026-10-31

- The buy date of a new garment starts at today (WAR-3); an edit shows the stored date, empty when there is none.
- **Buy date, price and creation date** (GAR-12, GAR-5, WAR-3, WAR-4): the garments doc goes to version 4 with `buy_date` (`''` or `YYYY-MM-DD`), `price` (`null` or a number > 0 up to `MAX_PRICE`, two decimals, a comma accepted through `parseValue`) and `creation_date` (the `toISOString` instant of `addGarment`, kept by `editGarment`, `''` for migrated garments). The sheet has a Purchase part with a date input (max today) and a decimal price input; the detail shows the price in EUR, the buy date and `wardrobe.added` in the formats of the language. `isDay` is exported. The shell cache goes to `wardrobe-shell-v7` (SW-10). Keys `wardrobe.purchase`, `wardrobe.buyDate`, `wardrobe.price`, `wardrobe.priceEuros`, `wardrobe.added`, `error.buyDateInvalid`, `error.priceInvalid`.
- **Brand suggestions** (GAR-11, WAR-3): `src/brands.js` holds a seed list `BRANDS` and `suggestBrands`, which gives the brands that start with the text, case and accents aside: the brands of the wardrobe first, then the seed brands it does not hold. The datalist `garment-brands` fills on each `input` of the brand field and is empty while the field is empty.
- **Random outfit** in the Wardrobe section (OUT-9, WAR-9): `randomOutfit` of `src/outfits.js` takes one outfit of every combination under the season filter, never the one in view while there is another (`except`, the key `outfitKey`, formerly `keyOf`). The detail is `#random-outfit` in `#garment-detail`, state `ui.random`; Escape, Back and the back slide close it. Keys `wardrobe.random`, `wardrobe.randomAgain`, `wardrobe.noRandom`; new icon `shuffle`.
- **Delete all data** in Settings › Backup, as in pwa-template (SET-3): `resetAll` in `src/storage.js` removes each `localStorage` key `wardrobe.*`, and no key of another app of the origin; the page loads again as a new install. With a session the question says that it also logs out (`signedIn` of `src/ui/account.js`). Keys `settings.reset`, `reset.confirm`, `reset.confirmLocal`, `error.resetFailed`.

## 0.1.13 - 2026-10-30

- Design system 0.8.1 (`npm run ds`): the wide layout of the entry below now comes from LAY-1 to LAY-5, and `styles.css` drops its versions of `nav-bar`, `app-header` and `sheet` and the DS-8 skip of `tests/design.test.js`. From 600px the header and `main` share the padding of the design system, so the title lines up with the list; from 840px the detail of a garment or a palette is a card beside the list, 24px apart; Settings sets `--page-max` to `--settings-max`.
- Desktop layout of `pwa-shopping-list` (DSV-5, DSV-6, NAV-4 to NAV-6, SET-2): four width classes; from 600px the rail at the left with either hand and **Add garment** in the header (`header-add`) in place of the `+`; from 840px side sheets at the end of the frame, below the header (`--header-height` from a `ResizeObserver` in `src/app.js`), and Settings in two columns with help lines for Backup and Preferences; from 1024px a centred frame of at most 1280px with a 232px sidebar: the app mark, labelled sections and, with no session, `nav.local`. `tests/design.test.js` skips DS-8 and runs it again without the 1024px query. `.version-status` is relative, so Settings no longer scrolls the page as well. New keys `app.name`, `nav.local`, `settings.backupHint`, `settings.preferencesHint`; new icon `plus`.

## 0.1.12 - 2026-10-27

- New app icon: a pink sweater on a hanger beside three colour swatches. `icons/source.png` is the new art, cropped so that it fills 0.94 of its square, with its off-white background made pure white; `npm run icons` wrote `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` and `logo.png` again.

## 0.1.11 - 2026-10-25

- Offline mode: **Use offline** on Sign in opens the app with no account (ACC-1, ACC-2, ACC-8, ACC-10). Key `wardrobe.offline` = `1`; an approved session that opens the app removes it. Settings → Account has **Sign in with Google** with no session; Escape closes Sign in over an open app.

## 0.1.10 - 2026-10-25

- Google sign-in and the approval gate of the PocketBase server, as in `pwa-shopping-list` (ACC-1 to ACC-9, `docs/spec/08-account.md`): `src/pocketbase.js`, `src/session.js`, `src/ui/account.js`. The app opens only for a Google account whose `app_access` row of `wardrobe` is `approved`. Nothing syncs. Keys `wardrobe.session` and `wardrobe.oauth` (`sessionStorage`).
- A garment has an optional size, fit and up to 12 measures (`src/measures.js`, the rules of the app Fittings): GAR-8 to GAR-10, WAR-7, WAR-8. The doc goes to version 3; versions 1 and 2 migrate with no size, fit or measures. The shell cache is `wardrobe-shell-v6`.

## 0.1.9 - 2026-10-24

- `app.title` is a translated descriptor, then the brand (`<descriptor> - <short_name>`), so the title follows the language; the static `<title>` and the manifest `name` and `description` hold the fallback text of their `lang`. A test in `tests/i18n.test.js` keeps them in step.

## 0.1.8 - 2026-10-24

- Release notes: `release-notes/<lang>.md`, one file per catalog, released with the version by `npm run release`, which stops when the languages disagree. The app shows the unseen versions in a What's new sheet after an update (`nextSeen`, seen version in storage) and every version from Settings › Help. This file is now the technical record.

## 0.1.7 - 2026-10-24

- The message that shows after an action, with its undo, is a raised card in the colours of the screen. It is no longer a black box in light and a white box in dark.

## 0.1.6 - 2026-10-24

- Settings groups its rows as in the other apps: each preference shows its value, Export and Import
  are rows.

## 0.1.5 - 2026-10-24

- The icon of Settings is a gear, as in the other apps of the family.

## 0.1.4 - 2026-10-24

- The app is now called **Attire**.
- The new look of the family of apps: the Geist font, a stone ground, square corners and green
  for the main action.
- The garment sheet has a head with **Close** and keeps **Save** at the bottom. A drag down of its
  head closes it.
- An empty wardrobe offers **Add garment**; Palettes with no match offers **Show all**.
- The size chips of Palettes keep their text on one line and scroll.

## 0.1.3 - 2026-10-16

- A new app icon, drawn in the style that the family of apps shares.

## 0.1.2 - 2026-10-15

- Chrome now offers to install the app when another app of the same site is installed.
- A garment can have a brand, a link to its shop page and images. Load images reads the page of
  the link and offers its images; keep up to 8 and star the main one.
- The main image shows in the list, the detail and the outfits, also with no connection once
  seen.

## 0.1.1 - 2026-10-15

- Garments with a name, a type, a season and a colour of Sanzo Wada's palette.
- The 348 combinations of *A Dictionary of Color Combinations*, with their outfits.
- The outfits that contain a garment, in its detail.
- The notes demo and the manual order of rows are removed.
