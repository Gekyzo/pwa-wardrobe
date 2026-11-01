import { addGarment, editGarment, deleteGarment, findGarment, sortGarments, brandsOf, toggleImage, makeMain, isWebUrl, SLOTS, SEASONS } from '#garments';
import { bindSheetDrag } from '#ds/sheet';
import { loadPageImages } from '#links';
import { COLORS, colorOf, nearestColor, parseColor } from '#palette';
import { outfitsWith, outfitKey, randomOutfit, countKey, MAX_OUTFITS } from '#outfits';
import { missingBasics } from '#basics';
import { FITS, measuresOf } from '#measures';
import { suggestBrands } from '#brands';
import { $, el, ui, state, t, lang, textOf, apply, render, showToast } from '#ui/context';
import { icon } from '#ui/controls';
import { swatch, remoteImage, renderOutfits, picture, colorBand, seasonFilter, outfitList } from '#ui/outfit';

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

// `id` edits a garment; with no id, `fill` gives the name, the slot, the season and the colour of a
// new one, such as a missing basic (WAR-10).
const openSheet = (id = null, fill = null) => {
  const garment = id ? findGarment(state, id) : null;
  const base = garment ?? fill;
  ui.sheetOpen = true;
  ui.editing = id;
  ui.draftColor = base?.color ?? null;
  clearColorText();
  $('garment-sheet-title').textContent = t(id ? 'wardrobe.editTitle' : 'wardrobe.new');
  $('garment-name').value = base?.name ?? '';
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
  options($('garment-slot'), SLOTS, 'slot', base?.slot ?? 'top');
  options($('garment-season'), SEASONS, 'season', base?.season ?? 'all');
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
  render();
};

// A pick for the doc and the season filter in view; a change of either picks again (WAR-9).
const pickRandom = (except = null) => {
  ui.random = { garments: state.garments, season: ui.season, outfit: randomOutfit(state.garments, { season: ui.season, except }) };
};

// Picks another outfit than the one in view.
const anotherRandom = () => {
  pickRandom(ui.random?.outfit ? outfitKey(ui.random.outfit) : null);
  render();
};

const remove = (id) => {
  if (ui.garmentId === id) ui.garmentId = null;
  apply(deleteGarment(state, id), { undoText: t('toast.garmentDeleted') });
};

// The slot, the brand and the season of a garment, under its name in the detail.
const metaOf = (garment) => [t(`slot.${garment.slot}`), garment.brand, t(`season.${garment.season}`)].filter(Boolean).join(' · ');

const fact = (term, value) => [el('div', { className: 'garment-facts-item' }, [el('dt', { textContent: term }), el('dd', {}, [value])])];

// The size, the reference, the fit, each measure, the price, the buy date and the creation date of a
// garment, when it has one (WAR-4).
const facts = (garment) => {
  const list = [
    ...(garment.size ? fact(t('wardrobe.size'), garment.size) : []),
    ...(garment.reference ? fact(t('wardrobe.reference'), garment.reference) : []),
    ...(garment.fit ? fact(t('wardrobe.fit'), t(`fit.${garment.fit}`)) : []),
    ...garment.measures.flatMap(({ name, value, unit }) => fact(name, `${number(value)}${unit ? ` ${unit}` : ''}`)),
    ...(garment.price != null ? fact(t('wardrobe.price'), money(garment.price)) : []),
    ...(garment.buy_date ? fact(t('wardrobe.buyDate'), day(new Date(`${garment.buy_date}T12:00:00`))) : []),
    ...(garment.creation_date ? fact(t('wardrobe.added'), day(new Date(garment.creation_date))) : []),
  ];
  return list.length ? [el('dl', { className: 'garment-facts' }, list)] : [];
};

// The count of outfits of each garment, for one doc and one season filter (WAR-1).
let counts = { garments: null, season: null, byId: new Map() };
const outfitCount = (garment) => {
  if (counts.garments !== state.garments || counts.season !== ui.season) counts = { garments: state.garments, season: ui.season, byId: new Map() };
  if (!counts.byId.has(garment.id)) counts.byId.set(garment.id, outfitsWith(garment, state.garments, { season: ui.season }).length);
  return counts.byId.get(garment.id);
};

