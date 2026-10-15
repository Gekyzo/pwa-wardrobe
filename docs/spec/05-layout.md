# Layout and navigation

Rules of `styles.css` for the size classes, `src/sections.js`, `src/modules.js`,
`src/onboarding.js` and the views `nav`, `dust` and `onboarding` of `src/ui/`.

## Size classes

- **LAY-1** The layout follows the Material window size classes:

  | Class | Width | Navigation | Content |
  |---|---|---|---|
  | compact | below 600px | bottom bar | full width |
  | medium | 600px to 839px | rail at the start side | one column, at most `--content-max`, centred |
  | expanded | 840px and up | rail at the start side | the `pane` layout: list and detail side by side |

- **LAY-2** The navigation is one element, `.nav-bar`. Below 600px it is the bar at the bottom;
  from 600px the same element is a rail of `--rail-width` at the start side, and the page, the
  toast and the add button move beside it.
- **LAY-3** A section with a list and a detail uses the `pane` layout. Below 840px it shows the
  list, or the detail alone while an entry is open, with a **Back** button (`pane-back`). From
  840px it shows both; with no entry open the detail says `wardrobe.pick` or `combinations.pick`, and **Back** is hidden.
- **LAY-4** The safe-area insets of the phone pad the header (top), the bar (bottom), the rail
  (start side), the sheets and the walkthrough. The page keeps out of a cutout on either side,
  and so do the toast and the add button, which are fixed.

## Navigation

- **NAV-1** The sections are `wardrobe` and `settings`, in the order of `SECTIONS`. The navigation
  shows one item for each section that is on (MOD-1). The current one has
  `aria-current="page"`, and its title is the title of the header.
- **NAV-2** A horizontal slide of at least 60 px that starts in the header or the content, out of
  a row and of a field, goes to the next section (slide left) or the previous one (slide right).
  It stops at the first and the last section. The content comes in from its side.

## Modules

- **MOD-1** `MODULES` lists the parts that Settings turns off: `combinations`, which shows the
  Combinations section. With a module off, its sections leave the navigation, and a view of one
  of them goes to the first section that is on.
- **MOD-2** The modules that are off are a preference of the device under `wardrobe.modules`,
  not part of the doc. No module off removes the key.
- **MOD-3** A switch of Modules animates the item of its section: it breaks into dust and its
  place closes, or its place opens and the dust settles (`src/ui/dust.js`). With reduced motion
  the item goes or comes at once.

## Walkthrough

- **ONB-1** The walkthrough shows at the start of a new install only: no `wardrobe.onboarded`
  flag and no stored doc. A storage that cannot be read counts as seen.
- **ONB-2** It has the pages of `PAGES`, each with a drawing, a title and a text. **Next** goes
  forward, **Skip** and Escape close it, a slide or the arrow keys turn a page. The last page has
  **Start** in place of **Next**, and no **Skip**.
- **ONB-3** A close stores the flag. **Show the introduction** in Settings opens it again.
