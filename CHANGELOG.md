# Changelog

Technical changes, newest first. What a user sees of a version goes to `release-notes/`, in each language of the app.

## Unreleased

- **Matching rules** (MAT-1 to MAT-6, OUT-11 to OUT-14, FIL-8, GAR-15, SET-4, WAR-3 to WAR-5, PAL-6): four optional rules over the Wada outfits, all off by default. New pure module `src/matching.js` with `tests/matching.test.js`; `lchOf` in `src/palette.js`. `outfitsFor`, `outfitsWith`, `countOutfits`, `randomOutfit`, `missingBasics` and `fillSuggestions` take the option `match`: formality drops sets that span more than one level, a contrast band ranks its outfits after the exact ones, neutral completion adds the nearest neutral shoes (and outer under `cold`) after the `MAX_OUTFITS` cut, and a colour type drops the Fill rows whose colour does not suit it. Each outfit carries `contrast`. New device key `wardrobe.matching` (`loadMatching`, `saveMatching`), `matching` and `setMatching` in `ui/context.js`; the caches of `ui/outfit`, `ui/fill` and `ui/wardrobe` key on it. New optional garment field `formality` (`FORMALITIES`, `error.formalityInvalid`), doc still version 4; a device on an older version drops the field on its next save. New Settings group **Matching**, select `#garment-formality`, part `look-added`, keys `settings.matching*`, `matching.*`, `outfit.contrast.*`, `outfit.neutral`, `wardrobe.formality`, `formality.*`.
- **Palette families** (FAM-1 to FAM-6, OUT-15, FIL-9, CMB-5, SET-5, NAV-8): Sanzo Wada becomes one of seven families. New pure module `src/families.js` with `tests/families.test.js`: `FAMILIES`, `FAMILY_MAX` (25), `familyOf`, `switchFamily`, `activeFamily`. Complementary, analogous, triadic, split-complementary, neutral and accent, and monochrome sets are built once from the 159 colours (54, 100, 60, 60, 103 and 89 sets). Every outfit function, `missingBasics` and `fillSuggestions` take the option `family` (default `wada`). New device keys `wardrobe.family` and `wardrobe.families` (`loadFamily`, `saveFamily`, `loadFamiliesOff`, `saveFamiliesOff`); `family`, `familiesOff`, `setFamily`, `setFamiliesOff` in `ui/context.js`, and every view cache keys on the family. New `select#family` (component `family-pick`) in Combinations, Settings group **Palette families**, keys `family.*`, `settings.families*`, `settings.familyInUse`, `combinations.family`; `fill.wadaName` becomes `fill.setName`, the Fill row `kind` `wada` becomes `set` and the `fill-tag` state `wada` becomes `set`. `wardrobe.summary` and `combinations.summary` take `{family}`.

## 0.1.23 - 2026-11-01

- **Fill tab** (FIL-1 to FIL-7, NAV-1, NAV-8, MOD-1): new section `fill` between `wardrobe` and `combinations` in `SECTIONS`, and the module `fill` in `MODULES`. New pure module `src/fill.js` (`MAX_FILL`, `fillSuggestions`) with `tests/fill.test.js`: one ranked list of the missing basics and of Sanzo Wada colours in a slot that complete open palettes. `completes` searches each open palette with the candidate added, since `outfitsWith` stops at `MAX_OUTFITS`; only the gap of a palette one colour short is a candidate, and a palette the candidate cannot close is not searched (60 garments: 81 ms → 40 ms in Node). New view `src/ui/fill.js` (`fillNow`, `renderFill`), `openNewGarment` exported from `src/ui/wardrobe.js`, component `fill` and token `--strip-small` in `styles.css`, keys `nav.fill` and `fill.*`.
- **Missing basics panel removed** (WAR-1, WAR-9, WAR-10, ONB-2): `#basics-panel` leaves `#wardrobe-side`, with `basicsNow`, `basicItem`, `basicsPanel` and `gainText` of `src/ui/wardrobe.js` and the keys `wardrobe.basics`, `wardrobe.basicsHint`, `wardrobe.basicGain`, `wardrobe.basicGainMax`. The `basics-panel` component keeps only its row parts, which the Fill tab uses. `onboarding.palettes.text` names Rellenar / Fill.

## 0.1.22 - 2026-11-01

