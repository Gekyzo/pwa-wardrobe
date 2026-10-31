import { addGarment, editGarment, deleteGarment, findGarment, sortGarments, brandsOf, toggleImage, makeMain, isWebUrl, SLOTS, SEASONS } from '#garments';
import { bindSheetDrag } from '#ds/sheet';
import { loadPageImages } from '#links';
import { COLORS, colorOf, nearestColor, parseColor } from '#palette';
import { outfitsWith, outfitKey, randomOutfit } from '#outfits';
import { FITS, measuresOf } from '#measures';
import { suggestBrands } from '#brands';
import { settle } from '#swipe';
import { SIDE_BUTTON, DRAG_START, $, el, ui, state, t, lang, textOf, apply, render, guardClick, showToast } from '#ui/context';
import { icon, iconButton } from '#ui/controls';
import { swatch, thumb, remoteImage, renderOutfits } from '#ui/outfit';

const options = (select, values, prefix, chosen) =>
  select.replaceChildren(...values.map((value) => el('option', { value, textContent: t(`${prefix}.${value}`), selected: value === chosen })));

// Shows the colour of the sheet: its name, its place in the grid and, from a pick, the input.
const showColor = ({ fromInput = false } = {}) => {
  const color = ui.draftColor === null ? null : colorOf(ui.draftColor);
  $('garment-color-name').textContent = color ? color.name : t('wardrobe.colorNone');
  if (color && !fromInput) $('garment-color-input').value = color.hex;
  $('garment-swatches').querySelectorAll('[data-color]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.color) === ui.draftColor));
  });
};

const clearColorText = () => {
  $('garment-color-text').value = '';
  $('garment-color-text').removeAttribute('aria-invalid');
};

// The Load images button: on for an http or https link, while no load runs.
const showLoad = () => {
  const button = $('garment-load');
  button.disabled = ui.loadingImages || !isWebUrl($('garment-link').value.trim());
  button.textContent = t(ui.loadingImages ? 'wardrobe.loading' : 'wardrobe.loadImages');
};

// The grid of the images that the sheet offers: a tap keeps or drops one; the star of a kept one
// makes it the main image (WAR-6).
const showImages = () => {
  const grid = $('garment-images');
  grid.hidden = ui.candidates.length === 0;
  grid.replaceChildren(...ui.candidates.map((url, index) => {
    const kept = ui.draftImages.includes(url);
    const pick = el('button', { className: 'image-grid-pick', type: 'button', onclick: () => {
      const { images, error } = toggleImage(ui.draftImages, url);
      if (error) showToast(textOf(error));
      ui.draftImages = images;
      showImages();
    } }, [remoteImage(url, 'image-grid-img')]);
    pick.setAttribute('aria-pressed', String(kept));
    pick.setAttribute('aria-label', t('wardrobe.image', { number: index + 1 }));
    const item = el('div', { className: 'image-grid-item' }, [pick]);
    if (kept) {
      const main = ui.draftImages[0] === url;
      const star = el('button', { className: 'button icon toggle image-grid-main', type: 'button', onclick: () => {
        ui.draftImages = makeMain(ui.draftImages, url);
        showImages();
      } }, [icon('star')]);
      star.setAttribute('aria-pressed', String(main));
      star.setAttribute('aria-label', t(main ? 'wardrobe.main' : 'wardrobe.setMain'));
      item.append(star);
    }
    // An image that does not load is not offered.
    pick.firstChild.addEventListener('error', () => {
      if (!kept) item.hidden = true;
    });
    return item;
  }));
};

const offer = (urls) => {
  ui.candidates = [...new Set([...ui.candidates, ...urls])];
  showImages();
};

const loadImages = async () => {
  const link = $('garment-link').value.trim();
  ui.loadingImages = true;
  showLoad();
  const result = await loadPageImages(link);
  ui.loadingImages = false;
  if (!ui.sheetOpen) return;
  showLoad();
  if (result.error) showToast(textOf(result.error));
  else offer(result.images);
};

