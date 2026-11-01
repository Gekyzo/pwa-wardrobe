import { fillSuggestions } from '#fill';
import { MATCH_MAX, MAX_OUTFITS } from '#outfits';
import { colorOf, combination, distance } from '#palette';
import { $, el, ui, state, t } from '#ui/context';
import { swatch, strip, seasonFilter, outfitsOf } from '#ui/outfit';
import { openNewGarment } from '#ui/wardrobe';

// The palettes that a Wada row shows (FIL-7).
const SHOWN_PALETTES = 3;

// The list of one doc and one season filter, computed once for each.
let cache = { garments: null, season: null, list: [] };
export const fillNow = () => {
  if (cache.garments !== state.garments || cache.season !== ui.season) {
    cache = { garments: state.garments, season: ui.season, list: fillSuggestions(state.garments, { season: ui.season, of: (n) => outfitsOf(n) }) };
  }
  return cache.list;
};

const nameOf = (s) => (s.kind === 'basic'
  ? t(`basic.${s.basic}`)
  : t('fill.wadaName', { slot: t(`slot.${s.slot}`), color: colorOf(s.color).name }));

// One palette that a Wada row completes: its number and its colours, the added one outlined.
const palette = (number, color) => {
  const bar = strip(combination(number));
  [...bar.children].forEach((block, i) => block.classList.toggle('new', distance(combination(number)[i], color) <= MATCH_MAX));
  return el('span', { className: 'fill-palette' }, [el('span', { textContent: t('outfit.number', { number }) }), bar]);
};

// A row: a tap opens a new garment filled with it (FIL-7).
const row = (s) => {
  const name = nameOf(s);
  const open = () => openNewGarment({ name, slot: s.slot, season: s.season, color: s.color });
  const tag = s.kind === 'basic' ? t('fill.basic') : t('fill.completes', { count: s.completes.length });
  return el('li', { className: 'basics-panel-row' }, [el('button', { className: 'basics-panel-item fill-item', type: 'button', onclick: open }, [
    swatch(s.color),
    el('span', { className: 'basics-panel-name', textContent: name }),
    ...(s.gain > 0 ? [el('span', { className: 'fill-gain', textContent: t(s.gain >= MAX_OUTFITS ? 'fill.gainMax' : 'fill.gain', { count: s.gain }) })] : []),
    el('span', { className: 'basics-panel-meta', textContent: [t(`slot.${s.slot}`), t(`season.${s.season}`)].join(' · ') }),
    el('span', { className: s.kind === 'basic' ? 'fill-tag' : 'fill-tag wada', textContent: tag }),
    ...(s.completes.length ? [el('span', { className: 'fill-palettes' }, s.completes.slice(0, SHOWN_PALETTES).map((n) => palette(n, s.color)))] : []),
  ])]);
};

export const renderFill = () => {
  const visible = ui.view === 'fill';
  $('fill').hidden = !visible;
  const list = visible ? fillNow() : [];
  $('fill-filter').replaceChildren(...(visible ? [seasonFilter()] : []));
  $('fill-list').replaceChildren(...list.map(row));
  $('fill-empty').hidden = !visible || list.length > 0;
};