const cardMeta = (garment) => {
  const count = outfitCount(garment);
  return [garment.brand, garment.size && t('wardrobe.sizeShort', { size: garment.size }), t(countKey(count), { count })].filter(Boolean).join(' · ');
};

// A card opens its garment; Delete is in the detail (WAR-2).
const card = (garment) => {
  const open = el('button', { className: 'garment-card-open', type: 'button', onclick: () => openGarment(garment.id) }, [
    picture(garment, 'card'),
    el('span', { className: 'garment-card-name', textContent: garment.name }),
    el('span', { className: 'garment-card-color' }, [swatch(garment.color, 'dot'), colorOf(garment.color).name]),
    el('span', { className: 'garment-card-meta', textContent: cardMeta(garment) }),
  ]);
  const node = el('li', { className: 'garment-card' }, [open]);
  node.dataset.id = garment.id;
  return node;
};

// The garments by slot, in the order of SLOTS, each slot with its count (WAR-1).
const groups = () => {
  const sorted = sortGarments(state.garments);
  return SLOTS.map((slot) => sorted.filter((garment) => garment.slot === slot))
    .filter((list) => list.length)
    .map((list) => el('section', { className: 'garment-groups-group' }, [
      el('div', { className: 'garment-groups-head' }, [
        el('h2', { className: 'garment-groups-title', textContent: t(`slot.${list[0].slot}`) }),
        el('span', { className: 'garment-groups-count', textContent: t('garments.count', { count: list.length }) }),
      ]),
      el('ul', { className: 'garment-groups-grid' }, list.map(card)),
    ]));
};

// The random outfit beside the grid, or after it below 1024px (WAR-9).
const randomPanel = () => {
  const { outfit } = ui.random;
  return [
    el('div', { className: 'random-panel-head' }, [el('h2', { id: 'random-title', className: 'random-panel-title', textContent: t('wardrobe.random') }), seasonFilter()]),
    outfitList(outfit ? [outfit] : [], t('wardrobe.noRandom')),
    ...(outfit ? [el('button', { className: 'button outline', type: 'button', textContent: t('wardrobe.randomAgain'), onclick: anotherRandom })] : []),
  ];
};

// The missing basics of one doc and one season filter, computed once for each (WAR-10).
let basics = { garments: null, season: null, list: [] };
const basicsNow = () => {
  if (basics.garments !== state.garments || basics.season !== ui.season) {
    basics = { garments: state.garments, season: ui.season, list: missingBasics(state.garments, { season: ui.season }) };
  }
  return basics.list;
};

const gainText = (gain) => t(gain >= MAX_OUTFITS ? 'wardrobe.basicGainMax' : 'wardrobe.basicGain', { count: gain });

// A missing basic: a tap opens a new garment filled with it (WAR-10).
const basicItem = ({ basic, gain }) => {
  const name = t(`basic.${basic.id}`);
  const meta = [t(`slot.${basic.slot}`), t(`season.${basic.season}`), gain > 0 && gainText(gain)].filter(Boolean).join(' · ');
  const open = () => openSheet(null, { name, slot: basic.slot, season: basic.season, color: basic.color });
  return el('li', { className: 'basics-panel-row' }, [el('button', { className: 'basics-panel-item', type: 'button', onclick: open }, [
    swatch(basic.color),
    el('span', { className: 'basics-panel-name', textContent: name }),
    el('span', { className: 'basics-panel-meta', textContent: meta }),
  ])]);
};

const basicsPanel = (list) => [
  el('h2', { id: 'basics-title', className: 'basics-panel-title', textContent: t('wardrobe.basics') }),
  el('p', { className: 'basics-panel-hint', textContent: t('wardrobe.basicsHint') }),
  el('ul', { className: 'basics-panel-list' }, list.map(basicItem)),
];

// The media of a detail: the image shown large, the band of its colour and, with two images or
// more, the strip of all of them, where a tap on one shows it large (WAR-4).
const sliderArrow = (className, label, onclick) => {
  const button = el('button', { className, type: 'button', onclick }, [icon('back')]);
  button.setAttribute('aria-label', t(label));
  return button;
};

