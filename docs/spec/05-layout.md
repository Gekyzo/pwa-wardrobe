# Layout and navigation

Rules of `src/sections.js`, `src/modules.js`, `src/onboarding.js` and the views `nav`, `dust` and
`onboarding` of `src/ui/`.

## Size classes

The size classes, the navigation element, the `pane` layout and the safe areas are the rules
LAY-1 to LAY-5 of the design system (04-design-system), with the one exception of DSV-5: four
width classes, a top bar in place of the rail from 600px, and from 1024px a centred frame.
From 840px the detail of the pane is a card beside the list. In this app the Wardrobe and Combinations sections use the `pane` layout
(LAY-3). Wardrobe uses the variant `single`: its detail shows alone at every width, and with no
garment open there is no detail. From 840px, with no combination open, the detail of
Combinations says `combinations.pick`.

## Navigation

- **NAV-1** The sections are `wardrobe`, `combinations` and `settings`, in the order of
  `SECTIONS`. The navigation shows one item for each section that is on (MOD-1). The current one
  has `aria-current="page"`, and its title is the title of the header.
- **NAV-2** A horizontal slide of at least 60 px that starts in the header or the content, out of
  a row and of a field, goes to the next section (slide left) or the previous one (slide right).
  It stops at the first and the last section. The content comes in from its side.
- **NAV-3** Where a detail shows alone (`detailAlone`: a garment at every width, a combination
  below 840px), a slide to the right of NAV-2 closes it and shows its list again, which comes in
  from the left. A slide to the left still goes to the next section. A slide that starts on the image slider
  (WAR-4) moves the slider only. The **Back** of a detail
  starts with an arrow that lines up with the content edge.
- **NAV-4** Below 600px the navigation is the bottom bar, `--nav-height` (56px) high, with the
  name of each section as text, no icon and no pill; the current one is in `--text` at
  `--weight-book`. Above the title row a top bar of `--topbar-height` shows the wordmark
  (`phone-brand`), and the title row has no rule under it. From 600px it is a top bar of `--topbar-height` above the title
  row (DSV-5).
- **NAV-5** The top bar spans the frame, over a `--line` rule. From start to end it shows the
  wordmark (`app.name` in capitals), the sections as text with no icon, the current one in
  `--text` and the others in `--muted`, and with no session (ACC-10) the text `nav.local` at the
  end.
- **NAV-6** The add of Wardrobe is the button **Add garment** of the header, a text button with
  no icon, at every width: below 600px it is full width under the summary, from 600px at the end
  of the title row. The app has no floating `+`. While the empty state shows its own **Add
  garment**, the header has no add.
- **NAV-7** An open detail of a garment or of a combination has its own entry
  of the history. The **Back** of the phone, also the slide from the edge of the screen, closes the
  detail and shows its list again; it does not close the app. A detail that the app closes leaves
  its entry, so the next **Back** acts as before the detail opened.
- **NAV-8** Under the title of each view the header shows its summary. Wardrobe:
  `wardrobe.summary` with `garments.count`, the count of garments with an image, and
  `combinations.count` of `countOutfits` (OUT-10) under the season filter, each count in its plural, and the
  348 combinations. Palettes: `combinations.summary` with the count of
  combinations that have an outfit under the season filter, of the 348. Settings: the email of
  the account with a session, else `nav.local`. With no garment, Wardrobe and Palettes show no
  summary.

## Modules

- **MOD-1** `MODULES` lists the parts that Settings turns off: `combinations`, which shows the
  Combinations section. With a module off, its sections leave the navigation, and a view of one
  of them goes to the first section that is on.
- **MOD-2** The modules that are off are a preference of the device under `wardrobe.modules`,
  not part of the doc. No module off removes the key.
- **MOD-3** A switch of Modules animates the item of its section: it breaks into dust and its
  place closes, or its place opens and the dust settles (`src/ui/dust.js`). With reduced motion
  the item goes or comes at once.

## Settings

- **SET-1** Settings is a column of groups, each a `list-group-head` above a `list-group` of
  settings rows, as in pwa-shopping-list: **Backup** (**Export**, **Import**, **Delete all data**), **Preferences**
  (**Language**, **Theme**), **Modules** (MOD-1), **App** (INS-2) and **Help** (ONB-3),
  then the version lines (VER-4). **Export** shows `garments.count` with the count of garments. A row of Preferences shows its current value and a chevron, and
  a tap on it opens the native picker of its select. A row that opens something ends with a
  chevron.
- **SET-2** **Account** (`settings.accountHint`), **Backup**, **Preferences** and **Modules**
  (`settings.modulesHint`) have a line of help below their head at every width.
  The groups are rounded cards on `--surface`, under heads of 16px. From 840px Settings is a
  column of at most 1040px (`--settings-max`) at the start of the frame, and each group is a row:
  its head and its help in a column of `--panel-width` at the left, its rows at the right, the
  groups split by a line.
- **SET-3** **Delete all data** is the last row of Backup, in the colour of danger at normal
  weight, with a chevron. It asks `reset.confirm`, or `reset.confirmLocal` with a session, which also says that
  the session closes and that the garments of the account stay on the server. A yes first stops the
  sync (SYNC-10), then removes each `localStorage` key of the app, `wardrobe.*` (`resetAll`),
  and no key of another app of the origin, then loads the page again: the app starts as a new
  install, with the walkthrough (ONB-1), and a device that had a session opens Sign in (ACC-1). It
  has no Undo. When the removal fails, `error.resetFailed` shows and the page stays. The stop of
  the sync has already removed the session, the sync state and the queue, and put the empty doc in
  place, as far as the storage let it (SYNC-10). A key that `resetAll` did not reach stays. The
  caches of the worker stay, the images of the garments (SW-14) too.

## Walkthrough

- **ONB-1** The walkthrough shows at the start of a new install only: no `wardrobe.onboarded`
  flag and no stored doc. A storage that cannot be read counts as seen.
- **ONB-2** It has the pages of `PAGES`, each with a drawing, a title and a text: `welcome` (add a
  garment with its colour), `outfits` (the outfits of the combinations, **Random outfit**),
  `palettes` (Palettes and Missing basics) and `offline` (the use with and with no network, the sync of an account, install). A
  text names each control by its label in the catalog, as a key or in bold (`textParts`). **Next** goes
  forward, **Skip** and Escape close it, a slide or the arrow keys turn a page. The last page has
  **Start** in place of **Next**, and no **Skip**.
- **ONB-3** A close stores the flag. **Show the introduction** in Settings opens it again.
