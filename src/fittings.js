// The fittings: for a category of product (pants, a bed sheet, a ring) and, optionally, a brand,
// the size and the measures that fit, and how they fit. They are the `fittings` of the doc of the
// app (GAR-1); each operation keeps the other fields of the doc.

// The doc of the Fittings app, which this app took in. One origin holds the two apps (FIT-15).
export const LEGACY_FITTINGS_KEY = 'pwa-fittings.fittings';
export const MAX_CATEGORY = 40;
export const MAX_BRAND = 40;
export const MAX_SIZE = 20;
export const MAX_NOTE = 200;
export const MAX_MEASURES = 12;
export const MAX_MEASURE_NAME = 30;
export const MAX_UNIT = 10;
// '' is a fit that the user did not say.
export const FITS = ['', 'good', 'small', 'large'];

const missing = (state) => ({ state, error: { key: 'error.fittingMissing' } });

const text = (value) => (typeof value === 'string' ? value.trim() : value == null ? '' : null);

// A positive finite number from a number or a text with a point or a comma, or null.
export const parseValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  const clean = String(value ?? '').trim();
  if (!/^\d+([.,]\d+)?$/.test(clean)) return null;
  const number = Number(clean.replace(',', '.'));
  return number > 0 ? number : null;
};

const tooLong = (value, max, key) => (value === null || value.length > max ? { error: { key, params: { max } } } : null);

// The clean measures, or an error. A line with no value is dropped: the sheet offers named lines
// that the user may leave empty.
const checkMeasures = (measures) => {
  if (!Array.isArray(measures)) return { error: { key: 'error.measuresInvalid' } };
  const lines = measures.filter((line) => typeof line === 'object' && line !== null);
  if (lines.length !== measures.length) return { error: { key: 'error.measuresInvalid' } };
  const kept = lines.filter((line) => String(line.value ?? '').trim() !== '');
  if (kept.length > MAX_MEASURES) return { error: { key: 'error.measuresFull', params: { max: MAX_MEASURES } } };
  const clean = [];
  for (const line of kept) {
    const name = text(line.name);
    if (!name) return { error: { key: 'error.measureNameRequired' } };
    if (name.length > MAX_MEASURE_NAME) return { error: { key: 'error.measureNameTooLong', params: { max: MAX_MEASURE_NAME } } };
    const value = parseValue(line.value);
    if (value === null) return { error: { key: 'error.measureValueInvalid', params: { name } } };
    const unit = text(line.unit);
    const long = tooLong(unit, MAX_UNIT, 'error.unitTooLong');
    if (long) return long;
    clean.push({ name, value, unit });
  }
  return { measures: clean };
};

// The clean fields, or an error message.
const checkFields = ({ category, brand, size, fit = '', measures = [], note } = {}) => {
  const cleanCategory = text(category);
  if (!cleanCategory) return { error: { key: 'error.categoryRequired' } };
  const fields = { category: cleanCategory, brand: text(brand), size: text(size), note: text(note) };
  const long =
    tooLong(fields.category, MAX_CATEGORY, 'error.categoryTooLong') ??
    tooLong(fields.brand, MAX_BRAND, 'error.brandTooLong') ??
    tooLong(fields.size, MAX_SIZE, 'error.sizeTooLong') ??
    tooLong(fields.note, MAX_NOTE, 'error.noteTooLong');
  if (long) return long;
  if (!FITS.includes(fit)) return { error: { key: 'error.fitInvalid' } };
  const { measures: cleanMeasures, error } = checkMeasures(measures);
  if (error) return { error };
  if (!fields.size && cleanMeasures.length === 0) return { error: { key: 'error.sizeOrMeasureRequired' } };
  return { fields: { ...fields, fit, measures: cleanMeasures } };
};

export const findFitting = (state, id) => state.fittings.find((fitting) => fitting.id === id) ?? null;

