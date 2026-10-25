import {
  FITS,
  addFitting,
  editFitting,
  deleteFitting,
  findFitting,
  groupFittings,
  categoriesOf,
  brandsOf,
  measuresOf,
  matches,
} from '#fittings';
import { bindSheetDrag } from '#ds/sheet';
import { settle } from '#swipe';
import { SIDE_BUTTON, DRAG_START, $, el, ui, state, t, lang, apply, render, guardClick } from '#ui/context';
import { icon, iconButton } from '#ui/controls';

// The units that the sheet offers before the doc has its own.
const UNITS = ['cm', 'mm', 'in', 'EU', 'US', 'UK'];

const number = (value, grouping = true) =>
  new Intl.NumberFormat(lang, { maximumFractionDigits: 3, useGrouping: grouping }).format(value);

const measureText = ({ name, value, unit }) => `${name} ${number(value)}${unit ? ` ${unit}` : ''}`;

// The title of a fitting: its brand and size, or the category when it has neither.
const titleOf = (fitting) => [fitting.brand, fitting.size].filter(Boolean).join(' · ') || fitting.category;

const fitPill = (fit) => (fit ? el('span', { className: fit === 'good' ? 'pill' : 'pill ghost', textContent: t(`fit.${fit}`) }) : null);

const fillList = (id, values) => $(id).replaceChildren(...values.map((value) => el('option', { value })));

// One line of the measures of the sheet: name, value and unit, and a button that removes it.
const measureLine = ({ name = '', value = '', unit = '' } = {}) => {
  const input = (props) => el('input', { type: 'text', ...props });
  const nameInput = input({ className: 'input measure-line-name', value: name, maxLength: 30, placeholder: t('fittings.measureName') });
  nameInput.setAttribute('list', 'fitting-measure-names');
  nameInput.setAttribute('aria-label', t('fittings.measureName'));
  const valueInput = input({
    className: 'input measure-line-value',
    value: value === '' ? '' : number(value, false),
    inputMode: 'decimal',
    placeholder: t('fittings.measureValue'),
  });
  valueInput.setAttribute('aria-label', t('fittings.measureValue'));
  const unitInput = input({ className: 'input measure-line-unit', value: unit, maxLength: 10, placeholder: t('fittings.unit') });
  unitInput.setAttribute('list', 'fitting-units');
  unitInput.setAttribute('aria-label', t('fittings.unit'));
  const line = el('div', { className: 'measure-line' }, [nameInput, valueInput, unitInput]);
  const remove = el('button', { className: 'button icon', type: 'button', onclick: () => line.remove() }, [icon('trash')]);
  remove.setAttribute('aria-label', t('fittings.removeMeasure'));
  line.append(remove);
  return line;
};

const readMeasures = () =>
  [...$('fitting-measures').querySelectorAll('.measure-line')].map((line) => ({
    name: line.querySelector('.measure-line-name').value,
    value: line.querySelector('.measure-line-value').value,
    unit: line.querySelector('.measure-line-unit').value,
  }));

const showFit = () => {
  $('fitting-fit').replaceChildren(
    ...FITS.map((fit) => {
      const chip = el('button', { className: 'chip', type: 'button', textContent: t(`fit.${fit || 'unknown'}`) });
      chip.setAttribute('aria-pressed', String(ui.draftFit === fit));
      chip.addEventListener('click', () => {
        ui.draftFit = fit;
        showFit();
      });
      return chip;
    }),
  );
};

// A new fitting of a category in use, with no measure written yet, gets the measure lines of
// that category, empty.
const offerMeasures = () => {
  if (ui.editing) return;
  if (readMeasures().some((line) => line.name.trim() || line.value.trim())) return;
  const known = measuresOf(state.fittings, $('fitting-category').value);
  if (known.length) $('fitting-measures').replaceChildren(...known.map(({ name, unit }) => measureLine({ name, unit })));
};