const addImageUrl = () => {
  const url = $('garment-image-url').value.trim();
  if (!isWebUrl(url)) {
    showToast(t('error.imagesInvalid'));
    return;
  }
  $('garment-image-url').value = '';
  const { images, error } = ui.draftImages.includes(url) ? { images: ui.draftImages } : toggleImage(ui.draftImages, url);
  if (error) showToast(textOf(error));
  ui.draftImages = images;
  offer([url]);
};

// The units that the sheet offers before the wardrobe has its own.
const UNITS = ['cm', 'mm', 'in', 'EU', 'US', 'UK'];

const number = (value, grouping = true) =>
  new Intl.NumberFormat(lang, { maximumFractionDigits: 3, useGrouping: grouping }).format(value);

// The price in euros, and a day or an instant, in the format of the language (WAR-4).
const money = (value) => new Intl.NumberFormat(lang, { style: 'currency', currency: 'EUR' }).format(value);
const day = (date) => new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(date);
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

const fitPill = (fit) => el('span', { className: fit === 'good' ? 'pill' : 'pill ghost', textContent: t(`fit.${fit}`) });

const fillList = (id, values) => $(id).replaceChildren(...values.map((value) => el('option', { value })));

// The brands that start with the text of the brand field, none while it is empty (WAR-3).
const showBrands = () => fillList('garment-brands', suggestBrands(brandsOf(state.garments), $('garment-brand').value));

// One line of the measures of the sheet: name, value and unit, and a button that removes it.
const measureLine = ({ name = '', value = '', unit = '' } = {}) => {
  const input = (props, list, label) => {
    const node = el('input', { type: 'text', placeholder: t(label), ...props });
    if (list) node.setAttribute('list', list);
    node.setAttribute('aria-label', t(label));
    return node;
  };
  const line = el('div', { className: 'measure-line' }, [
    input({ className: 'input measure-line-name', value: name, maxLength: 30 }, 'garment-measure-names', 'wardrobe.measureName'),
    input({ className: 'input measure-line-value', value: value === '' ? '' : number(value, false), inputMode: 'decimal' }, null, 'wardrobe.measureValue'),
    input({ className: 'input measure-line-unit', value: unit, maxLength: 10 }, 'garment-units', 'wardrobe.unit'),
  ]);
  const remove = el('button', { className: 'button icon', type: 'button', onclick: () => line.remove() }, [icon('trash')]);
  remove.setAttribute('aria-label', t('wardrobe.removeMeasure'));
  line.append(remove);
  return line;
};

const readMeasures = () =>
  [...$('garment-measures').querySelectorAll('.measure-line')].map((line) => ({
    name: line.querySelector('.measure-line-name').value,
    value: line.querySelector('.measure-line-value').value,
    unit: line.querySelector('.measure-line-unit').value,
  }));

// The icon of each fit: '' is not said.
const FIT_ICONS = { '': 'fit-unknown', good: 'check-circle', small: 'fit-small', large: 'fit-large' };

// The fits as one segmented control, an icon over a short label (WAR-3).
const showFit = () => {
  $('garment-fit').replaceChildren(
    ...FITS.map((fit) => {
      const segment = el('button', { className: 'segment', type: 'button' }, [
        icon(FIT_ICONS[fit]),
        el('span', { className: 'fit-pick-label', textContent: t(`fit.${fit || 'unknown'}`) }),
      ]);
      segment.setAttribute('aria-pressed', String(ui.draftFit === fit));
      segment.addEventListener('click', () => {
        ui.draftFit = fit;
        showFit();
      });
      return segment;
    }),
  );
};

// A new garment of a slot in use, with no measure written yet, gets the measure lines of that
// slot, empty (WAR-8).
const offerMeasures = () => {
  if (ui.editing) return;
  if (readMeasures().some((line) => line.name.trim() || line.value.trim())) return;
  const known = measuresOf(state.garments, $('garment-slot').value);
  $('garment-measures').replaceChildren(...(known.length ? known : [{}]).map(measureLine));
};