- **Brand suggestions** (WAR-3): the brand field no longer uses `<datalist id="garment-brands">`. Desktop and Android Chrome showed no popup for a datalist whose options change on each `input`, which `5762aea` brought in. `#garment-brands` is now a `ul.list-group.plain.brand-suggestions` (`role="listbox"`, the field is a `combobox`), filled by `showBrands` in `src/ui/wardrobe.js` with at most 5 rows of `suggestBrands`. A tap picks a brand; `Escape`, a blur or an exact match hides the list. New component `brand-suggestions` in `styles.css`.

## 0.1.21 - 2026-11-01

- **Garment shapes** (GAR-14, WAR-1, WAR-4): a garment with no image, or whose image fails to load, shows the drawing of its shape filled with its colour in place of a flat colour field, except under **Colour**. `shapeOf` and `SHAPES` in `src/garments.js` read the shape from the name within the slot (Spanish and English words, slot default otherwise); 14 symbols `shape-*` (48×48) in `icons.svg`, drawn by `picture()` through `icon(..., 'garment-shape')`; `ui/outfit` now imports `ui/controls`.
- **Photos or Colour** (WAR-11, WAR-1, WAR-9, DSV-3): a `segmented wardrobe-cards` switch over the wardrobe grid. **Colour** passes `null` as the url of `picture()` in the cards and, through the new `colorOnly` option of `look()` and `outfitList()`, in the random look. The choice is the device preference `wardrobe.cards` (`CARDS_KEY`, `loadCards`, `saveCards` in `src/storage.js`; `cards` and `setCards` in `ui/context.js`). New token `--cards-switch-width`, new keys `wardrobe.cardsShow`, `wardrobe.cardsPhotos`, `wardrobe.cardsColor`.
- **Walkthrough** (ONB-2): `PAGES` is `welcome`, `outfits`, `palettes`, `offline`, with the new keys `onboarding.outfits.*` and `onboarding.palettes.*` and two new drawings in `#onboarding`. The texts named controls that are gone (the floating `+`, the slide to delete, removed in 0.1.19 and 0.1.20); they now name `Add garment`, `Another`, `Palettes` and Missing basics, and the last page (`offline`, now titled Online or offline) names the offline use, `Sign in with Google` and its sync, and the install; its drawing is two devices that sync in place of a crossed-out signal. `wardrobe.empty` no longer says "Tap +". The dead `onboarding-switch` rules of the sample-data switch are removed from `styles.css`.
- **New icon**: `icons/source.png` is a flat mark for the Blanco look: three lengths of fabric in the Wada colours Deep Lyons Blue, Yellow Ocher and Ivory Buff on an ink rail, in place of the 3D magenta hanger. The source is cropped so the art fills 0.88 of its square, which keeps its corners inside the maskable safe circle (radius 0.389 at the scale 0.64 of `make-icons.mjs`). `npm run icons` wrote `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` and `logo.png` again.
- **Missing basics** (BAS-1 to BAS-4, WAR-1, WAR-9, WAR-10): new pure module `src/basics.js` (`BASICS`, `MAX_BASICS`, `covers`, `missingBasics`), in `SHELL` and the import map, with `tests/basics.test.js`. `#wardrobe-side` holds `#random-panel` and the new `#basics-panel` after the grid or the empty state, and is the sticky column from 1024px (the sticky rule moved from `random-panel`). A row calls `openSheet(null, fill)` of `src/ui/wardrobe.js`, which fills the name, slot, season and colour of a new garment. New keys `basic.*`, `wardrobe.basics`, `wardrobe.basicsHint`, `wardrobe.basicGain`, `wardrobe.basicGainMax`.

## 0.1.20 - 2026-11-01