// `from` fills the sheet; `id` is the fitting that it edits, null for a new one.
const openSheet = ({ id = null, from = null } = {}) => {
  ui.sheet = 'fitting';
  ui.editing = id;
  ui.draftFit = from?.fit ?? '';
  $('fitting-sheet-title').textContent = t(id ? 'fittings.editTitle' : 'fittings.new');
  $('fitting-category').value = from?.category ?? (id ? '' : ui.category ?? '');
  $('fitting-brand').value = from?.brand ?? '';
  $('fitting-size').value = from?.size ?? '';
  $('fitting-note').value = from?.note ?? '';
  const lines = from?.measures.length ? from.measures : [{}];
  $('fitting-measures').replaceChildren(...lines.map(measureLine));
  fillList('fitting-categories', categoriesOf(state.fittings));
  fillList('fitting-brands', brandsOf(state.fittings));
  const measures = state.fittings.flatMap((fitting) => fitting.measures);
  fillList('fitting-measure-names', [...new Set(measures.map((measure) => measure.name))].sort());
  fillList('fitting-units', [...new Set([...measures.map((measure) => measure.unit).filter(Boolean), ...UNITS])]);
  showFit();
  if (!from) offerMeasures();
  render();
  $(from ? 'fitting-brand' : 'fitting-category').focus();
};

export const closeFittingSheet = () => {
  ui.sheet = null;
  ui.editing = null;
  render();
};

const openFitting = (id) => {
  ui.fittingId = id;
  render();
};

const remove = (id) => {
  if (ui.fittingId === id) ui.fittingId = null;
  apply(deleteFitting(state, id), { undoText: t('toast.fittingDeleted') });
};

const moveRow = (row, x) => {
  row.style.transform = x ? `translateX(${x}px)` : '';
};

// Lets a horizontal drag of the row show the side actions behind it (`settle` decides).
const bindSwipe = (row, width, id) => {
  let drag = null;
  row.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, base: ui.openId === id ? -width : 0, active: false };
  });
  row.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(dy) > DRAG_START && Math.abs(dy) >= Math.abs(dx)) drag = null;
      if (!drag || Math.abs(dx) < DRAG_START) return;
      drag.active = true;
      row.setPointerCapture(event.pointerId);
      row.classList.add('dragging');
    }
    drag.at = Math.max(-width, Math.min(0, drag.base + dx));
    moveRow(row, drag.at);
  });
  const finish = (event) => {
    if (!drag) return;
    const { active, x, at } = drag;
    drag = null;
    if (!active) return;
    // The click that follows a drag must not open the fitting.
    guardClick();
    const side = settle(event.clientX - x, { start: 0, end: width }, ui.openId === id ? 'end' : null);
    ui.openId = side ? id : null;
    ui.settleFrom = { id, x: at };
    render();
  };
  row.addEventListener('pointerup', finish);
  row.addEventListener('pointercancel', finish);
};

// A row slides left to show Delete (FIT-10).
const row = (fitting) => {
  const open = ui.openId === fitting.id;
  const title = titleOf(fitting);
  const actions = [iconButton('trash', t('row.delete', { text: title }), () => remove(fitting.id), { variant: 'danger' })];
  const width = actions.length * SIDE_BUTTON;
  const meta = fitting.measures.map(measureText).join(' · ') || fitting.note;
  const name = el('button', { className: 'item-row-name', type: 'button', tabIndex: -1, onclick: () => openFitting(fitting.id) }, [
    el('span', { textContent: title }),
    ...(meta ? [el('small', { className: 'item-row-meta', textContent: meta })] : []),
  ]);
  const body = el('div', { className: 'item-row-body' }, [name, ...[fitPill(fitting.fit)].filter(Boolean)]);
  const from = ui.settleFrom?.id === fitting.id ? ui.settleFrom.x : null;
  if (from !== null) {
    // Start where the drag ended, then move to the settled place with the CSS transition.
    moveRow(body, from);
    requestAnimationFrame(() => requestAnimationFrame(() => moveRow(body, open ? -width : 0)));
  } else moveRow(body, open ? -width : 0);
  bindSwipe(body, width, fitting.id);
  const box = el('div', { className: open ? 'item-row-swipe open' : 'item-row-swipe' }, [
    el('div', { className: 'item-row-actions', inert: !open }, actions),
    body,
  ]);
  const node = el('li', { className: 'item-row' }, [box]);
  node.dataset.id = fitting.id;
  return node;
};

const groupHead = ({ category, fittings }) =>
  el('li', { className: 'group-head' }, [el('span', { textContent: category }), el('span', { textContent: String(fittings.length) })]);

