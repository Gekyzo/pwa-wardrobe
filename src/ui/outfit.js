import { mainImage, shapeOf } from '#garments';
import { colorOf, inkOn } from '#palette';
import { SEASON_FILTERS, countKey, outfitsFor } from '#outfits';
import { el, ui, state, t, render, matching } from '#ui/context';
import { inBand } from '#matching';
import { icon } from '#ui/controls';

// The outfits of each combination for the doc and the season filter of now, computed once each.
// The header and Combinations read them at each render; a new doc or a new filter starts again.
let cache = { garments: null, season: null, matching: null, outfits: new Map() };
export const outfitsOf = (number) => {
  if (cache.garments !== state.garments || cache.season !== ui.season || cache.matching !== matching) {
    cache = { garments: state.garments, season: ui.season, matching, outfits: new Map() };
  }
  if (!cache.outfits.has(number)) cache.outfits.set(number, outfitsFor(number, state.garments, { season: ui.season, match: matching }));
  return cache.outfits.get(number);
};

// A block of one palette colour.
export const swatch = (colorId, variant = '') => {
  const node = el('span', { className: variant === 'dot' ? 'swatch dot' : 'swatch' });
  node.style.background = colorOf(colorId).hex;
  return node;
};

// A remote image: no referrer, since some shops refuse a request from another site.
export const remoteImage = (src, className) => el('img', { className, referrerPolicy: 'no-referrer', loading: 'lazy', decoding: 'async', alt: '', src });

// The drawing of each shape of GAR-14, a symbol of icons.svg.
const SHAPE_ICONS = {
  tshirt: 'shape-tshirt',
  shirt: 'shape-shirt',
  jersey: 'shape-jersey',
  trousers: 'shape-trousers',
  shorts: 'shape-shorts',
  skirt: 'shape-skirt',
  jacket: 'shape-jacket',
  coat: 'shape-coat',
  shoe: 'shape-shoe',
  boot: 'shape-boot',
  bag: 'shape-bag',
  cap: 'shape-cap',
  scarf: 'shape-scarf',
  belt: 'shape-belt',
};

// The picture of a garment: its main image (GAR-7), or `url`, on the photo ground. With no image,
// or when the image fails to load, it is the drawing of its shape (GAR-14) in its colour, or with
// `shape: false` a field of its colour (WAR-11). `variant` is card, hero or worn (in a look). A
// card and a look have the name and the colour as text beside the picture, so there the picture
// is hidden from a screen reader; the hero names the garment and its colour.
export const picture = (garment, variant, url = mainImage(garment), { shape = true } = {}) => {
  const box = el('span', { className: variant === 'hero' ? 'garment-picture hero' : variant === 'worn' ? 'garment-picture worn' : 'garment-picture card' });
  const named = variant === 'hero';
  if (!named) box.setAttribute('aria-hidden', 'true');
  const field = () => {
    const color = colorOf(garment.color);
    if (shape) {
      const drawing = icon(SHAPE_ICONS[shapeOf(garment)], 'garment-shape');
      drawing.style.color = color.hex;
      box.replaceChildren(drawing);
    } else {
      box.replaceChildren();
      box.style.background = color.hex;
    }
    if (!named) return;
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', `${garment.name}, ${color.name}`);
  };
  if (!url) {
    field();
    return box;
  }
  const image = remoteImage(url, 'garment-picture-img');
  if (named) image.alt = garment.name;
  image.addEventListener('error', field, { once: true });
  box.append(image);
  return box;
};

// The picture of a card or a look: with `colorOnly`, the short field of its colour (WAR-11).
export const smallPicture = (garment, variant, colorOnly) => {
  if (!colorOnly) return picture(garment, variant);
  const box = picture(garment, variant, null, { shape: false });
  box.classList.add('field');
  return box;
};

