// The move to the new address (ADDR-1 to ADDR-8): the screen of the old address, and the import of a
// moved backup on the new one.
import { NEW_ORIGIN, isOldOrigin, encodeMove, takeMove, moveUrl, moveMode, replaceKey, keepsOffline } from '#move';
import { saveOffline } from '#session';
import { exportJson } from '#storage';
import { $, storage, t, textOf, showToast, apply, state } from '#ui/context';
import { signedIn, sessionNow, syncer } from '#ui/account';
import { closeOnboarding } from '#ui/onboarding';

const say = (key) => {
  $('move-status').textContent = key ? t(key) : '';
};

// ADDR-3, ADDR-4: the backup in the fragment, else Export (too large, or no CompressionStream).
const carry = async () => {
  let hash = null;
  try {
    hash = await encodeMove(exportJson(state));
  } catch {
    // The URL path is out; Export below still works.
  }
  const url = hash && moveUrl(hash, location.search);
  if (url) {
    location.assign(url);
    return;
  }
  say('move.tooLarge');
  $('move-export').hidden = false;
};

// ADDR-2: no data in the URL only after a clean sync of an approved account.
const go = async () => {
  const mode = moveMode({ signedIn: signedIn(), online: navigator.onLine });
  if (mode === 'carry') {
    await carry();
    return;
  }
  $('move-go').disabled = true;
  if (mode === 'wait') {
    say('move.waiting');
    window.addEventListener('online', () => {
      $('move-go').disabled = false;
      go();
    }, { once: true });
    return;
  }
  say('move.syncing');
  const result = await syncer.run();
  const sync = { result, pending: syncer.status().pending, approved: Boolean(sessionNow()?.user.approved) };
  $('move-go').disabled = false;
  say(null);
  if (moveMode({ signedIn: true, online: navigator.onLine, sync }) === 'carry') {
    await carry();
    return;
  }
  const query = new URLSearchParams(location.search);
  query.set('moved', '1');
  location.assign(`${NEW_ORIGIN}/?${query}`);
};

const showOldScreen = () => {
  $('move-title').textContent = t('move.title', { host: new URL(NEW_ORIGIN).host });
  $('move').hidden = false;
  // Nothing behind the screen takes the focus, the account screen of ACC-1 neither.
  for (const node of document.body.children) if (node.id !== 'move') node.inert = true;
  $('move-go').addEventListener('click', () => go());
  $('move-export').addEventListener('click', () => $('export').click());
  $('move-go').focus();
};

// ADDR-5, ADDR-6.
const importMoved = async () => {
  const result = await takeMove(location.hash, () => history.replaceState(null, '', `${location.pathname}${location.search}`));
  if (result.error) {
    showToast(textOf(result.error));
    return;
  }
  if (state.garments.length > 0) {
    const items = t('garments.count', { count: result.state.garments.length });
    if (!window.confirm(t(replaceKey(signedIn()), { items }))) return;
  }
  // A moved backup is data, not a first start: the walkthrough would cover it.
  closeOnboarding();
  apply(result, { undoText: t('move.done'), explicit: true });
  if (storage && keepsOffline({ imported: true, signedIn: signedIn() })) saveOffline(storage);
};

// Runs before the account starts, so ACC-1 routes on the moved garments. `?moved`: the old address
// sent a signed-in user here with no data (ADDR-2, ADDR-8); it leaves the URL at once.
export const startMove = async () => {
  if (isOldOrigin(location.hostname)) {
    showOldScreen();
    return;
  }
  const url = new URL(location.href);
  const moved = url.searchParams.has('moved');
  if (moved) {
    url.searchParams.delete('moved');
    history.replaceState(history.state, '', url);
  }
  if (location.hash.startsWith('#import=')) await importMoved();
  else if (moved) showToast(t('move.install'));
};
