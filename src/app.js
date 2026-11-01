import { $, ui, state, storage, t, family, setRender, render, showToast, hideToast, toastAction, clickGuardUntil } from '#ui/context';
import { bind as bindNav, renderNav, syncHistory } from '#ui/nav';
import { bind as bindWardrobe, renderWardrobe, closeGarmentSheet } from '#ui/wardrobe';
import { bind as bindCombinations, renderCombinations } from '#ui/combinations';
import { renderFill, fillNow } from '#ui/fill';
import { bind as bindSettings, applyLanguage, renderSettings } from '#ui/settings';
import { bind as bindInstall, renderInstall } from '#ui/install';
import { readVersion, renderVersion, offerUpdate } from '#ui/update';
import { bind as bindOnboarding, closeOnboarding, turnOnboarding } from '#ui/onboarding';
import { bind as bindWhatsNew, startWhatsNew, isWhatsNewOpen, closeWhatsNew } from '#ui/whatsnew';
import { bind as bindAccount, renderAccount, startAccount, goOnline, goOffline, goVisible, goStale, isAccountOpen, closeAccount, sessionNow } from '#ui/account';
import { readOAuthReturn } from '#session';
import { familyOf } from '#families';
import { countOutfits } from '#outfits';
import { outfitsOf } from '#ui/outfit';

// The return of the Google sign-in (ACC-4): `code`, `state` and `error` leave the URL at once.
const { oauth, clean } = readOAuthReturn(new URL(location.href));
if (oauth) history.replaceState(history.state, '', clean);

// The summary under the title of each view (NAV-8). An empty wardrobe has none.
const subtitle = () => {
  const { garments } = state;
  if (ui.view === 'settings') {
    const user = sessionNow()?.user;
    return user ? user.email || user.name : t('nav.local');
  }
  if (ui.view === 'fill') {
    const count = fillNow().length;
    return count ? t('fill.summary', { count }) : '';
  }
  if (garments.length === 0) return '';
  if (ui.view === 'combinations') {
    const { combinations } = familyOf(family);
    const wearable = combinations.filter(({ number }) => outfitsOf(number).length > 0).length;
    return t('combinations.summary', { wearable, total: combinations.length, family: t(`family.${family}`) });
  }
  const photos = garments.filter((garment) => garment.images.length > 0).length;
  const outfits = countOutfits(garments, { season: ui.season, family, of: outfitsOf });
  const total = familyOf(family).combinations.length;
  return t('wardrobe.summary', { garments: t('garments.count', { count: garments.length }), photos, outfits: t('combinations.count', { count: outfits }), total, family: t(`family.${family}`) });
};

const renderHeader = () => {
  // An open garment stands alone, under its Back, with no title row (WAR-4).
  document.querySelector('.app-header').hidden = ui.view === 'wardrobe' && ui.garmentId !== null;
  $('title').textContent = t(`nav.${ui.view}`);
  $('subtitle').textContent = subtitle();
};

const renderAll = () => {
  renderNav();
  renderHeader();
  renderWardrobe();
  renderFill();
  renderCombinations();
  $('settings').hidden = ui.view !== 'settings';
  renderSettings();
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
