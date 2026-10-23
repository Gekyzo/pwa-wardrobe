import { COMBINATIONS, combination, combinationsBySize } from '#palette';
import { outfitsFor, whyNone, MAX_OUTFITS } from '#outfits';
import { $, el, ui, state, t, textOf, render } from '#ui/context';
import { strip, blocks, renderOutfits } from '#ui/outfit';

const SIZES = [null, 2, 3, 4];

// The outfits of each combination for one doc and one season filter. The list counts them at
// each render; a new doc or a new filter starts the cache again.
let cache = { garments: null, season: null, outfits: new Map() };
const outfitsOf = (number) => {
  if (cache.garments !== state.garments || cache.season !== ui.season) cache = { garments: state.garments, season: ui.season, outfits: new Map() };
  if (!cache.outfits.has(number)) cache.outfits.set(number, outfitsFor(number, state.garments, { season: ui.season }));
  return cache.outfits.get(number);
};

const countText = (count) => t(count >= MAX_OUTFITS ? 'combinations.countMax' : 'combinations.count', { count });

const openCombination = (number) => {
  ui.combination = number;
  render();
};

const row = ({ number, colors }) => {
  const name = el('button', { className: 'item-row-name', type: 'button', onclick: () => openCombination(number) }, [
    el('span', {}, [`${t('outfit.number', { number })} `, strip(colors)]),
    el('small', { className: 'item-row-meta', textContent: countText(outfitsOf(number).length) }),
  ]);
  return el('li', { className: 'item-row' }, [el('div', { className: 'item-row-body' }, [name])]);
};

const sizeChips = () =>
  SIZES.map((size) => {
    const chip = el('button', { className: 'chip surface', type: 'button', textContent: size ? t('combinations.size', { count: size }) : t('combinations.all'), onclick: () => {
      ui.size = size;
      render();
    } });
    chip.setAttribute('aria-pressed', String(ui.size === size));
    return chip;
  });

export const renderCombinations = () => {
  const visible = ui.view === 'combinations';
  $('combinations').hidden = !visible;
  if (!visible) return;
  $('combination-sizes').replaceChildren(...sizeChips());
  $('combination-wearable').checked = ui.wearable;
  const sized = new Set(combinationsBySize(ui.size));
  const rows = COMBINATIONS.filter(({ number }) => sized.has(number) && (!ui.wearable || outfitsOf(number).length > 0));
  $('combination-list').replaceChildren(...rows.map(row));
  $('combinations-empty').hidden = rows.length > 0;
  const colors = ui.combination === null ? null : combination(ui.combination);
  if (!colors) ui.combination = null;
  // The pane shows the detail alone below 840px, and beside the list from 840px (LAY-3).
  if (colors) $('combinations').dataset.detail = '';
  else delete $('combinations').dataset.detail;
  $('combination-detail-empty').hidden = Boolean(colors);
  $('combination-info').replaceChildren(...(colors ? [el('h2', { className: 'detail-head-title', textContent: t('outfit.number', { number: ui.combination }) }), blocks(colors)] : []));
  $('combination-outfits').hidden = !colors;
  if (colors) {
    const outfits = outfitsOf(ui.combination);
    const empty = outfits.length ? '' : textOf(whyNone(ui.combination, state.garments, { season: ui.season }));
    renderOutfits($('combination-outfits'), t('combinations.outfits'), outfits, empty);
  }
};

export const bind = () => {
  $('combination-back').addEventListener('click', () => openCombination(null));
  // Show all clears both filters (CMB-2).
  $('combinations-all').addEventListener('click', () => {
    ui.size = null;
    ui.wearable = false;
    render();
  });
  $('combination-wearable').addEventListener('change', (event) => {
    ui.wearable = event.target.checked;
    render();
  });
};
