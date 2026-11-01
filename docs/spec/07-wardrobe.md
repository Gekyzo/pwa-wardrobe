# Wardrobe

The domain of the app: garments with a colour of the palette of *A Dictionary of Color
Combinations* (Sanzo Wada, 1933), the combinations of the book, and the outfits that a wardrobe
gives for them. Its files are `src/wada.js`, `src/palette.js`, `src/garments.js`, `src/links.js`,
`src/outfits.js`, `tests/palette.test.js`, `tests/garments.test.js`, `tests/links.test.js`,
`tests/outfits.test.js`, the views
`src/ui/wardrobe.js`, `src/ui/outfit.js` and `src/ui/combinations.js`, the `#wardrobe` and
`#combinations` sections and the `#garment-sheet` of `index.html`.

## Palette

- **PAL-1** The palette is `COLORS` of `src/wada.js`: 159 colours `{ id, name, hex, combinations }`,
  from `colors.json` of `mattdesl/dictionary-of-colour-combinations` (MIT). `id` is the index of
  the colour in that file. The combinations are numbered 1 to 348, each of 2, 3 or 4 colours, in
  the order of the file.
- **PAL-2** The colour names are proper names of the book. They stay in English in `src/wada.js`
  as data, not as text of the catalogs; this is the one exception to the rule that every text for
  the user is in `src/locales/`.
- **PAL-3** The distance of two colours is CIE76 ΔE over CIELAB with a D65 white, computed from
  the `hex` of each colour. `nearestColor` takes a `#rrggbb` value in any case and gives the id of
  the palette colour with the smallest distance; any other value gives null.
- **PAL-4** `parseColor` reads a colour text as `#rrggbb`: `#rgb` and `#rrggbb` in any case,
  `rgb()` or `rgba()` with three values from 0 to 255 or three percentages, and `hsl()` or `hsla()`
  with a hue in degrees and two percentages from 0 to 100. Commas or spaces separate the values,
  and an alpha is read and ignored. Any other text gives null.
- **PAL-5** `inkOn` gives the text colour on a field of a colour: `dark` when the WCAG relative
  luminance of its hex is above 0.18, else `light`.

## Garments

- **GAR-1** The doc is
  `{ version: 4, garments: [{ id, name, slot, season, color, brand, reference, link, images, size, fit, measures, buy_date, price, creation_date }] }`,
  newest garment first, stored as JSON under `wardrobe.garments`. A stored doc that is not valid is kept
  under `wardrobe.garments.corrupt`, and the app starts with no garments.
- **GAR-2** `slot` is one of `top`, `bottom`, `outer`, `shoes`, `accessory`. `season` is one of
  `all`, `warm`, `cold`. `color` is the `id` of a palette colour. `brand` is a text, `link` is
  `''` or an `http` or `https` URL, and `images` is a list of `http` or `https` URLs.
- **GAR-3** `addGarment` puts a garment first; `editGarment` changes the fields of one garment.
  The name is trimmed; a blank name is `error.nameRequired`, a name of more than 60 characters is
  `error.nameTooLong`. Another slot is `error.slotInvalid`, another season is
  `error.seasonInvalid`, and a colour that is not an integer from 0 to 158 is
  `error.colorInvalid`. The brand, the link and the images are optional: a missing one is `''`,
  `''` or `[]`. The brand and the link are trimmed. A brand of more than 40 characters is
  `error.brandTooLong`. A link that is not an `http` or `https` URL of at most 2000 characters is
  `error.linkInvalid`. More than 8 images, an image that is not such a URL, or one image two
  times is `error.imagesInvalid`.
- **GAR-4** `deleteGarment` removes one garment. An id that is not in the doc is
  `error.garmentMissing`, and nothing changes.
- **GAR-5** `normalizeGarments` accepts a doc of version 1, 2, 3 or 4 whose garments have a
  non-empty id, no id two times, and fields that pass GAR-3 and GAR-12. It trims each name and
  drops unknown fields. It gives version 4: a garment of version 1 gets an empty brand, link and
  images, a garment of version 1 or 2 gets no size, no fit and no measures, and a garment of
  version 1, 2 or 3 gets no buy date, no price and an unknown creation date `''`. A new version
  adds its migration here.
