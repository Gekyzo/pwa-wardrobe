// The size, the fit and the measures of a garment: the size and the measures that fit, and how
// the garment fits.
export const MAX_SIZE = 20;
export const MAX_MEASURES = 12;
export const MAX_MEASURE_NAME = 30;
export const MAX_UNIT = 10;
// '' is a fit that the user did not say.
export const FITS = ['', 'good', 'small', 'large'];

const text = (value) => (typeof value === 'string' ? value.trim() : value == null ? '' : null);

const tooLong = (value, max, key) => (value === null || value.length > max ? { error: { key, params: { max } } } : null);

// A positive finite number from a number or a text with a point or a comma, or null.
export const parseValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  const clean = String(value ?? '').trim();
  if (!/^\d+([.,]\d+)?$/.test(clean)) return null;
  const number = Number(clean.replace(',', '.'));
  return number > 0 ? number : null;
};

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

// The clean size, fit and measures of a garment, or an error message. Each one is optional.
export const checkSizing = ({ size = '', fit = '', measures = [] } = {}) => {
  const cleanSize = text(size);
  const long = tooLong(cleanSize, MAX_SIZE, 'error.sizeTooLong');
  if (long) return long;
  if (!FITS.includes(fit)) return { error: { key: 'error.fitInvalid' } };
  const { measures: cleanMeasures, error } = checkMeasures(measures);
  if (error) return { error };
  return { fields: { size: cleanSize, fit, measures: cleanMeasures } };
};

// The measures `{ name, unit }` that the garments of a slot use, newest first, each name once,
// case aside.
export const measuresOf = (garments, slot) => {
  const seen = new Map();
  for (const garment of garments) {
    if (garment.slot !== slot) continue;
    for (const { name, unit } of garment.measures ?? []) if (!seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), { name, unit });
  }
  return [...seen.values()];
};
