import { lchOf } from '#palette';

// The optional matching rules of Settings, all off by default (MAT-1).
export const MATCHING = Object.freeze({ neutrals: false, contrast: 'off', colorType: 'off', formality: false });
export const CONTRASTS = ['off', 'high', 'soft'];
export const COLOR_TYPES = ['off', 'spring', 'summer', 'autumn', 'winter'];
// '' is not said; the others go from the least formal to the most.
export const FORMALITIES = ['', 'sport', 'casual', 'smart', 'formal'];

export const NEUTRAL_CHROMA = 28;
export const CONTRAST_HIGH = 40;
export const CONTRAST_SOFT = 25;

// The known values of a stored choice; anything else reads as its default.
export const normalizeMatching = (value) => {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    neutrals: v.neutrals === true,
    contrast: CONTRASTS.includes(v.contrast) ? v.contrast : 'off',
    colorType: COLOR_TYPES.includes(v.colorType) ? v.colorType : 'off',
    formality: v.formality === true,
  };
};

export const isNeutral = (color) => lchOf(color)[1] <= NEUTRAL_CHROMA;

// The range of the lightness of some garments (MAT-3).
export const contrastOf = (garments) => {
  if (garments.length === 0) return 0;
  const ls = garments.map((garment) => lchOf(garment.color)[0]);
  return Math.max(...ls) - Math.min(...ls);
};

export const inBand = (contrast, band) => (band === 'high' ? contrast >= CONTRAST_HIGH : band === 'soft' ? contrast <= CONTRAST_SOFT : false);

// The levels that are set span one step or less; a garment with no level never blocks (MAT-4).
export const formalityFits = (garments) => {
  const levels = garments.map((garment) => FORMALITIES.indexOf(garment.formality ?? '')).filter((level) => level > 0);
  return levels.length === 0 || Math.max(...levels) - Math.min(...levels) <= 1;
};

export const traitsOf = (color) => {
  const [l, c, h] = lchOf(color);
  return { warm: h >= 20 && h < 120, light: l >= 60, bright: c >= 40 };
};

// The four seasons of personal colour analysis: a temperature and one of two other traits (MAT-5).
const TYPE_RULES = {
  spring: ({ warm, light, bright }) => warm && (light || bright),
  summer: ({ warm, light, bright }) => !warm && (light || !bright),
  autumn: ({ warm, light, bright }) => warm && (!light || !bright),
  winter: ({ warm, light, bright }) => !warm && (!light || bright),
};

export const suits = (color, type) => type === 'off' || !TYPE_RULES[type] || isNeutral(color) || TYPE_RULES[type](traitsOf(color));