- **Image slider** (WAR-4, NAV-3): `media()` of `src/ui/wardrobe.js` makes an `image-slider` (a scroll-snap track of hero pictures, arrows from 600px) in place of `image-strip`, and `colorBand` ends with `image-slider-count` (`wardrobe.imageCount`). New keys `wardrobe.prevImage`, `wardrobe.nextImage`. A slide that starts on the track no longer closes the detail. The strip and its broken-thumb hiding are gone; a broken slide shows the colour field.
- **No floating +, no Hand** (NAV-4, NAV-6, SET-1): `#header-add` shows at every width, full width in a column title row below 600px; `#fab` is gone. The Hand preference is removed: `HAND_KEY`/`loadHand`/`saveHand` of `src/storage.js`, `hand`/`setHand` of `src/ui/context.js`, the `#hand` row, the keys `settings.hand*`, the `[data-hand="left"]` rule and their tests; `settings.preferencesHint` now names the language and the colours. A stored `wardrobe.hand` key is left unread.
- **Blanco phone shell and Settings** (NAV-4, SET-1 to SET-3): new `phone-brand` (the wordmark bar below 600px); the bottom bar hides its icons and pill, `--nav-height: 56px`; the phone title row has no rule. Settings: `settings.accountHint` and `settings.modulesHint`, `#export-count` written by `renderSettings` of `src/ui/settings.js`, a chevron on `#reset` at normal weight.
- **Blanco compact filters** (WAR-5, CMB-2): `--chip-compact: 36px`; the chips of `season-filter` and `size-filter` keep the tap height and draw their outline and ink fill in a `::before` 36px high, at `--text-s`, the season chips 4px apart. `renderOutfits` takes `{ inline }`: the Palettes detail puts the filter in the head and drops the count. New `wearable-switch`: the switch row of Combinations out of its `list-group`.
- **Blanco neutral details** (DSV-3, WAR-4): `--done: var(--ink)` and `--done-soft: var(--surface-2)`; an `@extends switch` puts the knob in `--on-ink`; the fit fact is text (`fitPill` removed); Delete is underlined. Fix: the look variant of `garment-picture` was the class `look`, which also matched the `.look` card (padding, radius, surface); it is now `worn`.
- **Blanco frame and header** (DSV-5, NAV-6, NAV-8, WAR-1, WAR-4): `--frame-max: 1200px`; the subtitle at `--text-m` with `--title-row-space` under the title row; `wardrobe.summary` takes `total`; `#header-add` is text only (the `plus` symbol is gone from `icons.svg`); `renderHeader` hides `.app-header` while a garment is open; grid gaps 24/16 from 1024px; section heads at `--section-title`; the current top-bar link is not bold.
- **Season filter** (WAR-5): `seasonFilter()` of `src/ui/outfit.js` is a `cluster season-filter` group (`role="group"`, label `wardrobe.season`) of outline `chip`s, the pressed one ink, as the size filter. It replaces the `segmented` switch, whose knob was wider than its label in the 360px random panel head; there it has no margin and wraps under the title.
- **Long names and broken thumbs** (WAR-4, WAR-5): `.look-name`, `.garment-card-name` and `.garment-detail-title` take `overflow-wrap: anywhere`, so a long one-word name stays in its column at 360px. `media()` of `src/ui/wardrobe.js` hides an image-strip thumb whose image fails, as the sheet does (WAR-6).
- **Outfit count in the details** (WAR-5): `renderOutfits` of `src/ui/outfit.js` writes an `outfits-head` of the title and an `outfits-count` (`countKey`, only with one outfit or more), as the gallery shows.
- **Cleanup** (OUT-10, DSV-3): `outfitsOf` moves from `src/ui/combinations.js` to `src/ui/outfit.js`, and `subtitle()` of `src/app.js` reads it (and `countOutfits` gets an `of` option), so the header no longer computes the 348 combinations at each render. Removed the dead `@extends item-row` block and the `swatch large` variant. New tokens `--screen-title-leading` and `--wordmark-track` replace raw values. `picture()` makes a `span`, not a `figure`, which a `button` may not hold.

## 0.1.19 - 2026-11-01