// The colours of a combination as equal blocks in one row.
export const strip = (colors) =>
  el('span', { className: 'strip' }, colors.map((id) => {
    const block = el('span', { className: 'strip-block' });
    block.style.background = colorOf(id).hex;
    return block;
  }));

export const seasonFilter = () => {
  const group = el('div', { className: 'cluster season-filter' }, SEASON_FILTERS.map((season) => {
    const button = el('button', { className: 'chip surface', type: 'button', textContent: t(`season.${season}`), onclick: () => {
      ui.season = season;
      render();
    } });
    button.setAttribute('aria-pressed', String(ui.season === season));
    return button;
  }));
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', t('wardrobe.season'));
  return group;
};

// The text colour on a field of one palette colour (PAL-5).
const inkOf = (colorId) => inkOn(colorOf(colorId).hex);

// A band of the colour of a garment, with its name and its hex.
export const colorBand = (colorId) => {
  const { name, hex } = colorOf(colorId);
  const band = el('div', { className: 'color-band' }, [el('span', { textContent: name }), el('span', { className: 'color-band-hex', textContent: hex })]);
  band.style.background = hex;
  band.dataset.ink = inkOf(colorId);
  return band;
};

// The colours of a combination as tall fields, each with its name and its hex (CMB-3).
export const colorFields = (colors) =>
  el('div', { className: 'color-fields' }, colors.map((id) => {
    const { name, hex } = colorOf(id);
    const field = el('div', { className: 'color-fields-item' }, [el('span', { textContent: name }), el('span', { className: 'color-fields-hex', textContent: hex })]);
    field.style.background = hex;
    field.dataset.ink = inkOf(id);
    return field;
  }));

// One outfit as a look: its number, the exact mark and the mark of the contrast band, then its
// garments side by side, a neutral that completion added marked as such (WAR-5).
// With `colorOnly`, each picture is the field of its colour (WAR-11).
export const look = (outfit, { colorOnly = false } = {}) =>
  el('li', { className: 'look' }, [
    el('div', { className: 'look-head' }, [
      el('span', { className: 'look-number', textContent: t('outfit.number', { number: outfit.combination }) }),
      ...(outfit.exact ? [el('span', { className: 'pill', textContent: t('outfit.exact') })] : []),
      ...(inBand(outfit.contrast, matching.contrast) ? [el('span', { className: 'pill', textContent: t(`outfit.contrast.${matching.contrast}`) })] : []),
    ]),
    el('ul', { className: 'look-row' }, outfit.picks.map(({ garment, added }) => el('li', { className: 'look-item' }, [
      smallPicture(garment, 'worn', colorOnly),
      el('span', { className: 'look-name', textContent: garment.name }),
      el('span', { className: 'look-color' }, [swatch(garment.color, 'dot'), colorOf(garment.color).name]),
      ...(added ? [el('span', { className: 'look-added', textContent: t('outfit.neutral') })] : []),
    ]))),
  ]);

// The cards of some outfits, or the text of none.
export const outfitList = (outfits, empty, options = {}) =>
  outfits.length ? el('ul', { className: 'outfits-list' }, outfits.map((outfit) => look(outfit, options))) : el('p', { className: 'empty-state inline', textContent: empty });

// The outfits of a detail, then the cards or the text of none (WAR-5). The head holds the title and
// the count, with the season filter under it; with `inline`, the head holds the title and the filter.
export const renderOutfits = (box, title, outfits, empty, { inline = false } = {}) => {
  const heading = el('h2', { className: 'outfits-title', textContent: title });
  if (inline) {
    box.replaceChildren(el('div', { className: 'outfits-head' }, [heading, seasonFilter()]), outfitList(outfits, empty));
    return;
  }
  const count = outfits.length ? [el('span', { className: 'outfits-count', textContent: t(countKey(outfits.length), { count: outfits.length }) })] : [];
  box.replaceChildren(el('div', { className: 'outfits-head' }, [heading, ...count]), seasonFilter(), outfitList(outfits, empty));
};
