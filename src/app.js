import { $, ui, storage, t, setRender, render, showToast, hideToast, toastAction, clickGuardUntil } from '#ui/context';
import { bind as bindNav, renderNav } from '#ui/nav';
import { bind as bindWardrobe, renderWardrobe, closeGarmentSheet } from '#ui/wardrobe';
import { bind as bindSettings, applyLanguage } from '#ui/settings';
import { bind as bindInstall, renderInstall } from '#ui/install';
import { readVersion, renderVersion, offerUpdate } from '#ui/update';
import { bind as bindOnboarding, closeOnboarding, turnOnboarding } from '#ui/onboarding';

const renderAll = () => {
  renderNav();
  $('title').textContent = t(`nav.${ui.view}`);
  renderWardrobe();
  $('settings').hidden = ui.view !== 'settings';
  renderVersion();
  renderInstall();
};
setRender(renderAll);

bindNav();
bindWardrobe();
bindSettings();
bindInstall();
bindOnboarding();

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
// Read once at the start: the worker answers from the cache, then stores the file of the next deploy.
readVersion('./version.json').then((running) => {
  ui.version.running = running;
  renderVersion();
  navigator.serviceWorker?.ready.then(offerUpdate).catch(() => {});
});
