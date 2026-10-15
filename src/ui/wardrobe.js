import { addGarment, editGarment, deleteGarment, findGarment, sortGarments, brandsOf, toggleImage, makeMain, isWebUrl, SLOTS, SEASONS } from '#garments';
import { loadPageImages } from '#links';
import { COLORS, colorOf, nearestColor } from '#palette';
import { outfitsWith } from '#outfits';
import { settle } from '#swipe';
import { SIDE_BUTTON, DRAG_START, $, el, ui, state, t, textOf, apply, render, guardClick, showToast } from '#ui/context';
import { icon, iconButton } from '#ui/controls';
import { swatch, remoteImage, renderOutfits } from '#ui/outfit';

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

const openSheet = (id = null) => {
  const garment = id ? findGarment(state, id) : null;
  ui.sheetOpen = true;
  ui.editing = id;
  ui.draftColor = garment?.color ?? null;
  $('garment-sheet-title').textContent = t(id ? 'wardrobe.editTitle' : 'wardrobe.new');
  $('garment-name').value = garment?.name ?? '';
  $('garment-brand').value = garment?.brand ?? '';
  $('garment-brands').replaceChildren(...brandsOf(state.garments).map((value) => el('option', { value })));
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

const metaOf = (garment) => `${t(`slot.${garment.slot}`)} · ${t(`season.${garment.season}`)}`;

// A row slides left to show Delete (WAR-2).
const row = (garment) => {
  const open = ui.openId === garment.id;
  const actions = [iconButton('trash', t('row.delete', { text: garment.name }), () => remove(garment.id), { variant: 'danger' })];
  const width = actions.length * SIDE_BUTTON;
  const name = el('button', { className: 'item-row-name', type: 'button', tabIndex: -1, onclick: () => openGarment(garment.id) }, [
    el('span', {}, [swatch(garment.color, 'dot'), ` ${garment.name}`]),
    el('small', { className: 'item-row-meta', textContent: metaOf(garment) }),
  ]);
  const body = el('div', { className: 'item-row-body' }, [name]);
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

const info = (garment) => [
  swatch(garment.color, 'large'),
  el('h2', { className: 'detail-head-title', textContent: garment.name }),
  el('p', { className: 'detail-head-meta', textContent: `${colorOf(garment.color).name} · ${metaOf(garment)}` }),
];

export const renderWardrobe = () => {
  const visible = ui.view === 'wardrobe';
  $('wardrobe').hidden = !visible;
  $('fab').hidden = !visible || ui.sheetOpen;
  if (ui.openId && !findGarment(state, ui.openId)) ui.openId = null;
  $('garment-list').replaceChildren(...sortGarments(state.garments).map(row));
  ui.settleFrom = null;
  $('wardrobe-empty').hidden = state.garments.length > 0;
  const garment = ui.garmentId === null ? null : findGarment(state, ui.garmentId);
  if (!garment) ui.garmentId = null;
  // The pane shows the detail alone below 840px, and beside the list from 840px (LAY-3).
  if (garment) $('wardrobe').dataset.detail = '';
  else delete $('wardrobe').dataset.detail;
  $('garment-info').replaceChildren(...(garment ? info(garment) : []));
  $('garment-detail-empty').hidden = Boolean(garment);
  $('garment-actions').hidden = !garment;
  $('garment-outfits').hidden = !garment;
  if (garment && visible) {
    const outfits = outfitsWith(garment, state.garments, { season: ui.season });
    renderOutfits($('garment-outfits'), t('wardrobe.outfits'), outfits, t('wardrobe.noOutfits'));
  }
  $('garment-sheet').hidden = !ui.sheetOpen;
};

export const bind = () => {
  $('fab').addEventListener('click', () => openSheet());
  $('garment-veil').addEventListener('click', closeGarmentSheet);
  $('garment-back').addEventListener('click', () => openGarment(null));
  $('garment-edit').addEventListener('click', () => openSheet(ui.garmentId));
  $('garment-delete').addEventListener('click', () => remove(ui.garmentId));
  // The grid of the palette: built once, the names are data (PAL-2).
  $('garment-swatches').replaceChildren(...COLORS.map(({ id, name, hex }) => {
    const button = el('button', { className: 'swatch-grid-item', type: 'button', onclick: () => {
      ui.draftColor = id;
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
    showColor({ fromInput: true });
  });
  $('garment-link').addEventListener('input', showLoad);
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
      link: $('garment-link').value,
      images: ui.draftImages,
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
