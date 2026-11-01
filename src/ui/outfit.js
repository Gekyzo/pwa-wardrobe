import { mainImage } from '#garments';
import { colorOf, inkOn } from '#palette';
import { SEASON_FILTERS } from '#outfits';
import { el, ui, t, render } from '#ui/context';

// A block of one palette colour.
export const swatch = (colorId, variant = '') => {
  const node = el('span', { className: variant === 'dot' ? 'swatch dot' : variant === 'large' ? 'swatch large' : 'swatch' });
  node.style.background = colorOf(colorId).hex;
  return node;
};

// A remote image: no referrer, since some shops refuse a request from another site.
export const remoteImage = (src, className) => el('img', { className, referrerPolicy: 'no-referrer', loading: 'lazy', decoding: 'async', alt: '', src });

// The picture of a garment: its main image (GAR-7), or `url`, on the photo ground, or a field of
// its colour when it has none or when the image fails to load. `variant` is card, hero or look. A
// card and a look have the name and the colour as text beside the picture, so there the picture
// is hidden from a screen reader; the hero names the garment and its colour.
export const picture = (garment, variant, url = mainImage(garment)) => {
  const figure = el('figure', { className: variant === 'hero' ? 'garment-picture hero' : variant === 'look' ? 'garment-picture look' : 'garment-picture card' });
  const named = variant === 'hero';
  if (!named) figure.setAttribute('aria-hidden', 'true');
  const field = () => {
    const color = colorOf(garment.color);
    figure.replaceChildren();
    figure.style.background = color.hex;
    if (!named) return;
    figure.setAttribute('role', 'img');
    figure.setAttribute('aria-label', `${garment.name}, ${color.name}`);
  };
  if (!url) {
    field();
    return figure;
  }
  const image = remoteImage(url, 'garment-picture-img');
  if (named) image.alt = garment.name;
  image.addEventListener('error', field, { once: true });
  figure.append(image);
  return figure;
};

// The colours of a combination as equal blocks in one row.
export const strip = (colors) =>
  el('span', { className: 'strip' }, colors.map((id) => {
    const block = el('span', { className: 'strip-block' });
    block.style.background = colorOf(id).hex;
    return block;
  }));

export const seasonFilter = () =>
  el('div', { className: 'segmented' }, SEASON_FILTERS.map((season) => {
    const button = el('button', { className: 'segment', type: 'button', textContent: t(`season.${season}`), onclick: () => {
      ui.season = season;
      render();
    } });
    button.setAttribute('aria-pressed', String(ui.season === season));
    return button;
  }));

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

// One outfit as a look: its number and the exact mark, then its garments side by side (WAR-5).
export const look = (outfit) =>
  el('li', { className: 'look' }, [
    el('div', { className: 'look-head' }, [
      el('span', { className: 'look-number', textContent: t('outfit.number', { number: outfit.combination }) }),
      ...(outfit.exact ? [el('span', { className: 'pill', textContent: t('outfit.exact') })] : []),
    ]),
    el('ul', { className: 'look-row' }, outfit.picks.map(({ garment }) => el('li', { className: 'look-item' }, [
      picture(garment, 'look'),
      el('span', { className: 'look-name', textContent: garment.name }),
      el('span', { className: 'look-color' }, [swatch(garment.color, 'dot'), colorOf(garment.color).name]),
    ]))),
  ]);

// The cards of some outfits, or the text of none.
export const outfitList = (outfits, empty) =>
  outfits.length ? el('ul', { className: 'outfits-list' }, outfits.map(look)) : el('p', { className: 'empty-state inline', textContent: empty });

// The outfits of a detail: a title, the season filter, then the cards or the text of none.
export const renderOutfits = (box, title, outfits, empty) => {
  box.replaceChildren(el('h2', { className: 'outfits-title', textContent: title }), seasonFilter(), outfitList(outfits, empty));
};