const openSheet = (id = null) => {
  const garment = id ? findGarment(state, id) : null;
  ui.sheetOpen = true;
  ui.editing = id;
  ui.draftColor = garment?.color ?? null;
  clearColorText();
  $('garment-sheet-title').textContent = t(id ? 'wardrobe.editTitle' : 'wardrobe.new');
  $('garment-name').value = garment?.name ?? '';
  $('garment-brand').value = garment?.brand ?? '';
  $('garment-reference').value = garment?.reference ?? '';
  showBrands();
  $('garment-link').value = garment?.link ?? '';
  $('garment-image-url').value = '';
  ui.draftImages = [...(garment?.images ?? [])];
  ui.candidates = [...ui.draftImages];
  ui.loadingImages = false;
  showLoad();
  showImages();
  options($('garment-slot'), SLOTS, 'slot', garment?.slot ?? 'top');
  options($('garment-season'), SEASONS, 'season', garment?.season ?? 'all');
  showColor();
  $('garment-buy-date').value = garment ? garment.buy_date : today();
  $('garment-buy-date').max = today();
  $('garment-price').value = garment?.price == null ? '' : number(garment.price, false);
  $('garment-size').value = garment?.size ?? '';
  ui.draftFit = garment?.fit ?? '';
  showFit();
  $('garment-measures').replaceChildren(...(garment?.measures.length ? garment.measures : [{}]).map(measureLine));
  const measures = state.garments.flatMap((each) => each.measures);
  fillList('garment-measure-names', [...new Set(measures.map((measure) => measure.name))].sort());
  fillList('garment-units', [...new Set([...measures.map((measure) => measure.unit).filter(Boolean), ...UNITS])]);
  offerMeasures();
  render();
  $('garment-name').focus();
};

export const closeGarmentSheet = () => {
  ui.sheetOpen = false;
  ui.editing = null;
  render();
};

const openGarment = (id) => {
  ui.garmentId = id;
  ui.detailImage = null;
  ui.random = null;
  render();
};

// A pick for the doc and the season filter in view; a change of either picks again (WAR-9).
const pickRandom = (except = null) => {
  ui.random = { garments: state.garments, season: ui.season, outfit: randomOutfit(state.garments, { season: ui.season, except }) };
};

// Opens the random outfit, or picks another one than the outfit in view.
const openRandom = () => {
  ui.garmentId = null;
  pickRandom(ui.random?.outfit ? outfitKey(ui.random.outfit) : null);
  render();
};

const remove = (id) => {
  if (ui.garmentId === id) ui.garmentId = null;
  apply(deleteGarment(state, id), { undoText: t('toast.garmentDeleted') });
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
    // The click that follows a drag must not open the garment.
    guardClick();
    const side = settle(event.clientX - x, { start: 0, end: width }, ui.openId === id ? 'end' : null);
    ui.openId = side ? id : null;
    ui.settleFrom = { id, x: at };
    render();
  };
  row.addEventListener('pointerup', finish);
  row.addEventListener('pointercancel', finish);
};

const metaOf = (garment) =>
  [t(`slot.${garment.slot}`), t(`season.${garment.season}`), garment.brand, garment.size && t('wardrobe.sizeShort', { size: garment.size })]
    .filter(Boolean)
    .join(' · ');

const fact = (term, value) => [el('dt', { textContent: term }), el('dd', {}, [value])];

// The reference, the fit, each measure, the price, the buy date and the creation date of a garment, when it has
// one (WAR-4); the size is in the meta.
const facts = (garment) => {
  const list = [
    ...(garment.reference ? fact(t('wardrobe.reference'), garment.reference) : []),
    ...(garment.fit ? fact(t('wardrobe.fit'), fitPill(garment.fit)) : []),
    ...garment.measures.flatMap(({ name, value, unit }) => fact(name, `${number(value)}${unit ? ` ${unit}` : ''}`)),
    ...(garment.price != null ? fact(t('wardrobe.price'), money(garment.price)) : []),
    ...(garment.buy_date ? fact(t('wardrobe.buyDate'), day(new Date(`${garment.buy_date}T12:00:00`))) : []),
    ...(garment.creation_date ? fact(t('wardrobe.added'), day(new Date(garment.creation_date))) : []),
  ];
  return list.length ? [el('dl', { className: 'garment-facts' }, list)] : [];
};