// The chips of the categories, when there are two or more: All, then each category.
const renderCategories = (categories) => {
  const chip = (label, value) => {
    const button = el('button', { className: 'chip', type: 'button', textContent: label, onclick: () => {
      ui.category = value;
      render();
    } });
    button.setAttribute('aria-pressed', String(ui.category === value));
    return button;
  };
  $('fittings-categories').hidden = categories.length < 2;
  $('fittings-categories').replaceChildren(chip(t('fittings.all'), null), ...categories.map((category) => chip(category, category)));
};

const fact = (term, value) => [el('dt', { textContent: term }), el('dd', {}, [value])];

const info = (fitting) => {
  const facts = [
    ...fact(t('fittings.category'), fitting.category),
    ...(fitting.brand ? fact(t('fittings.brand'), fitting.brand) : []),
    ...(fitting.size ? fact(t('fittings.size'), fitting.size) : []),
    ...(fitting.fit ? fact(t('fittings.fit'), fitPill(fitting.fit)) : []),
    ...fitting.measures.flatMap(({ name, value, unit }) => fact(name, `${number(value)}${unit ? ` ${unit}` : ''}`)),
    ...(fitting.note ? fact(t('fittings.note'), fitting.note) : []),
  ];
  return [el('h2', { className: 'fitting-info-title', textContent: titleOf(fitting) }), el('dl', { className: 'fitting-info-facts' }, facts)];
};

export const renderFittings = () => {
  const visible = ui.view === 'fittings';
  $('fittings').hidden = !visible;
  if (ui.openId && !findFitting(state, ui.openId)) ui.openId = null;
  const categories = categoriesOf(state.fittings);
  if (ui.category !== null && !categories.includes(ui.category)) ui.category = null;
  const any = state.fittings.length > 0;
  $('fittings-filter').hidden = !any;
  renderCategories(categories);
  const shown = state.fittings.filter(
    (fitting) => (ui.category === null || fitting.category.toLowerCase() === ui.category.toLowerCase()) && matches(fitting, ui.query),
  );
  $('fitting-list').replaceChildren(...groupFittings(shown).flatMap((group) => [groupHead(group), ...group.fittings.map(row)]));
  ui.settleFrom = null;
  $('fittings-empty').hidden = any;
  $('fittings-none').hidden = !any || shown.length > 0;
  const fitting = ui.fittingId === null ? null : findFitting(state, ui.fittingId);
  if (!fitting) ui.fittingId = null;
  // The pane shows the detail alone below 840px, and beside the list from 840px (LAY-3).
  if (fitting) $('fittings').dataset.detail = '';
  else delete $('fittings').dataset.detail;
  $('fitting-info').replaceChildren(...(fitting ? info(fitting) : []));
  $('fitting-detail-empty').hidden = Boolean(fitting);
  $('fitting-actions').hidden = !fitting;
  $('fitting-sheet').hidden = ui.sheet !== 'fitting';
};

export const bind = () => {
  $('fab').addEventListener('click', () => {
    if (ui.view === 'fittings') openSheet();
  });
  $('fittings-add').addEventListener('click', () => openSheet());
  $('fitting-veil').addEventListener('click', closeFittingSheet);
  $('fitting-close').addEventListener('click', closeFittingSheet);
  bindSheetDrag($('fitting-sheet'), { close: closeFittingSheet });
  $('fitting-back').addEventListener('click', () => openFitting(null));
  $('fitting-edit').addEventListener('click', () => openSheet({ id: ui.fittingId, from: findFitting(state, ui.fittingId) }));
  $('fitting-duplicate').addEventListener('click', () => openSheet({ from: findFitting(state, ui.fittingId) }));
  $('fitting-delete').addEventListener('click', () => remove(ui.fittingId));
  $('fitting-measure-add').addEventListener('click', () => {
    const line = measureLine();
    $('fitting-measures').append(line);
    line.querySelector('input').focus();
  });
  $('fitting-category').addEventListener('change', offerMeasures);
  $('fittings-search').addEventListener('input', (event) => {
    ui.query = event.target.value;
    render();
  });
  $('fitting-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const fields = {
      category: $('fitting-category').value,
      brand: $('fitting-brand').value,
      size: $('fitting-size').value,
      fit: ui.draftFit,
      measures: readMeasures(),
      note: $('fitting-note').value,
    };
    const result = ui.editing ? editFitting(state, ui.editing, fields) : addFitting(state, fields);
    if (apply(result)) closeFittingSheet();
  });
  // src/ui/wardrobe.js closes an open row on a tap out of it, for the rows of each list.
};