// The media of a detail: the picture and the colour band; with two or more images, a slider that a
// swipe or an arrow moves, and the place of the shown image in the band (WAR-4). The shown image
// stays across renders in `ui.detailImage`.
const media = (garment) => {
  const { images } = garment;
  const band = colorBand(garment.color);
  if (images.length < 2) return [picture(garment, 'hero'), band];
  const count = el('span', { className: 'image-slider-count' });
  band.append(count);
  const track = el('div', { className: 'image-slider-track' }, images.map((url) => picture(garment, 'hero', url)));
  const go = (step) => track.scrollBy({ left: step * track.clientWidth, behavior: 'smooth' });
  const prev = sliderArrow('image-slider-prev', 'wardrobe.prevImage', () => go(-1));
  const next = sliderArrow('image-slider-next', 'wardrobe.nextImage', () => go(1));
  const show = (index) => {
    count.textContent = t('wardrobe.imageCount', { index: index + 1, count: images.length });
    prev.disabled = index === 0;
    next.disabled = index === images.length - 1;
    ui.detailImage = images[index];
  };
  track.addEventListener('scroll', () => {
    if (track.clientWidth) show(Math.min(images.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
  }, { passive: true });
  const start = Math.max(0, images.indexOf(ui.detailImage));
  show(start);
  // The track has a width once it is in the page.
  requestAnimationFrame(() => { track.scrollLeft = start * track.clientWidth; });
  return [el('div', { className: 'image-slider' }, [track, prev, next]), band];
};

const info = (garment) => [
  el('h2', { className: 'garment-detail-title', textContent: garment.name }),
  el('p', { className: 'garment-detail-meta', textContent: metaOf(garment) }),
  ...facts(garment),
];

export const renderWardrobe = () => {
  const visible = ui.view === 'wardrobe';
  $('wardrobe').hidden = !visible;
  const some = state.garments.length > 0;
  $('wardrobe-empty').hidden = some;
  // The add is the button of the header at every width (NAV-6). The add of the empty state replaces it.
  $('header-add').hidden = !visible || ui.sheetOpen || !some;
  const garment = ui.garmentId === null ? null : findGarment(state, ui.garmentId);
  if (!garment) ui.garmentId = null;
  // The random outfit is picked at the first render, and again on a change of the doc or the filter.
  if (!some) ui.random = null;
  else if (!ui.random || ui.random.garments !== state.garments || ui.random.season !== ui.season) pickRandom();
  // The detail of a garment shows alone at every width (LAY-3, WAR-4).
  if (garment) $('wardrobe').dataset.detail = '';
  else delete $('wardrobe').dataset.detail;
  $('garment-groups').hidden = !some;
  $('garment-groups').replaceChildren(...(some && visible && !garment ? groups() : []));
  $('random-panel').hidden = !some;
  $('random-panel').replaceChildren(...(some && visible && !garment ? randomPanel() : []));
  const missing = visible && !garment ? basicsNow() : [];
  $('basics-panel').hidden = missing.length === 0;
  $('basics-panel').replaceChildren(...(missing.length ? basicsPanel(missing) : []));
  $('garment-media').replaceChildren(...(garment ? media(garment) : []));
  $('garment-info').replaceChildren(...(garment ? info(garment) : []));
  $('garment-actions').hidden = !garment;
  $('garment-open').hidden = !garment?.link;
  if (garment?.link) $('garment-open').href = garment.link;
  $('garment-outfits').hidden = !garment;
  if (garment && visible) {
    const outfits = outfitsWith(garment, state.garments, { season: ui.season });
    renderOutfits($('garment-outfits'), t('wardrobe.outfits'), outfits, t('wardrobe.noOutfits'));
  }
  $('garment-sheet').hidden = !ui.sheetOpen;
};

export const bind = () => {
  $('header-add').addEventListener('click', () => openSheet());
  $('wardrobe-add').addEventListener('click', () => openSheet());
  $('garment-veil').addEventListener('click', closeGarmentSheet);
  $('garment-close').addEventListener('click', closeGarmentSheet);
  bindSheetDrag($('garment-sheet'), { close: closeGarmentSheet });
  $('garment-back').addEventListener('click', () => openGarment(null));
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
    if (hex === null && event.target.value.trim() !== '') event.target.setAttribute('aria-invalid', 'true');
    else event.target.removeAttribute('aria-invalid');
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
};