- **GAR-6** `brandsOf` gives the brands of the garments, each one time, sorted. Two brands that
  differ only in case are one brand, with the spelling of the first garment.
- **GAR-7** The main image of a garment is its first image. A garment with no image has no main
  image.
- **GAR-8** The size, the fit and the measures of a garment are optional (`checkSizing` of
  `src/measures.js`, which GAR-3 applies). `size` is a text of at most 20 characters, `''` when it
  is not given; a longer one is `error.sizeTooLong`. `fit` is `''` (not said), `good`, `small` or
  `large`; another one is `error.fitInvalid`. `measures` is a list of at most 12
  `{ name, value, unit }`: `name` a text of 1 to 30 characters, `value` a finite number above 0,
  `unit` a text of at most 10, `''` when it is not given. The texts are trimmed. A measures value
  that is not a list of objects is `error.measuresInvalid`. A line with no value is dropped, with
  or without a name. More than 12 lines is `error.measuresFull`, a line with a value and no name
  is `error.measureNameRequired`, a name over 30 characters is `error.measureNameTooLong`, a value
  that GAR-9 refuses is `error.measureValueInvalid`, and a unit over 10 characters is
  `error.unitTooLong`.
- **GAR-9** `parseValue` takes a number, or a text of digits with one point or one comma as the
  decimal mark, and gives the number when it is above 0, else null.
- **GAR-10** `measuresOf` gives the `{ name, unit }` of the measures of the garments of one slot,
  newest garment first, each name one time, case aside.
- **GAR-11** `suggestBrands` gives the brands that start with a text, with case and accents
  aside: the brands of the wardrobe (GAR-6) first, then the brands of the seed list `BRANDS` of
  `src/brands.js` that the wardrobe does not hold, case and accents aside. An empty text gives
  no brand.
- **GAR-12** The buy date and the price of a garment are optional. `buy_date` is `''` or a
  calendar date `YYYY-MM-DD`; another value is `error.buyDateInvalid`. `price` is `null` or a
  number greater than 0 and at most 1 000 000, rounded to two decimals; a text with a point or a
  comma is read as GAR-9, and another value is `error.priceInvalid`. `creation_date` is the
  instant (`toISOString`) when `addGarment` added the garment; `editGarment` keeps it, and it is
  `''` for a garment of an earlier version (GAR-5).
- **GAR-13** The reference is the code of the product in the shop, such as `1234/567/800`. It is
  optional: a missing one is `''`. It is trimmed, and a reference of more than 40 characters or
  that is not a text is `error.referenceTooLong`. A doc of version 4 with no reference gets `''`
  (GAR-5): the version does not change.

## Links

- **LNK-1** `loadPageImages` reads the page of a link through the public proxy Jina Reader,
  `https://r.jina.ai/` followed by the link, with the header `X-Return-Format: html`, and stops
  after 20 seconds. The browser cannot read the page of another origin directly. The proxy runs
  the scripts of the page and gives the rendered HTML. It sees each link that the app loads. A
  shop that refuses robots gives no page.
- **LNK-2** `imagesOfPage` gives the images of a page in this order: the `og:image` and
  `twitter:image` meta, the `image` of a `Product` in `application/ld+json` (also inside
  `@graph`), then one image for each `<img>`: the widest of its `srcset`, else its `data-src`,
  else its `src`. Each URL is resolved against the link. It keeps only `http` and `https` URLs,
  and drops `.svg` files and paths that contain `logo`, `icon`, `sprite`, `pixel`,
  `placeholder`, `chip` or `swatch`. Two URLs of one path, with another query, are one image: the
  first is kept. At most 24 are given.
- **LNK-3** A link that is not an `http` or `https` URL, a failed request, a status that is not
  OK, or a page with no image gives `error.linkFailed`. `loadPageImages` never throws.

