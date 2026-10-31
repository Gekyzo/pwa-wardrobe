import { $, ui, state, storage, t, setRender, render, showToast, hideToast, toastAction, clickGuardUntil } from '#ui/context';
import { bind as bindNav, renderNav, syncHistory } from '#ui/nav';
import { bind as bindWardrobe, renderWardrobe, closeGarmentSheet } from '#ui/wardrobe';
import { bind as bindCombinations, renderCombinations } from '#ui/combinations';
import { bind as bindSettings, applyLanguage } from '#ui/settings';
import { bind as bindInstall, renderInstall } from '#ui/install';
import { readVersion, renderVersion, offerUpdate } from '#ui/update';
import { bind as bindOnboarding, closeOnboarding, turnOnboarding } from '#ui/onboarding';
import { bind as bindWhatsNew, startWhatsNew, isWhatsNewOpen, closeWhatsNew } from '#ui/whatsnew';
import { bind as bindAccount, renderAccount, startAccount, goOnline, goOffline, goVisible, goStale, isAccountOpen, closeAccount } from '#ui/account';
import { readOAuthReturn } from '#session';

// The return of the Google sign-in (ACC-4): `code`, `state` and `error` leave the URL at once.
const { oauth, clean } = readOAuthReturn(new URL(location.href));
if (oauth) history.replaceState(history.state, '', clean);

const renderAll = () => {
  renderNav();
  $('title').textContent = t(`nav.${ui.view}`);
  renderWardrobe();
  renderCombinations();
  $('settings').hidden = ui.view !== 'settings';
  renderVersion();
  renderInstall();
  renderAccount();
  syncHistory();
};
setRender(renderAll);
// The side sheets from 840px start below the header (DSV-6).
new ResizeObserver(([entry]) => {
  document.documentElement.style.setProperty('--header-height', `${Math.round(entry.borderBoxSize[0].blockSize)}px`);
}).observe(document.querySelector('.app-header'));

bindNav();
bindWardrobe();
bindCombinations();
bindSettings();
bindInstall();
bindOnboarding();
bindWhatsNew();
bindAccount();

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
  // The account screens cover the app, the walkthrough too. Only Sign in over an open app closes (ACC-2).
  if (isAccountOpen()) {
    if (event.key === 'Escape') closeAccount();
    return;
  }
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
  else if (ui.garmentId !== null || ui.random !== null || ui.combination !== null) {
    Object.assign(ui, { garmentId: null, random: null, combination: null });
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
// The account and the sync (ACC-1, SYNC-3): the start refreshes the session and runs the sync; so do
// the `online` event and a return to the app.
startAccount(oauth);
window.addEventListener('online', goOnline);
window.addEventListener('offline', goOffline);
document.addEventListener('visibilitychange', goVisible);
// SYNC-12: a change of the stored garments or sync by another tab loads this tab again.
window.addEventListener('storage', goStale);
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
