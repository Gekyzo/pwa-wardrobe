import { $, ui, state, storage, t, setRender, render, showToast, hideToast, toastAction, clickGuardUntil } from '#ui/context';
import { bind as bindNav, renderNav } from '#ui/nav';
import { bind as bindWardrobe, renderWardrobe, closeGarmentSheet } from '#ui/wardrobe';
import { bind as bindCombinations, renderCombinations } from '#ui/combinations';
import { bind as bindSettings, applyLanguage } from '#ui/settings';
import { bind as bindInstall, renderInstall } from '#ui/install';
import { readVersion, renderVersion, offerUpdate } from '#ui/update';
import { bind as bindOnboarding, closeOnboarding, turnOnboarding } from '#ui/onboarding';
import { bind as bindWhatsNew, startWhatsNew, isWhatsNewOpen, closeWhatsNew } from '#ui/whatsnew';

const renderAll = () => {
  renderNav();
  $('title').textContent = t(`nav.${ui.view}`);
  renderWardrobe();
  renderCombinations();
  $('settings').hidden = ui.view !== 'settings';
  renderVersion();
  renderInstall();
};
setRender(renderAll);

bindNav();
bindWardrobe();
bindCombinations();
bindSettings();
bindInstall();
bindOnboarding();
bindWhatsNew();

document.addEventListener(
  'click',
  (event) => {
    if (Date.now() >= clickGuardUntil) return;
    event.preventDefault();
    event.stopPropagation();
  },
  true,
);

document.addEventListener('keydown', (event) => {
  if (ui.onboarding !== null) {
    if (event.key === 'Escape') closeOnboarding();
    else if (event.key === 'ArrowRight') turnOnboarding(1);
    else if (event.key === 'ArrowLeft') turnOnboarding(-1);
    return;
  }
  if (event.key !== 'Escape') return;
  if (isWhatsNewOpen()) {
    closeWhatsNew();
    return;
  }
  if (ui.sheetOpen) closeGarmentSheet();
  else if (ui.garmentId !== null || ui.combination !== null) {
    Object.assign(ui, { garmentId: null, combination: null });
    render();
  }
});

$('toast-action').addEventListener('click', () => {
  const action = toastAction;
  hideToast();
  action?.run();
});

applyLanguage();
if (ui.onboarding !== null) $('onboarding-next').focus();
if (!storage) showToast(t('error.noStorage'));
navigator.storage?.persist?.().catch(() => {});
navigator.serviceWorker?.register('./sw.js').catch(() => {});
// The worker drops the cached images that no garment keeps any more (SW-14).
navigator.serviceWorker?.ready
  .then((registration) => registration.active?.postMessage({ type: 'images', urls: state.garments.flatMap((garment) => garment.images) }))
  .catch(() => {});
// Read once at the start: the worker answers from the cache, then stores the file of the next deploy.
readVersion('./version.json').then((running) => {
  ui.version.running = running;
  renderVersion();
  startWhatsNew(running);
  navigator.serviceWorker?.ready.then(offerUpdate).catch(() => {});
});
