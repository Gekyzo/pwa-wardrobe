import { APP_SLUG } from '#config';
import { COLORS } from '#wada';

// The wardrobe: garments with a name, a slot, a season and one colour of the palette.
export const GARMENTS_KEY = `${APP_SLUG}.garments`;
export const MAX_NAME = 60;
export const SLOTS = ['top', 'bottom', 'outer', 'shoes', 'accessory'];
export const SEASONS = ['all', 'warm', 'cold'];

export const emptyGarments = () => ({ version: 1, garments: [] });

const missing = (state) => ({ state, error: { key: 'error.garmentMissing' } });

// The clean fields, or an error message.
const checkFields = ({ name, slot, season, color } = {}) => {
  const clean = String(name ?? '').trim();
  if (!clean) return { error: { key: 'error.nameRequired' } };
  if (clean.length > MAX_NAME) return { error: { key: 'error.nameTooLong', params: { max: MAX_NAME } } };
  if (!SLOTS.includes(slot)) return { error: { key: 'error.slotInvalid' } };
  if (!SEASONS.includes(season)) return { error: { key: 'error.seasonInvalid' } };
  if (!Number.isInteger(color) || color < 0 || color >= COLORS.length) return { error: { key: 'error.colorInvalid' } };
  return { fields: { name: clean, slot, season, color } };
};

export const findGarment = (state, id) => state.garments.find((garment) => garment.id === id) ?? null;

export const addGarment = (state, fields, id = crypto.randomUUID()) => {
  const { fields: clean, error } = checkFields(fields);
  if (error) return { state, error };
  return { state: { ...state, garments: [{ id, ...clean }, ...state.garments] } };
};

export const editGarment = (state, id, fields) => {
  if (!findGarment(state, id)) return missing(state);
  const { fields: clean, error } = checkFields(fields);
  if (error) return { state, error };
  return { state: { ...state, garments: state.garments.map((garment) => (garment.id === id ? { id, ...clean } : garment)) } };
};

export const deleteGarment = (state, id) => {
  if (!findGarment(state, id)) return missing(state);
  return { state: { ...state, garments: state.garments.filter((garment) => garment.id !== id) } };
};

// The order of the list: by the order of SLOTS, then by name.
export const sortGarments = (garments) =>
  [...garments].sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || a.name.localeCompare(b.name));

// A clean version 1 doc, or null. Add a migration here when the version goes up.
export const normalizeGarments = (data) => {
  if (typeof data !== 'object' || data === null || data.version !== 1 || !Array.isArray(data.garments)) return null;
  const garments = [];
  for (const garment of data.garments) {
    if (typeof garment !== 'object' || garment === null || typeof garment.id !== 'string' || garment.id === '') return null;
    const { fields, error } = checkFields(garment);
    if (error) return null;
    garments.push({ id: garment.id, ...fields });
  }
  if (new Set(garments.map((garment) => garment.id)).size !== garments.length) return null;
  return { version: 1, garments };
};