- **Ink primary**: `styles.css` drops the `--primary: var(--done)` override, so the main action takes the ink of the design system; `--done` keeps progress and the checked state. New app tokens for the catalogue look (`--screen-title*`, `--photo-ground`, `--grid-gap*`, `--panel-width`, `--band-pad`, `--field-*`, `--strip-height`, `--topbar-height`, `--wordmark`).
- **Top bar** (NAV-4, NAV-5, NAV-8, DSV-5): from 600px `styles.css` has versions of `nav-bar` (a top bar of `--topbar-height`: wordmark, text links, `nav.local` foot) and `app-header` (the title row at `--screen-title`). `--rail-width` is `--frame-side`, so the body pads the frame on both sides; `--page-max` is 100% from 600px. `renderHeader` of `src/app.js` writes the summary: `wardrobe.summary` (with `countOutfits`), `combinations.summary`, or the account email / `nav.local`. `sessionNow` of `src/ui/account.js` is exported.
- **Swipe-to-delete removed** (WAR-2): `src/swipe.js`, `tests/swipe.test.js`, the `#swipe` import-map line, its `SHELL` line, `bindSwipe`/`moveRow` and the row side action of `src/ui/wardrobe.js`, `SIDE_BUTTON`/`DRAG_START`/`openId`/`settleFrom` of `src/ui/context.js`, `iconButton` of `src/ui/controls.js`, and the key `row.delete`. Delete stays in the detail with the Undo toast.
- **Wardrobe grid** (WAR-1, WAR-4, WAR-9, NAV-3, NAV-7, LAY-3): `#garment-groups` holds a `garment-groups` section per slot with `garment-card`s; `picture()` of `src/ui/outfit.js` gives the main image or a Wada colour field, also on an image error. Card counts use `outfitsWith`, cached per doc and season, and `countKey` of `src/outfits.js`. `#random-panel` replaces the Random outfit button and detail: it picks on the first render, has no history entry, and stands beside the grid from 1024px. Wardrobe is `pane single`: the garment detail shows alone at every width, and `detailAlone` of `src/sections.js` lets a slide right close it at every width. Removed: `#wardrobe-random`, `#random-outfit`, `#garment-detail-empty`, the key `wardrobe.pick`, the `random-open` CSS and the `shuffle` icon.
- **Garment detail and looks** (WAR-4, WAR-5): `#garment-media` holds `picture(g, "hero", shown)`, `colorBand` (name and hex, `data-ink` from `inkOn`) and the image strip; `#garment-info` the name at `--screen-title`, slot · brand · season and `garment-facts` as a 2-column grid with the size first. Edit is primary, Delete a quiet danger button; Back reads `nav.wardrobe`. From 1024px the detail is a 7fr/5fr grid with sticky media. `look()` replaces the outfit card (picture, name, colour); removed `thumb()` and the `thumb` and `outfit` CSS.
- **Palettes** (CMB-1, CMB-3): rows are `combo-row` buttons (number, a `strip` of `--strip-height`, `countKey` count; `aria-current` on the open one); the detail head is `combo-head`; `colorFields` replaces `blocks` (removed, with `detail-head`). `#combinations` is `pane wide`: 5fr/7fr from 840px, the detail on the page. The size chips are outline. New test in `tests/aliases.test.js`: each named import of a module of src is an export of its target (the views have no DOM test).
- **Settings** (SET-2, INS-2): groups are rounded `--surface` cards with 16px heads and page margins at every width; from 840px a column of `--settings-max` (now 1040px) at the start of the frame, the head column `--panel-width`, gap `--detail-gap`. `#install` is a `button primary` inside a settings row.
- **Review fixes**: `wardrobe.summary` takes `garments.count` and `combinations.count`, so "1 conjunto" is singular (NAV-8); `picture()` hides the card and look pictures from screen readers (`aria-hidden`, empty alt), and only the hero keeps the name label (WAR-1).

## 0.1.18 - 2026-10-31

- **Back closes a detail** (NAV-7): an open detail of a garment, of the random outfit or of a combination pushes a history entry `{ detail: true }`, so the Back of Android, also its slide from the edge, fires `popstate` and closes the detail instead of the app. `syncHistory` of `src/ui/nav.js` runs at the end of each render; a detail that the app closes leaves its entry with `history.back()`. `historyStep` of `src/sections.js` decides the step.

## 0.1.17 - 2026-10-31

- What's new renders bold text (VER-22): `textParts` of `src/onboarding.js` also reads a paired `**…**` as parts with `strong: true`, keys inside it too; a `**` with no pair stays as text. `noteNode` of `src/ui/whatsnew.js` puts such a part in a `<strong>`.

## 0.1.16 - 2026-10-31

- **Reference** (GAR-13, WAR-3, WAR-4): an optional `reference` of the garment, the code of the product in the shop, trimmed, at most `MAX_REFERENCE` (40) characters, else `error.referenceTooLong`. The doc stays version 4: a garment with no reference reads as `''`. It syncs as part of the record data. Field `garment-reference` of the sheet; a fact of the detail. Key `wardrobe.reference`.
- **Colour code** (PAL-4, WAR-3): `parseColor` of `src/palette.js` reads `#rgb`, `#rrggbb`, `rgb()`/`rgba()` (0-255 or percentages) and `hsl()`/`hsla()` as `#rrggbb`; the field `garment-color-text` of the sheet takes the nearest palette colour, marks an unreadable code `aria-invalid`, and empties on a pick or a swatch. Key `wardrobe.colorCode`.
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