// A row slides left to show Delete (WAR-2).
const row = (garment) => {
  const open = ui.openId === garment.id;
  const actions = [iconButton('trash', t('row.delete', { text: garment.name }), () => remove(garment.id), { variant: 'danger' })];
  const width = actions.length * SIDE_BUTTON;
  const name = el('button', { className: 'item-row-name', type: 'button', tabIndex: -1, onclick: () => openGarment(garment.id) }, [
    el('span', {}, [swatch(garment.color, 'dot'), ` ${garment.name}`]),
    el('small', { className: 'item-row-meta', textContent: metaOf(garment) }),
  ]);
  const body = el('div', { className: 'item-row-body' }, [...[thumb(garment)].filter(Boolean), name]);
  const from = ui.settleFrom?.id === garment.id ? ui.settleFrom.x : null;
  if (from !== null) {
    // Start where the drag ended, then move to the settled place with the CSS transition.
    moveRow(body, from);
    requestAnimationFrame(() => requestAnimationFrame(() => moveRow(body, open ? -width : 0)));
  } else moveRow(body, open ? -width : 0);
  bindSwipe(body, width, garment.id);
  const box = el('div', { className: open ? 'item-row-swipe open' : 'item-row-swipe' }, [
    el('div', { className: 'item-row-actions', inert: !open }, actions),
    body,
  ]);
  const node = el('li', { className: 'item-row' }, [box]);
  node.dataset.id = garment.id;
  return node;
};

// The images of a detail: one large, and the others below it; a tap on one shows it large.
const gallery = (garment) => {
  if (!garment.images.length) return [];
  const shown = garment.images.includes(ui.detailImage) ? ui.detailImage : garment.images[0];
  const large = remoteImage(shown, 'thumb large');
  large.addEventListener('error', () => large.remove(), { once: true });
  if (garment.images.length === 1) return [large];
  const others = garment.images.map((url, index) => {
    const button = el('button', { className: 'image-strip-item', type: 'button', onclick: () => {
      ui.detailImage = url;
      render();
    } }, [remoteImage(url, 'image-grid-img')]);
    button.setAttribute('aria-pressed', String(url === shown));
    button.setAttribute('aria-label', t('wardrobe.image', { number: index + 1 }));
    return button;
  });
  return [large, el('div', { className: 'image-strip' }, others)];
};

const info = (garment) => [
  ...gallery(garment),
  swatch(garment.color, 'large'),
  el('h2', { className: 'detail-head-title', textContent: garment.name }),
  el('p', { className: 'detail-head-meta', textContent: `${colorOf(garment.color).name} · ${metaOf(garment)}` }),
  ...facts(garment),
];

export const renderWardrobe = () => {
  const visible = ui.view === 'wardrobe';
  $('wardrobe').hidden = !visible;
  $('fab').hidden = !visible || ui.sheetOpen;
  if (ui.openId && !findGarment(state, ui.openId)) ui.openId = null;
  $('garment-list').replaceChildren(...sortGarments(state.garments).map(row));
  ui.settleFrom = null;
  $('wardrobe-empty').hidden = state.garments.length > 0;
  $('wardrobe-random').hidden = state.garments.length === 0;
  // From 600px the add is the button of the header (NAV-6), and the fab is hidden there. The add of
  // the empty state replaces it.
  $('header-add').hidden = $('fab').hidden || !$('wardrobe-empty').hidden;
  const garment = ui.garmentId === null ? null : findGarment(state, ui.garmentId);
  if (!garment) ui.garmentId = null;
  if (ui.random && (ui.random.garments !== state.garments || ui.random.season !== ui.season)) pickRandom();
  const random = garment ? null : ui.random;
  // The pane shows the detail alone below 840px, and beside the list from 840px (LAY-3).
  if (garment || random) $('wardrobe').dataset.detail = '';
  else delete $('wardrobe').dataset.detail;
  $('garment-info').replaceChildren(...(garment ? info(garment) : []));
  $('garment-detail-empty').hidden = Boolean(garment || random);
  $('garment-actions').hidden = !garment;
  $('garment-open').hidden = !garment?.link;
  if (garment?.link) $('garment-open').href = garment.link;
  $('garment-outfits').hidden = !garment;
  if (garment && visible) {
    const outfits = outfitsWith(garment, state.garments, { season: ui.season });
    renderOutfits($('garment-outfits'), t('wardrobe.outfits'), outfits, t('wardrobe.noOutfits'));
  }
  $('random-outfit').hidden = !random;
  if (random && visible) {
    renderOutfits($('random-outfit'), t('wardrobe.random'), random.outfit ? [random.outfit] : [], t('wardrobe.noRandom'));
    if (random.outfit) $('random-outfit').append(el('button', { className: 'button outline', type: 'button', textContent: t('wardrobe.randomAgain'), onclick: openRandom }));
  }
  $('garment-sheet').hidden = !ui.sheetOpen;
};