## Outfits

- **OUT-1** `MATCH_MAX` is 10, `MAX_OUTFITS` is 20 and `MAX_CANDIDATES` is 8.
- **OUT-2** A garment matches a colour of a combination when the distance of their colours
  (PAL-3) is at most `MATCH_MAX`.
- **OUT-3** An outfit of a combination of `k` colours has `k` garments: a different garment for
  each colour, in the order of the colours.
- **OUT-4** No two garments of an outfit share a slot, except `accessory`. An outfit holds a
  `top` and a `bottom`.
- **OUT-5** The score of an outfit is the sum of its distances; it is exact when each distance
  is 0. The outfits are sorted exact first, then by score, then by combination and garment ids.
  One set of garments for one combination is listed once. At most `MAX_OUTFITS` are given.
- **OUT-6** Each colour keeps at most `MAX_CANDIDATES` garments, so that a search stays short in a
  wardrobe with many garments of one colour: first the nearest garment of each slot, then the
  nearest of the others. Many garments of one slot hide no garment of another slot.
- **OUT-7** The season filter is `any`, `warm` or `cold`. A garment fits it when the filter is
  `any`, the season of the garment is `all`, or the two are equal.
- **OUT-8** `outfitsWith` gives the outfits that contain one garment: over each combination of a
  colour near it, the garment takes each place that it matches, out of the candidate cap, and the
  other places are searched among the other garments.
- **OUT-9** `randomOutfit` takes one outfit at random from the outfits of every combination
  (OUT-5) under the season filter, or gives null when there is none. `except` is the key of an
  outfit (`outfitKey`: its combination and its garment ids); that outfit is not taken while
  another one is in the pool.
- **OUT-10** `countOutfits` gives the number of outfits of the wardrobe under the season filter:
  the sum of the outfits of each combination (OUT-5), so each combination counts at most
  `MAX_OUTFITS`. Its option `of` reads the outfits of one combination in place of `outfitsFor`;
  the header and Combinations give `outfitsOf` of `src/ui/outfit.js`, which computes the
  outfits of each combination once for each doc and season filter.

## Basics

- **BAS-1** `BASICS` of `src/basics.js` is the seed list of the basics of a wardrobe, the most
  needed first: `{ id, slot, season, color }`, with a slot and a season of GAR-2 and the id of a
  palette colour. The name of a basic is the catalog key `basic.<id>`. `MAX_BASICS` is 4.
- **BAS-2** A garment covers a basic when it has the slot of the basic, the distance of their
  colours (PAL-3) is at most `MATCH_MAX`, and their seasons overlap: they are equal, or one of
  them is `all`.
- **BAS-3** `missingBasics` gives the basics that no garment of the wardrobe covers, at most
  `MAX_BASICS` (option `max`).
- **BAS-4** The gain of a missing basic is the count of `outfitsWith` (OUT-8) of the basic as a
  garment of the wardrobe, under the season filter (option `season`). The basics with the higher
  gain come first, then the order of `BASICS`.

## Wardrobe section

- **WAR-1** The Wardrobe section shows the garments as a grid of cards, grouped by slot in the
  order of `SLOTS`, then by name. Each group has a head with the slot name and `garments.count`.
  The grid has 2 columns, 4 from 600px, with gaps of 20px by 12px, 24px by 16px from 1024px. A card is one button that opens the detail: the picture
  of the garment, 3:4, with square corners; the name; a dot of the colour and its name; and the
  brand, `wardrobe.sizeShort` with the size, and the count of `outfitsWith` under the season
  filter (`countKey`: `combinations.countMax` at `MAX_OUTFITS`, else `combinations.count`, so 0
  reads "0 conjuntos"), each one if it has one. The counts are cached for each doc and season
  filter. The picture is the main image (GAR-7), contained on `--photo-ground`; a garment with no
  image, or whose image fails to load, shows a field of its colour. In a card and in a look the
  picture is hidden from a screen reader, since the name and the colour stand beside it as text;
  the picture of the detail has the alt text of the name, or as a field `role="img"` and the label
  "name, colour name". With no garment the section shows `wardrobe.empty` and **Add
  garment**, which opens the sheet of WAR-3, and the basics of WAR-10.
