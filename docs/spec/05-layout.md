# Layout and navigation

Rules of `src/sections.js`, `src/modules.js`, `src/onboarding.js` and the views `nav`, `dust` and
`onboarding` of `src/ui/`.

## Size classes

The size classes, the navigation element, the `pane` layout and the safe areas are the rules
LAY-1 to LAY-5 of the design system (04-design-system, DSV-5): four width classes, the rail at
the start with either hand from 600px, and from 1024px a centred frame with a labelled sidebar.
From 840px the detail of the pane is a card beside the list. In this app the Wardrobe and Combinations sections use the `pane` layout
(LAY-3). From 840px, with no entry open, the detail says `wardrobe.pick` or `combinations.pick`.

## Navigation

- **NAV-1** The sections are `wardrobe`, `combinations` and `settings`, in the order of
  `SECTIONS`. The navigation shows one item for each section that is on (MOD-1). The current one
  has `aria-current="page"`, and its title is the title of the header.
- **NAV-2** A horizontal slide of at least 60 px that starts in the header or the content, out of
  a row and of a field, goes to the next section (slide left) or the previous one (slide right).
  It stops at the first and the last section. The content comes in from its side.
- **NAV-3** Below 840px, where a detail shows alone (LAY-3), a slide to the right of NAV-2 closes
  the detail of a garment or of a combination and shows its list again, which comes in from the
  left. A slide to the left still goes to the next section. The **Back** of a detail starts with
  an arrow that lines up with the content edge.

- **NAV-4** Below 600px the navigation is the bottom bar. From 600px it is a rail at the left with
  **Right** and with **Left** (DSV-5). **Left** still puts the `+` of a phone at the left and the
  buttons of the header before its text.
- **NAV-5** From 1024px the rail is a sidebar of 232px at the left of a centred frame of at most
  1280px. It shows the mark and the name of the app (`app.name`) above the sections, one row for
  each section with its icon and its name, and the current section on a pill. With no session
  (ACC-10) the foot of the rail shows the offline icon, and from 1024px the text `nav.local`.
- **NAV-6** Below 600px the add of Wardrobe is the floating `+`. From 600px it is the button
  **Add garment** of the header, with the same conditions, and the `+` does not float. While the
  empty state shows its own **Add garment**, the header has no add.

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
  (**Language**, **Hand**, **Theme**), **Modules** (MOD-1), **App** (INS-2) and **Help** (ONB-3),
  then the version lines (VER-4). A row of Preferences shows its current value and a chevron, and
  a tap on it opens the native picker of its select. A row that opens something ends with a
  chevron.
- **SET-2** **Backup** and **Preferences** have a line of help below their head at every width.
  From 840px Settings takes a column of at most 960px (`--page-max`, LAY-1), and each group is a
  row: its head and its help at the left, its rows at the right, the groups split by a line.
- **SET-3** **Delete all data** is the last row of Backup, in the colour of danger, with no
  chevron. It asks `reset.confirm`, or `reset.confirmLocal` with a session, which also says that
  the session closes. A yes removes each `localStorage` key of the app, `wardrobe.*` (`resetAll`),
  and no key of another app of the origin, then loads the page again: the app starts as a new
  install, with the walkthrough (ONB-1), and a device that had a session opens Sign in (ACC-1). It
  has no Undo. When the removal fails, `error.resetFailed` shows and nothing else changes. The
  caches of the worker stay, the images of the garments (SW-14) too.

## Walkthrough

- **ONB-1** The walkthrough shows at the start of a new install only: no `wardrobe.onboarded`
  flag and no stored doc. A storage that cannot be read counts as seen.
- **ONB-2** It has the pages of `PAGES`, each with a drawing, a title and a text. **Next** goes
  forward, **Skip** and Escape close it, a slide or the arrow keys turn a page. The last page has
  **Start** in place of **Next**, and no **Skip**.
- **ONB-3** A close stores the flag. **Show the introduction** in Settings opens it again.
