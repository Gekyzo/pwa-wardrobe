import { normalizeGarments } from '#garments';
import { importJson, resetAll } from '#storage';
import { LANGUAGES, LANGUAGE_NAMES } from '#i18n';
import { switchModule } from '#modules';
import { CONTRASTS, COLOR_TYPES } from '#matching';
import {
  $,
  el,
  state,
  storage,
  t,
  lang,
  chosen,
  theme,
  off,
  isOn,
  textOf,
  showToast,
  apply,
  render,
  setLanguage,
  setTheme,
  setModules,
  setNavMotion,
  matching,
  setMatching,
  exportDoc,
} from '#ui/context';
import { runUpdate } from '#ui/update';
import { renderOnboarding } from '#ui/onboarding';
import { signedIn, stopSync } from '#ui/account';

// The value of a row of Preferences is the text of the option that its select has.
const renderValues = () => {
  for (const id of ['language', 'theme', 'matching-contrast', 'matching-colorType']) {
    $(`${id}-value`).textContent = $(id).selectedOptions[0]?.textContent ?? '';
  }
};

// The count of garments beside Export (SET-1).
export const renderSettings = () => {
  $('export-count').textContent = t('garments.count', { count: state.garments.length });
};

// Writes the fixed text of the page, then the text that a render builds.
export const applyLanguage = () => {
  document.documentElement.lang = lang;
  document.title = t('app.title');
  // The worker answers the manifest in this language (SW-13).
  const text = { type: 'manifest', lang, name: t('app.title'), description: t('app.description') };
  navigator.serviceWorker?.ready.then((registration) => registration.active?.postMessage(text)).catch(() => {});
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-attr]').forEach((node) => {
    node.dataset.i18nAttr.split(',').forEach((pair) => {
      const [name, key] = pair.split(':');
      node.setAttribute(name, t(key));
    });
  });
  const option = (value, text) => el('option', { value, textContent: text, selected: value === (chosen ?? '') });
  $('language').replaceChildren(
    option('', t('settings.automatic')),
    ...LANGUAGES.map((code) => option(code, LANGUAGE_NAMES[code])),
  );
  const themeOption = (value, key) => el('option', { value, textContent: t(key), selected: value === theme });
  $('theme').replaceChildren(
    themeOption('system', 'settings.automatic'),
    themeOption('light', 'settings.themeLight'),
    themeOption('dark', 'settings.themeDark'),
  );
  document.querySelectorAll('[data-module]').forEach((box) => {
    box.checked = isOn(box.dataset.module);
  });
  // The rules of Matching (SET-4): two switches and two selects.
  const ruleOption = (name, value) => el('option', { value, textContent: t(`matching.${name}.${value}`), selected: value === matching[name] });
  $('matching-contrast').replaceChildren(...CONTRASTS.map((value) => ruleOption('contrast', value)));
  $('matching-colorType').replaceChildren(...COLOR_TYPES.map((value) => ruleOption('colorType', value)));
  document.querySelectorAll('[data-matching]').forEach((box) => {
    box.checked = matching[box.dataset.matching];
  });
  renderValues();
  render();
  renderOnboarding();
};

export const bind = () => {
  $('export').addEventListener('click', () => {
    exportDoc(state);
  });
  $('import').addEventListener('click', () => $('import-file').click());
  // SET-3: the app starts again as a new install, with the walkthrough. With no storage the data is
  // only in memory, so the reload alone clears it. The session key goes too, so a signed-in device
  // opens Sign in. The sync stops first (SYNC-10): a run in progress saves nothing after the removal.
  $('reset').addEventListener('click', () => {
    if (!window.confirm(t(signedIn() ? 'reset.confirmLocal' : 'reset.confirm'))) return;
    stopSync();
    if (storage && !resetAll(storage)) {
      showToast(t('error.resetFailed'));
      return;
    }
    location.reload();
  });
  $('language').addEventListener('change', (event) => {
    setLanguage(event.target.value || null);
    applyLanguage();
  });
  $('theme').addEventListener('change', (event) => setTheme(event.target.value));
  $('theme').addEventListener('change', renderValues);
  document.querySelectorAll('[data-module]').forEach((box) => {
    box.addEventListener('change', () => {
      setModules(switchModule(off, box.dataset.module, box.checked));
      setNavMotion(true);
      render();
      setNavMotion(false);
    });
  });
  document.querySelectorAll('[data-matching]').forEach((box) => {
    box.addEventListener('change', () => {
      setMatching({ [box.dataset.matching]: box.checked });
      render();
    });
  });
  for (const name of ['contrast', 'colorType']) {
    $(`matching-${name}`).addEventListener('change', (event) => {
      setMatching({ [name]: event.target.value });
      renderValues();
      render();
    });
  }
  $('update').addEventListener('click', () => runUpdate($('update')));
  $('import-file').addEventListener('change', async (event) => {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) return;
    const result = importJson(await file.text(), normalizeGarments);
    if (result.error) {
      showToast(textOf(result.error));
      return;
    }
    const items = t('garments.count', { count: result.state.garments.length });
    // SYNC-9: with a session the import replaces the garments of the account, on every device.
    if (!window.confirm(t(signedIn() ? 'import.confirmAccount' : 'import.confirm', { items }))) return;
    apply(result, { undoText: t('toast.imported'), explicit: true });
  });
};
