import { APP_SLUG } from '#config';
import { COLORS } from '#wada';
import { checkSizing } from '#measures';

// The wardrobe: garments with a name, a slot, a season, one colour of the palette and, optionally,
// a brand, a link to the shop, the URLs of their images, the main one first, and the size, the fit
// and the measures of `src/measures.js`.
export const GARMENTS_KEY = `${APP_SLUG}.garments`;
export const MAX_NAME = 60;
export const MAX_BRAND = 40;
export const MAX_LINK = 2000;
export const MAX_IMAGES = 8;
export const SLOTS = ['top', 'bottom', 'outer', 'shoes', 'accessory'];
export const SEASONS = ['all', 'warm', 'cold'];

export const emptyGarments = () => ({ version: 3, garments: [] });

// True for an absolute http or https URL.
export const isWebUrl = (text) => {
  if (typeof text !== 'string' || text.length > MAX_LINK) return false;
  try {
    return ['http:', 'https:'].includes(new URL(text).protocol);
  } catch {
    return false;
  }
};

const missing = (state) => ({ state, error: { key: 'error.garmentMissing' } });

// The clean fields, or an error message.
const checkFields = ({ name, slot, season, color, brand = '', link = '', images = [], size, fit, measures } = {}) => {
  const clean = String(name ?? '').trim();
  if (!clean) return { error: { key: 'error.nameRequired' } };
  if (clean.length > MAX_NAME) return { error: { key: 'error.nameTooLong', params: { max: MAX_NAME } } };
  if (!SLOTS.includes(slot)) return { error: { key: 'error.slotInvalid' } };
  if (!SEASONS.includes(season)) return { error: { key: 'error.seasonInvalid' } };
  if (!Number.isInteger(color) || color < 0 || color >= COLORS.length) return { error: { key: 'error.colorInvalid' } };
  if (typeof brand !== 'string' || brand.trim().length > MAX_BRAND) return { error: { key: 'error.brandTooLong', params: { max: MAX_BRAND } } };
  const cleanLink = typeof link === 'string' ? link.trim() : null;
  if (cleanLink === null || (cleanLink !== '' && !isWebUrl(cleanLink))) return { error: { key: 'error.linkInvalid' } };
  if (!Array.isArray(images) || images.length > MAX_IMAGES || !images.every(isWebUrl) || new Set(images).size !== images.length) {
    return { error: { key: 'error.imagesInvalid' } };
  }
  const { fields: sizing, error } = checkSizing({ size, fit, measures });
  if (error) return { error };
  return { fields: { name: clean, slot, season, color, brand: brand.trim(), link: cleanLink, images: [...images], ...sizing } };
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

// The brands in use, each once (the first spelling, case aside), sorted.
export const brandsOf = (garments) => {
  const brands = new Map();
  for (const { brand } of garments) if (brand && !brands.has(brand.toLowerCase())) brands.set(brand.toLowerCase(), brand);
  return [...brands.values()].sort((a, b) => a.localeCompare(b));
};

export const mainImage = (garment) => garment.images?.[0] ?? null;

// The chosen images of the sheet with `url` added at the end or removed.
export const toggleImage = (images, url) => {
  if (images.includes(url)) return { images: images.filter((image) => image !== url) };
  if (images.length >= MAX_IMAGES) return { images, error: { key: 'error.imagesFull', params: { max: MAX_IMAGES } } };
  return { images: [...images, url] };
};

export const makeMain = (images, url) => (images.includes(url) ? [url, ...images.filter((image) => image !== url)] : images);

// A clean version 3 doc, or null. Version 1 had no brand, link or images, and versions 1 and 2
// had no size, fit or measures: checkFields gives them their empty values. Add a migration here
// when the version goes up.
export const normalizeGarments = (data) => {
  if (typeof data !== 'object' || data === null || ![1, 2, 3].includes(data.version) || !Array.isArray(data.garments)) return null;
  const garments = [];
  for (const garment of data.garments) {
    if (typeof garment !== 'object' || garment === null || typeof garment.id !== 'string' || garment.id === '') return null;
    const { fields, error } = checkFields(garment);
    if (error) return null;
    garments.push({ id: garment.id, ...fields });
  }
  if (new Set(garments.map((garment) => garment.id)).size !== garments.length) return null;
  return { version: 3, garments };
};