- **WAR-2** **Delete** is in the detail of a garment (WAR-4, GAR-4); the toast
  `toast.garmentDeleted` offers **Undo** for 5 seconds. A doc that the sync puts in place hides an open **Undo** (SYNC-2).
- **WAR-3** **+** opens the sheet of a new garment. Its head has the title and **Close**, its foot
  **Save**; **Close**, a tap on the veil or a drag down of the head closes it with no save. The
  sheet holds the name, the brand, the reference (GAR-13), the slot, the season,
  the colour, the link, the images, under `wardrobe.purchase` the buy date, which is not after
  today and is today for a new garment, and the price in euros (GAR-12) and, under `wardrobe.sizing`, the size, the fit (GAR-8) as one segmented control
  in one line, each segment an icon over its name, the measure lines, each with a name, a value, a unit and a button that removes it, and
  **Add measure**. The measure name suggests the names in use, and the unit the units in use, then
  `cm`, `mm`, `in`, `EU`, `US` and `UK`. A value shows in the number format of the language. The brand field suggests no brand while it is empty, and
  the brands of GAR-11 for its text. The colour input of the phone takes the nearest palette colour (PAL-3); so does a colour code typed as `#hex`, `rgb()` or
  `hsl()` (PAL-4), and a code that is not a colour marks its field invalid; a tap on a
  swatch of the grid of the 159 colours takes that colour. The sheet shows the name of the chosen
  colour, or `wardrobe.colorNone`. A new garment starts with no colour, and **Save** without one
  is `error.colorInvalid`.
- **WAR-4** A tap on a card opens its detail, which shows alone at every width, in place of the
  grid and the panel (LAY-3, `pane single`), and with no title row. **Back** reads `nav.wardrobe`. The media: the
  picture of the garment, 4:5 (WAR-1), with the image shown large; under it a band of its colour
  with the colour name and its hex, in dark or light text (`inkOn`, PAL-5). With two or more
  images the picture is a slider of all of them, one at a time: a swipe, or from 600px an arrow
  that shows on hover or focus, shows the one before or after, and the band ends with
  `wardrobe.imageCount` ("2 / 3"). An image that does not load shows the colour field (WAR-1).
  The shown image stays while the detail is open. The info: the name at
  `--screen-title`, a line of slot, brand and season, then the facts in two columns, each a label
  over its value as plain text: the size, the reference, the fit, each measure, the price in euros, the buy
  date and `wardrobe.added` with the creation date, in the formats of the language, each one only
  when it is set. Then **Edit** (primary), **Open link** (outline) when the garment has a link,
  which opens it in a new tab, and **Delete** (an underlined danger text button), and the outfits that
  contain it (OUT-8) under the season filter, or `wardrobe.noOutfits`. From 1024px the media and
  the rest are two columns, 7 to 5, and the media stays in sight; below, they stack.
- **WAR-5** An outfit is a look on a `--surface` card: `outfit.number` and `outfit.exact` for an
  exact outfit, then its garments side by side, each with its picture (WAR-1, 3:4), its name and
  a dot of its colour with the colour name. The outfits of a detail have a head of their title
  and, when there is one or more, their count (`countKey`) on one line, then the season filter
  and the looks. The season filter (OUT-7) is shared by the details,
  the random panel and the card counts of the app, and is not stored. It is a group named
  `wardrobe.season` of three compact outline chips, 4px apart, `season.any`, `season.warm` and
  `season.cold`; the pressed one is ink. A compact chip is drawn `--chip-compact` (36px) high, in
  `--text-s`, inside a tap-sized button (TAP-1). In the random panel and the Palettes detail the
  filter shares the head row with the title, and the Palettes detail shows no count. A name of a card, a look or a detail that is longer than its column breaks
  inside a word.
