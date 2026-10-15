import { mainImage } from '#garments';
import { colorOf, combination } from '#palette';
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

// The main image of a garment (GAR-7), or null when it has none. An image that does not load
// leaves the page, so the colour dot beside it stands alone.
export const thumb = (garment, variant = '') => {
  const url = mainImage(garment);
  if (!url) return null;
  const image = remoteImage(url, variant === 'small' ? 'thumb small' : 'thumb');
  image.addEventListener('error', () => image.remove(), { once: true });
  return image;
};

// The colours of a combination as equal blocks in one row.
export const strip = (colors) =>
  el('span', { className: 'strip' }, colors.map((id) => {
    const block = el('span', { className: 'strip-block' });
    block.style.background = colorOf(id).hex;
    return block;
  }));

// The colours of a combination as large blocks with their names, as the book shows them.
export const blocks = (colors) =>
  el('div', { className: 'blocks' }, colors.map((id) => el('div', { className: 'blocks-item' }, [
    swatch(id, 'large'),
    el('span', { className: 'blocks-name', textContent: colorOf(id).name }),
  ])));

const seasonFilter = () =>
  el('div', { className: 'segmented' }, SEASON_FILTERS.map((season) => {
    const button = el('button', { className: 'segment', type: 'button', textContent: t(`season.${season}`), onclick: () => {
      ui.season = season;
      render();
    } });
    button.setAttribute('aria-pressed', String(ui.season === season));
    return button;
  }));

const card = (outfit) =>
  el('li', { className: 'outfit' }, [
    el('div', { className: 'outfit-head' }, [
      el('span', { className: 'outfit-number', textContent: t('outfit.number', { number: outfit.combination }) }),
      strip(combination(outfit.combination)),
      ...(outfit.exact ? [el('span', { className: 'pill', textContent: t('outfit.exact') })] : []),
    ]),
    el('ul', { className: 'outfit-garments' }, outfit.picks.map(({ garment }) => el('li', { className: 'outfit-garment' }, [
      ...[thumb(garment, 'small')].filter(Boolean),
      swatch(garment.color, 'dot'),
      el('span', { textContent: garment.name }),
      el('small', { className: 'outfit-slot', textContent: t(`slot.${garment.slot}`) }),
    ]))),
  ]);

// The outfits of a detail: a title, the season filter, then the cards or the text of none.
export const renderOutfits = (box, title, outfits, empty) => {
  box.replaceChildren(
    el('h2', { className: 'outfits-title', textContent: title }),
    seasonFilter(),
    outfits.length ? el('ul', { className: 'outfits-list' }, outfits.map(card)) : el('p', { className: 'empty-state inline', textContent: empty }),
  );
};