export const bind = () => {
  $('fab').addEventListener('click', () => openSheet());
  $('header-add').addEventListener('click', () => openSheet());
  $('wardrobe-add').addEventListener('click', () => openSheet());
  $('garment-veil').addEventListener('click', closeGarmentSheet);
  $('garment-close').addEventListener('click', closeGarmentSheet);
  bindSheetDrag($('garment-sheet'), { close: closeGarmentSheet });
  $('garment-back').addEventListener('click', () => openGarment(null));
  $('wardrobe-random').addEventListener('click', openRandom);
  $('garment-edit').addEventListener('click', () => openSheet(ui.garmentId));
  $('garment-delete').addEventListener('click', () => remove(ui.garmentId));
  // The grid of the palette: built once, the names are data (PAL-2).
  $('garment-swatches').replaceChildren(...COLORS.map(({ id, name, hex }) => {
    const button = el('button', { className: 'swatch-grid-item', type: 'button', onclick: () => {
      ui.draftColor = id;
      clearColorText();
      showColor();
    } });
    button.dataset.color = id;
    button.style.background = hex;
    button.setAttribute('aria-label', name);
    return button;
  }));
  $('garment-color-input').addEventListener('input', (event) => {
    const id = nearestColor(event.target.value);
    if (id === null) return;
    ui.draftColor = id;
    clearColorText();
    showColor({ fromInput: true });
  });
  // A typed hex, rgb or hsl colour takes the nearest palette colour (PAL-4, WAR-3).
  $('garment-color-text').addEventListener('input', (event) => {
    const hex = parseColor(event.target.value);
    event.target.toggleAttribute('aria-invalid', hex === null && event.target.value.trim() !== '');
    if (hex === null) return;
    ui.draftColor = nearestColor(hex);
    showColor();
  });
  $('garment-brand').addEventListener('input', showBrands);
  $('garment-link').addEventListener('input', showLoad);
  $('garment-slot').addEventListener('change', offerMeasures);
  $('garment-measure-add').addEventListener('click', () => {
    const line = measureLine();
    $('garment-measures').append(line);
    line.querySelector('input').focus();
  });
  $('garment-load').addEventListener('click', loadImages);
  $('garment-image-add').addEventListener('click', addImageUrl);
  $('garment-image-url').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addImageUrl();
  });
  $('garment-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const fields = {
      name: $('garment-name').value,
      slot: $('garment-slot').value,
      season: $('garment-season').value,
      color: ui.draftColor,
      brand: $('garment-brand').value,
      reference: $('garment-reference').value,
      link: $('garment-link').value,
      images: ui.draftImages,
      buy_date: $('garment-buy-date').value,
      price: $('garment-price').value,
      size: $('garment-size').value,
      fit: ui.draftFit,
      measures: readMeasures(),
    };
    const result = ui.editing ? editGarment(state, ui.editing, fields) : addGarment(state, fields);
    if (apply(result)) closeGarmentSheet();
  });
  // A tap out of the open row closes it, without a render, so that the tap still does its work.
  document.addEventListener(
    'pointerdown',
    (event) => {
      const box = document.querySelector('.item-row-swipe.open');
      if (!box || box.contains(event.target)) return;
      ui.openId = null;
      box.classList.remove('open');
      moveRow(box.querySelector('.item-row-body'), 0);
      box.querySelector('.item-row-actions').inert = true;
    },
    true,
  );
};
