import { COMBINATIONS, combination, combinationsBySize } from '#palette';
import { whyNone, countKey } from '#outfits';
import { $, el, ui, state, t, textOf, render } from '#ui/context';
import { strip, colorFields, renderOutfits, outfitsOf } from '#ui/outfit';

const SIZES = [null, 2, 3, 4];

const countText = (count) => t(countKey(count), { count });

const openCombination = (number) => {
  ui.combination = number;
  render();
};

// A row: the number, its colours as one bar, and the count of its outfits (CMB-1).
const row = ({ number, colors }) => {
  const button = el('button', { className: 'combo-row', type: 'button', onclick: () => openCombination(number) }, [
    el('span', { className: 'combo-row-number', textContent: t('outfit.number', { number }) }),
    strip(colors),
    el('span', { className: 'combo-row-count', textContent: countText(outfitsOf(number).length) }),
  ]);
  if (number === ui.combination) button.setAttribute('aria-current', 'true');
  return el('li', { className: 'combo-list-item' }, [button]);
};

// The head of a detail: the number and the count of its colours (CMB-3).
const head = (number, colors) =>
  el('div', { className: 'combo-head' }, [
    el('h2', { className: 'combo-head-title', textContent: t('outfit.number', { number }) }),
    el('span', { className: 'combo-head-count', textContent: t('combinations.size', { count: colors.length }) }),
  ]);

const sizeChips = () =>
  SIZES.map((size) => {
    const chip = el('button', { className: 'chip', type: 'button', textContent: size ? t('combinations.size', { count: size }) : t('combinations.all'), onclick: () => {
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
  $('combination-info').replaceChildren(...(colors ? [head(ui.combination, colors), colorFields(colors)] : []));
  $('combination-outfits').hidden = !colors;
  if (colors) {
    const outfits = outfitsOf(ui.combination);
    const empty = outfits.length ? '' : textOf(whyNone(ui.combination, state.garments, { season: ui.season }));
    renderOutfits($('combination-outfits'), t('combinations.outfits'), outfits, empty, { inline: true });
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
