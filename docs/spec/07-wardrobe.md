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
- **PAL-6** `lchOf` gives `[L, C, h]` of a palette colour: the lightness L\* of PAL-3, the chroma
  √(a\*² + b\*²) and the hue angle atan2(b\*, a\*) in degrees, from 0 up to 360. An id that is
  not in the palette gives null.

## Garments

- **GAR-1** The doc is
  `{ version: 4, garments: [{ id, name, slot, season, color, brand, reference, link, images, size, fit, measures, buy_date, price, formality, creation_date }] }`,
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
- **GAR-14** `shapeOf` gives the shape of the drawing of a garment with no image: one of `SHAPES`.
  Each slot has its shapes, the first one its default: top `tshirt`, `shirt`, `jersey`; bottom
  `trousers`, `shorts`, `skirt`; outer `jacket`, `coat`; shoes `shoe`, `boot`; accessory `bag`,
  `cap`, `scarf`, `belt`. The name, in lower case, with no accent and with each run of other
  characters as one space, is searched for the words of each shape of its slot, in Spanish and
  English (`camiseta`, `t shirt`, `vaqueros`, `pantalon corto`, `botines`...), as whole words,
  the words of two or more first; the first found gives the shape, and none gives the default.
  An unknown slot is searched as `top`. Each shape is the symbol `shape-<shape>` of `icons.svg`,
  48×48.
- **GAR-15** The formality of a garment is optional: one of `FORMALITIES` (MAT-4), `''` when it
  is not given. Another value is `error.formalityInvalid`. A doc of version 4 with no formality
  gets `''` (GAR-5): the version does not change.

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
  outfits of each combination once for each doc, season filter and matching choice.
- **OUT-11** `outfitsFor`, `outfitsWith`, `countOutfits` and `randomOutfit` take the matching
  choice (MAT-1) as the option `match`, `MATCHING` when it is not given. With every rule off, the
  outfits are those of OUT-3 to OUT-10.
- **OUT-12** With `formality` on, a set of garments is wearable (OUT-4) only when it fits the
  formality (MAT-4).
- **OUT-13** Each outfit carries its `contrast` (MAT-3) of the garments of its combination. With
  `contrast` set to `high` or `soft`, the outfits in that band come after the exact ones and
  before the others (OUT-5); the band removes no outfit.
- **OUT-14** With `neutrals` on, each outfit of the cut of OUT-5 with no `shoes`, and under the
  season filter `cold` with no `outer`, gets the neutral garment (MAT-2) of that slot that fits
  the season filter, is not in the outfit and, with `formality` on, keeps it fitting: the one
  nearest to a colour of its garments (PAL-3), then the lower id. An added pick is
  `{ color: null, garment, distance: 0, added: true }`: the score, the exact mark and the
  contrast stay. Completion adds garments, never outfits: the counts of OUT-10 and WAR-1 count
  the outfits of the combinations.

- **OUT-15** `outfitsFor`, `outfitsWith`, `countOutfits`, `whyNone` and `randomOutfit` take the
  family in use (FAM-1) as the option `family`, `wada` when it is not given. They read the sets,
  their numbers and the sets of a colour through `familyOf` (FAM-2): a number is a number of that
  family, and an outfit of OUT-3 to OUT-14 is an outfit of one of its sets.
## Matching

- **MAT-1** `src/matching.js` holds the optional matching rules. `MATCHING` is the default choice
  `{ neutrals: false, contrast: 'off', colorType: 'off', formality: false }`: every rule is off.
  `contrast` is one of `CONTRASTS` (`off`, `high`, `soft`), `colorType` one of `COLOR_TYPES`
  (`off`, `spring`, `summer`, `autumn`, `winter`). `normalizeMatching` keeps a known value of each
  field and gives the default for any other value and for a value that is not an object.
- **MAT-2** A colour is neutral when its chroma (PAL-6) is at most `NEUTRAL_CHROMA`, 28: white,
  black, grey, beige, navy, denim, brown and stone.
- **MAT-3** The contrast of some garments is the range of the lightness L\* of their colours, 0
  for one garment or none. A contrast is in the band `high` from `CONTRAST_HIGH`, 40, and in the
  band `soft` up to `CONTRAST_SOFT`, 25; `off` is no band.