- **WAR-6** **Load images** of the sheet is on while the link is an `http` or `https` URL and no
  load runs; during a load it reads `wardrobe.loading`. The images of the page (LNK-2) join the
  images of the sheet, which shows them as a grid; a failure shows `error.linkFailed`. A tap on
  an image keeps it or drops it. A kept image is added last, and more than 8 kept images is
  `error.imagesFull`. A kept image has a star; a tap on the star makes it the main image
  (GAR-7), and the star of the main image is on. An image that does not load is not shown,
  unless it is kept. Out of the sheet, a main image that does not load is not shown. The field **Image URL** with **Add** keeps one more image by its URL, for a
  page that the proxy cannot read; a value that is not an `http` or `https` URL is
  `error.imagesInvalid`. **Save** stores the kept images in their order.
- **WAR-7** A garment with no measure opens the sheet with one empty measure line. A line left
  with no value is not saved (GAR-8).
- **WAR-8** While a new garment has no measure line with a name or a value, the lines are the
  measures of its slot (GAR-10), with their units and no value; a change of the slot changes
  them.
- **WAR-9** With one garment or more, the panel **Random outfit** follows the grid, and from
  1024px is in a column of `--panel-width` beside it that stays in sight, with the basics of
  WAR-10 under it. It holds its title, the
  season filter, one outfit of OUT-9 as a card of WAR-5, and **Another**, which takes another
  outfit (OUT-9 `except`). With no outfit it shows `wardrobe.noRandom` and no **Another**. The
  first render takes an outfit, and a change of the season filter or of the garments takes a new
  one. The panel is no detail: it has no history entry (NAV-7), and an open garment hides it.
- **WAR-10** The panel **Missing basics** (`wardrobe.basics`) follows the random panel, or the
  empty state with no garment, and shares its column from 1024px. It shows the basics of
  `missingBasics` (BAS-3, BAS-4) under the season filter, cached for each doc and season filter,
  with the hint `wardrobe.basicsHint`; with none it is hidden, and an open garment hides it. A row
  is one button: a swatch of the colour of the basic, its name, and a line of its slot, its
  season and, with a gain above 0, `wardrobe.basicGain` (`wardrobe.basicGainMax` at
  `MAX_OUTFITS`). A tap opens the sheet of a new garment (WAR-3) with the name, the slot, the
  season and the colour of the basic; **Save** adds it as any garment, and the basic is then
  covered (BAS-2).

## Combinations section

- **CMB-1** The Combinations section, named `nav.combinations` (Palettes) so that its label fits
  the bottom bar, lists the 348 combinations by number. A row, 72px high, shows `outfit.number`,
  the colours as one bar of `--strip-height`, and the count of its outfits under the season
  filter (`countKey`: a count of `MAX_OUTFITS` reads `combinations.countMax`). A `--line` parts
  the rows; the open row has `aria-current="true"` on `--secondary`. The size chips are outline,
  the pressed one ink. From 840px the list and the detail share the width 5 to 7 (`pane wide`).
- **CMB-2** The size filter keeps the combinations of 2, 3 or 4 colours, or all of them; its
  chips are compact (WAR-5). The switch **Wearable only**, a plain row on the page, keeps the
  combinations with at least one outfit. With no combination
  left, the list shows `combinations.empty` and **Show all**, which clears both filters. The
  filters are not stored.
- **CMB-3** A tap on a row opens its detail (LAY-3): a head with the number and
  `combinations.size` with the count of its colours; the colours as equal fields, 180px high and
  280px from 840px, each with its name (PAL-2) and its hex at the bottom, in dark or light text
  (`inkOn`, PAL-5); then `combinations.outfits` with its outfits (OUT-5) as looks (WAR-5) under
  the season filter.
- **CMB-4** A combination with no outfit names why: `outfits.noColor` with the first colour that
  no garment matches, or `outfits.noSet` when no set of candidates is wearable (OUT-4).
