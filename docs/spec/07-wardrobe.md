# Wardrobe

The domain of the app: garments with a colour of the palette of *A Dictionary of Color
Combinations* (Sanzo Wada, 1933), the combinations of the book, and the outfits that a wardrobe
gives for them. Its files are `src/wada.js`, `src/palette.js`, `src/garments.js`, `tests/palette.test.js`,
`tests/garments.test.js`.

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