- **MAT-4** `FORMALITIES` is `''` (not said), `sport`, `casual`, `smart` and `formal`, in this
  order. Some garments fit the formality when the levels that are set span one step or less. A
  garment with no level never blocks.
- **MAT-5** The traits of a colour come from PAL-6: warm when its hue is from 20° up to 120°,
  light when L\* is 60 or more, bright when its chroma is 40 or more. A neutral colour (MAT-2)
  suits every colour type. Another colour suits `spring` when warm and light or bright, `summer`
  when cool and light or not bright, `autumn` when warm and not light or not bright, `winter` when
  cool and not light or bright. Every colour suits `off`.
- **MAT-6** The choice is a preference of the device under `wardrobe.matching` (ENG-8), not part
  of the doc: a JSON object of the fields that differ from `MATCHING`. The defaults remove the
  key. A value that cannot be read reads as `normalizeMatching` of it (MAT-1).

## Families

- **FAM-1** `src/families.js` holds the palette families, in this order: `wada` (the
  combinations of the book), `complementary`, `analogous`, `triadic`, `split`
  (split-complementary), `accent` (neutral and accent) and `mono` (monochrome). Every family is a
  list of sets of the 159 colours of PAL-1. One family is in use at a time (FAM-6).
- **FAM-2** `familyOf(id)` gives `{ id, combinations, combination(n), numbersOf(color) }`, built
  once for each family: the sets `{ number, colors }`, the colours of the set of a number (null
  for another number), and the numbers of the sets that hold a colour, in order. `wada` is
  `COMBINATIONS` with the numbers of the book. An unknown id gives `wada`.
- **FAM-3** The sets of a generated family come from each colour that is not neutral (MAT-2), as
  a base, in colour id order. The base is the first colour of its set. A set whose colours are
  those of an earlier set, in any order, is dropped. The sets are numbered 1, 2, 3… in that
  order. With `FAMILY_MAX` 25 there are 54 complementary sets, 100 analogous, 60 triadic, 60
  split, 103 accent and 89 mono.
- **FAM-4** Each target of a base is the palette colour nearest (PAL-3) to an ideal Lab colour,
  out of the colours already in the set. The set is dropped when a target is more than
  `FAMILY_MAX` from its ideal. With the L\*, the chroma and the hue h of the base (PAL-6), the
  ideals have the L\* and the chroma of the base and the hue: h + 180° (`complementary`), h − 30°
  and h + 30° (`analogous`), h + 120° and h + 240° (`triadic`), h + 150° and h + 210° (`split`).
  `mono` has the hue and the chroma of the base at L\* − 25 and L\* + 25, each kept from 5 to 98.
  `accent` takes the neutral colour with L\* of 60 or more nearest to the base, then the neutral
  colour with L\* under 40 nearest to it, with no distance limit.
- **FAM-5** `switchFamily(off, id, on)` gives the families that are off after a switch, in the
  order of `FAMILIES`; a switch that would turn off the last family that is on changes nothing.
  `activeFamily(chosen, off)` gives `chosen` when it is a family that is on, else the first
  family that is on.
- **FAM-6** The family in use and the families that are off are preferences of the device, not
  part of the doc: `wardrobe.family` holds the id in use (`wada` removes the key, and an unknown
  value reads as `wada`), and `wardrobe.families` a JSON list of the ids that are off, in the
  order of `FAMILIES` (none removes the key). A stored list that turns every family off, or one
  that cannot be read, reads as none. At start the family in use is `activeFamily` of the stored
  one; a change of the families that are off moves it the same way and stores both.

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

## Fill

- **FIL-1** `fillSuggestions` of `src/fill.js` gives the ranked list of the Fill tab: rows
  `{ kind, basic, slot, season, color, gain, completes }`, `kind` `basic` or `set`. `MAX_FILL`
  is 12 (option `max`).
- **FIL-2** The basics of the list are all the basics of `missingBasics` (BAS-3, BAS-4) under the
  season filter, with their gain, even 0, and no `completes`.