export const addFitting = (state, fields, id = crypto.randomUUID()) => {
  const { fields: clean, error } = checkFields(fields);
  if (error) return { state, error };
  return { state: { ...state, fittings: [{ id, ...clean }, ...state.fittings] } };
};

export const editFitting = (state, id, fields) => {
  if (!findFitting(state, id)) return missing(state);
  const { fields: clean, error } = checkFields(fields);
  if (error) return { state, error };
  return { state: { ...state, fittings: state.fittings.map((fitting) => (fitting.id === id ? { id, ...clean } : fitting)) } };
};

export const deleteFitting = (state, id) => {
  if (!findFitting(state, id)) return missing(state);
  return { state: { ...state, fittings: state.fittings.filter((fitting) => fitting.id !== id) } };
};

const compare = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
const sameText = (a, b) => compare(a.trim(), b.trim()) === 0;

// The order of the list: by category, then brand, then size, case aside and numbers in order.
export const sortFittings = (fittings) =>
  [...fittings].sort((a, b) => compare(a.category, b.category) || compare(a.brand, b.brand) || compare(a.size, b.size));

// One group for each category, case aside, with the spelling of its first sorted fitting.
export const groupFittings = (fittings) => {
  const groups = [];
  for (const fitting of sortFittings(fittings)) {
    const last = groups.at(-1);
    if (last && sameText(last.category, fitting.category)) last.fittings.push(fitting);
    else groups.push({ category: fitting.category, fittings: [fitting] });
  }
  return groups;
};

// Each value that is not blank once, case aside, with its first spelling, sorted.
const distinct = (values) => {
  const seen = new Map();
  for (const value of values) if (value && !seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value);
  return [...seen.values()].sort(compare);
};

export const categoriesOf = (fittings) => distinct(fittings.map((fitting) => fitting.category));
export const brandsOf = (fittings) => distinct(fittings.map((fitting) => fitting.brand));

// The measures `{ name, unit }` that the fittings of a category use, newest first, each name once.
export const measuresOf = (fittings, category) => {
  const seen = new Map();
  for (const fitting of fittings) {
    if (!sameText(fitting.category, category)) continue;
    for (const { name, unit } of fitting.measures) if (!seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), { name, unit });
  }
  return [...seen.values()];
};

const fold = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// True when each word of `query` is in the category, brand, size, note or a measure name.
export const matches = (fitting, query) => {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const haystack = fold([fitting.category, fitting.brand, fitting.size, fitting.note, ...fitting.measures.map((m) => m.name)].join(' '));
  return words.every((word) => haystack.includes(word));
};

// A clean list of fittings, or null: an id that is not empty, no id two times, fields that pass checkFields.
export const normalizeFittingList = (list) => {
  if (!Array.isArray(list)) return null;
  const fittings = [];
  for (const fitting of list) {
    if (typeof fitting !== 'object' || fitting === null || typeof fitting.id !== 'string' || fitting.id === '') return null;
    const { fields, error } = checkFields(fitting);
    if (error) return null;
    fittings.push({ id: fitting.id, ...fields });
  }
  if (new Set(fittings.map((fitting) => fitting.id)).size !== fittings.length) return null;
  return fittings;
};

// A clean doc of the Fittings app, version 1, or null: its stored doc and its backup.
export const normalizeFittings = (data) => {
  if (typeof data !== 'object' || data === null || data.version !== 1) return null;
  const fittings = normalizeFittingList(data.fittings);
  return fittings ? { version: 1, fittings } : null;
};

// The doc with the fittings of a Fittings doc, when it has none of its own and that doc is valid
// and not empty; else the same doc. `moved` is the count of the fittings taken (FIT-15).
export const adoptFittings = (state, data) => {
  const legacy = normalizeFittings(data);
  if (state.fittings.length > 0 || !legacy?.fittings.length) return { state, moved: 0 };
  return { state: { ...state, fittings: legacy.fittings }, moved: legacy.fittings.length };
};
