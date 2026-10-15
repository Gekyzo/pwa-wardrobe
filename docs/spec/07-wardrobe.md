# Wardrobe

The domain of the app: garments with a colour of the palette of *A Dictionary of Color
Combinations* (Sanzo Wada, 1933), the combinations of the book, and the outfits that a wardrobe
gives for them. Its files are `src/wada.js`, `src/palette.js`, `src/garments.js`, `src/outfits.js`,
`tests/palette.test.js`, `tests/garments.test.js`, `tests/outfits.test.js`, the views
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

## Garments

- **GAR-1** The doc is `{ version: 1, garments: [{ id, name, slot, season, color }] }`, newest
  garment first, stored as JSON under `wardrobe.garments`. A stored doc that is not valid is kept
  under `wardrobe.garments.corrupt`, and the app starts with no garments.
- **GAR-2** `slot` is one of `top`, `bottom`, `outer`, `shoes`, `accessory`. `season` is one of
  `all`, `warm`, `cold`. `color` is the `id` of a palette colour.
- **GAR-3** `addGarment` puts a garment first; `editGarment` changes the fields of one garment.
  The name is trimmed; a blank name is `error.nameRequired`, a name of more than 60 characters is
  `error.nameTooLong`. Another slot is `error.slotInvalid`, another season is
  `error.seasonInvalid`, and a colour that is not an integer from 0 to 158 is
  `error.colorInvalid`.
- **GAR-4** `deleteGarment` removes one garment. An id that is not in the doc is
  `error.garmentMissing`, and nothing changes.
- **GAR-5** `normalizeGarments` accepts a doc of version 1 whose garments have a non-empty id, no
  id two times, and fields that pass GAR-3. It trims each name and drops unknown fields. A new
  version adds its migration here.

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
- **OUT-6** Each colour keeps its `MAX_CANDIDATES` nearest garments, so that a search stays short
  in a wardrobe with many garments of one colour.
- **OUT-7** The season filter is `any`, `warm` or `cold`. A garment fits it when the filter is
  `any`, the season of the garment is `all`, or the two are equal.
- **OUT-8** `outfitsWith` gives the outfits that contain one garment: over each combination of a
  colour near it, the garment takes each place that it matches, out of the candidate cap, and the
  other places are searched among the other garments.

## Wardrobe section

- **WAR-1** The Wardrobe section lists the garments in the order of the slots, then by name. A
  row shows the colour as a dot, the name, and the slot and season. With no garment it shows
  `wardrobe.empty`.
- **WAR-2** A row slides left to show **Delete** (GAR-4); the toast `toast.garmentDeleted` offers
  **Undo** for 5 seconds.
- **WAR-3** **+** opens the sheet of a new garment: the name, the slot, the season and the
  colour. The colour input of the phone takes the nearest palette colour (PAL-3); a tap on a
  swatch of the grid of the 159 colours takes that colour. The sheet shows the name of the chosen
  colour, or `wardrobe.colorNone`. A new garment starts with no colour, and **Save** without one
  is `error.colorInvalid`.
- **WAR-4** A tap on a row opens its detail (LAY-3): the colour, the name, the colour name, slot
  and season, **Edit** and **Delete**, and the outfits that contain it (OUT-8) under the season
  filter, or `wardrobe.noOutfits`.
- **WAR-5** An outfit card shows `outfit.number`, the strip of its combination, `outfit.exact`
  for an exact outfit, and each garment with its colour, name and slot. The season filter
  (OUT-7) is shared by the details of the app and is not stored.

## Combinations section

- **CMB-1** The Combinations section, named `nav.combinations` (Palettes) so that its label fits
  the rail, lists the 348 combinations by number. A row shows
  `outfit.number`, the strip of its colours and the count of its outfits under the season filter;
  a count of `MAX_OUTFITS` reads `combinations.countMax`.
- **CMB-2** The size filter keeps the combinations of 2, 3 or 4 colours, or all of them. The
  switch **Wearable only** keeps the combinations with at least one outfit. With no combination
  left, the list shows `combinations.empty`. The filters are not stored.
- **CMB-3** A tap on a row opens its detail (LAY-3): the number, the colours as equal blocks with
  their names (PAL-2), and its outfits (OUT-5) under the season filter.
- **CMB-4** A combination with no outfit names why: `outfits.noColor` with the first colour that
  no garment matches, or `outfits.noSet` when no set of candidates is wearable (OUT-4).