- **FIL-3** The open palettes are the combinations with no outfit under the season filter; the
  option `of` reads the outfits of one combination in place of `outfitsFor`. A gap of a palette
  is a colour that no garment of the season filter is near. The one gap of an open palette, or
  each colour of an open palette with no gap, in each slot of GAR-2, is a set candidate: a
  garment of season `all`. A palette two gaps short gives no candidate. Its
  `completes` is the sorted numbers of the open palettes of its colour and of the colours within
  `MATCH_MAX` that `outfitsFor` gives an outfit with the candidate added; a palette with a colour
  that neither a garment nor the candidate is near is not searched. A candidate with no
  `completes` is dropped. Its gain is the count of `outfitsWith` (OUT-8) of the candidate.
- **FIL-4** A candidate is dropped when a garment that fits the season filter (OUT-7) covers it
  (BAS-2), or when a missing basic of its slot that fits the season filter is within `MATCH_MAX`
  of its colour. Of two
  candidates of one slot within `MATCH_MAX`, the higher gain stays, then the lower colour id.
- **FIL-5** After the drops, each colour keeps one slot: the higher gain, then the slot order of
  GAR-2.
- **FIL-6** The list is sorted by the higher gain, then basics before set colours, then the order
  of `BASICS`, then the colour id, and cut to `max`.
- **FIL-7** The Fill section (`nav.fill`, the `star` icon) shows the season filter shared with the
  other views, the hint `fill.hint`, and the rows of `fillSuggestions` under the filter, computed
  once for each doc, season filter and matching choice, with the cached outfits of each combination as `of`. A
  row is one button: a swatch of its colour; its name, `basic.<id>` for a basic or
  `fill.wadaName` with the slot and the colour name for a Wada colour; a line of its slot and its
  season; with a gain above 0, its gain, `fill.gain` (`fill.gainMax` at `MAX_OUTFITS`), on the end; the tag
  `fill.basic` or `fill.completes` with the count of `completes`; and for a Wada colour the first
  three palettes of `completes`, each `outfit.number` and its strip, the colours within
  `MATCH_MAX` of the row outlined. A tap opens the sheet of a new garment (WAR-3) with the name,
  the slot, the season and the colour of the row; **Save** adds it, and the view stays. With no
  row it shows `fill.empty`.
- **FIL-8** `fillSuggestions` and `missingBasics` take the matching choice as the option `match`
  and give it to each outfit search (OUT-11). With a `colorType` other than `off`, a row whose
  colour does not suit it (MAT-5) leaves the list, before the cut of FIL-6.

- **FIL-9** `fillSuggestions` and `missingBasics` take the family in use as the option `family`
  and give it to each outfit search (OUT-15). The open palettes of FIL-3 are the sets of that
  family with no outfit, and `completes` holds numbers of that family.
## Wardrobe section

- **WAR-1** The Wardrobe section shows the garments as a grid of cards, grouped by slot in the
  order of `SLOTS`, then by name. Each group has a head with the slot name and `garments.count`.
  The grid has 2 columns, 4 from 600px, with gaps of 20px by 12px, 24px by 16px from 1024px. A card is one button that opens the detail: the picture
  of the garment, 3:4, with square corners; the name; a dot of the colour and its name; and the
  brand, `wardrobe.sizeShort` with the size, and the count of `outfitsWith` under the season
  filter (`countKey`: `combinations.countMax` at `MAX_OUTFITS`, else `combinations.count`, so 0
  reads "0 conjuntos"), each one if it has one. The counts are cached for each doc, season
  filter and matching choice. The picture is the main image (GAR-7), contained on `--photo-ground`; a garment with no
  image, or whose image fails to load, shows the drawing of its shape (GAR-14) on the same ground,
  filled with its colour, at 76% of the box with a `--muted` outline; with **Colour** of WAR-11
  every card shows a field of its colour. In a card and in a look the
  picture is hidden from a screen reader, since the name and the colour stand beside it as text;
  the picture of the detail has the alt text of the name, or as a drawing `role="img"` and the label
  "name, colour name". With no garment the section shows `wardrobe.empty` and **Add
  garment**, which opens the sheet of WAR-3.
