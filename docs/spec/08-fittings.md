# Fittings

For a category of product and, optionally, a brand, the size and the measures that fit the user,
and how they fit. A category is any kind of product: pants, a T-shirt, a bed sheet, a ring. This
part of the app was the app Fittings (`pwa-fittings`). Its files are `src/fittings.js` and
`tests/fittings.test.js`.

## Doc

- **FIT-1** The fittings are the list `fittings` of the doc of the app (GAR-1):
  `[{ id, category, brand, size, fit, measures, note }]`, newest fitting first.
- **FIT-2** `category` is a text of 1 to 40 characters. `brand` is a text of at most 40, `size` of
  at most 20 and `note` of at most 200; each one is `''` when it is not given. `fit` is `''` (not
  said), `good`, `small` or `large`. `measures` is a list of at most 12 `{ name, value, unit }`:
  `name` is a text of 1 to 30 characters, `value` a finite number above 0, `unit` a text of at
  most 10, `''` when it is not given.
- **FIT-3** `normalizeFittingList` accepts a list of fittings with a non-empty id, no id two
  times, and fields that pass FIT-4. It trims the texts and drops unknown fields.
  `normalizeFittings` accepts the doc of the Fittings app, `{ version: 1, fittings }`, whose list
  passes the same check.

## Operations

- **FIT-4** `addFitting` puts a fitting first; `editFitting` changes the fields of one fitting.
  Each text is trimmed. A blank category is `error.categoryRequired`; a text over its maximum is
  `error.categoryTooLong`, `error.brandTooLong`, `error.sizeTooLong`, `error.noteTooLong`,
  `error.measureNameTooLong` or `error.unitTooLong`. Another fit is `error.fitInvalid`. A
  measures value that is not a list of objects is `error.measuresInvalid`. A measure line with
  no value is dropped, with or without a name. More than 12 lines is `error.measuresFull`, a line with a
  value and no name is `error.measureNameRequired`, and a value that FIT-5 refuses is
  `error.measureValueInvalid`. A fitting with no size and no measure is
  `error.sizeOrMeasureRequired`.
- **FIT-5** `parseValue` takes a number, or a text of digits with one point or one comma as the
  decimal mark, and gives the number when it is above 0, else null.
- **FIT-6** `deleteFitting` removes one fitting. The toast `toast.fittingDeleted` offers **Undo**
  for 5 seconds. An id that is not in the doc is `error.fittingMissing`, and nothing changes.
- **FIT-7** `sortFittings` orders by category, then brand, then size, case aside and with the
  numbers of a text in numeric order. `groupFittings` gives one group for each category, case
  aside, with the spelling of its first fitting in that order.
- **FIT-8** `categoriesOf` and `brandsOf` give each value that is not blank one time, case aside,
  with the spelling of the newest fitting, sorted. `measuresOf` gives the `{ name, unit }` of the
  measures of one category, newest fitting first, each name one time, case aside.
- **FIT-9** `matches` is true when each word of the query is in the category, the brand, the
  size, the note or a measure name of the fitting, case and accents aside. A blank query matches
  every fitting.
- **FIT-15** The Fittings app stored its doc under `pwa-fittings.fittings`. Its deploy and this
  one share the origin `gekyzo.github.io`, so this app can read it. `adoptFittings` gives the doc
  with the fittings of that doc when the doc of the app has no fitting and that doc passes FIT-3
  with one fitting or more; else the doc does not change. The old key does not change.