- **WAR-2** **Delete** is in the detail of a garment (WAR-4, GAR-4); the toast
  `toast.garmentDeleted` offers **Undo** for 5 seconds. A doc that the sync puts in place hides an open **Undo** (SYNC-2).
- **WAR-3** **+** opens the sheet of a new garment. Its head has the title and **Close**, its foot
  **Save**; **Close**, a tap on the veil or a drag down of the head closes it with no save. The
  sheet holds the name, the brand, the reference (GAR-13), the slot, the season, the formality
  (GAR-15) as a select of `formality.<level>` (`formality.unknown` for `''`), shown only while the
  rule `formality` is on (SET-4) and kept as it is in a save while it is hidden,
  the colour, the link, the images, under `wardrobe.purchase` the buy date, which is not after
  today and is today for a new garment, and the price in euros (GAR-12) and, under `wardrobe.sizing`, the size, the fit (GAR-8) as one segmented control
  in one line, each segment an icon over its name, the measure lines, each with a name, a value, a unit and a button that removes it, and
  **Add measure**. The measure name suggests the names in use, and the unit the units in use, then
  `cm`, `mm`, `in`, `EU`, `US` and `UK`. A value shows in the number format of the language. The brand field suggests no brand while it is empty, and
  the first 5 brands of GAR-11 for its text, in a list under the field that the app draws, not a
  `datalist`. A tap on a brand puts it in the field and hides the list; the list also hides when
  the text is the one brand it gives, on **Escape**, which leaves the sheet open, and when the
  field loses the focus. The colour input of the phone takes the nearest palette colour (PAL-3); so does a colour code typed as `#hex`, `rgb()` or
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
  `wardrobe.imageCount` ("2 / 3"). An image that does not load shows the drawing of its shape (WAR-1).
  The shown image stays while the detail is open. The info: the name at
  `--screen-title`, a line of slot, brand and season, then the facts in two columns, each a label
  over its value as plain text: the size, the reference, the fit, the formality, each measure, the price in euros, the buy
  date and `wardrobe.added` with the creation date, in the formats of the language, each one only
  when it is set. Then **Edit** (primary), **Open link** (outline) when the garment has a link,
  which opens it in a new tab, and **Delete** (an underlined danger text button), and the outfits that
  contain it (OUT-8) under the season filter, or `wardrobe.noOutfits`. From 1024px the media and
  the rest are two columns, 7 to 5, and the media stays in sight; below, they stack.
- **WAR-5** An outfit is a look on a `--surface` card: `outfit.number`, `outfit.exact` for an
  exact outfit and `outfit.contrast.<band>` for an outfit in the band of the rule `contrast`
  (OUT-13), then its garments side by side, each with its picture (WAR-1, 3:4), its name and
  a dot of its colour with the colour name; a garment that completion added (OUT-14) ends with
  `outfit.neutral`. The outfits of a detail have a head of their title
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
  1024px is in a column of `--panel-width` beside it that stays in sight. It holds its title, the
  season filter, one outfit of OUT-9 as a card of WAR-5 (its pictures follow WAR-11), and **Another**, which takes another
  outfit (OUT-9 `except`). With no outfit it shows `wardrobe.noRandom` and no **Another**. The
  first render takes an outfit, and a change of the season filter, of the matching choice or of the garments takes a new
  one. The panel is no detail: it has no history entry (NAV-7), and an open garment hides it.
- **WAR-10** Removed: the missing basics are rows of the Fill tab (FIL-2, FIL-7). Wardrobe has no
  panel of basics.
- **WAR-11** With one garment or more, a segmented control of two (`wardrobe.cardsShow`),
  **Photos** (`wardrobe.cardsPhotos`) and **Colour** (`wardrobe.cardsColor`), stands above the
  groups of the grid, aligned to the end, at most `--cards-switch-width` wide. **Photos** is the
  picture of WAR-1. **Colour** shows the field of the colour of each garment, 2:1 in place of 3:4, in place of its
  image, in the cards and in the look of the random panel (WAR-9); the detail of a garment and
  the Combinations section keep their images. The choice is a preference of the device, the key
  `wardrobe.cards` (ENG-8, `CARDS_KEY`): `color`, or no key for **Photos**, the default; an unknown value
  reads as **Photos**.

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
