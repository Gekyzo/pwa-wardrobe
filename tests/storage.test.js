import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_SLUG } from '#config';
import { MATCHING } from '#matching';
import { FAMILIES } from '#families';
import {
  keyOf,
  loadDoc,
  saveDoc,
  exportJson,
  exportFilename,
  importJson,
  hasStoredDoc,
  isDocLost,
  LANGUAGE_KEY,
  loadLanguage,
  saveLanguage,
  THEME_KEY,
  loadTheme,
  saveTheme,
  CARDS_KEY,
  loadCards,
  saveCards,
  MODULES_KEY,
  loadModules,
  saveModules,
  MATCHING_KEY,
  FAMILY_KEY,
  loadFamily,
  saveFamily,
  FAMILIES_KEY,
  loadFamiliesOff,
  saveFamiliesOff,
  loadMatching,
  saveMatching,
  ONBOARDED_KEY,
  SEEN_VERSION_KEY,
  loadSeen,
  saveSeen,
  loadOnboarded,
  saveOnboarded,
  resetAll,
} from '#storage';

const fakeStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    key: (index) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
};

const brokenStorage = () => ({
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('quota');
  },
  removeItem: () => {
    throw new Error('denied');
  },
});

const KEY = keyOf('doc');
const empty = () => ({ version: 1, items: [] });
const normalize = (data) => (data?.version === 1 && Array.isArray(data.items) ? { version: 1, items: data.items } : null);
const opts = { key: KEY, normalize, empty };

test('every key starts with the slug of the app', () => {
  for (const key of [KEY, LANGUAGE_KEY, THEME_KEY, MODULES_KEY, ONBOARDED_KEY, SEEN_VERSION_KEY]) {
    assert.ok(key.startsWith(`${APP_SLUG}.`), key);
  }
});

test('no stored doc loads the empty doc', () => {
  assert.deepEqual(loadDoc(fakeStorage(), opts), empty());
});

test('a stored doc loads normalized', () => {
  const storage = fakeStorage({ [KEY]: JSON.stringify({ version: 1, items: ['a'], extra: 1 }) });
  assert.deepEqual(loadDoc(storage, opts), { version: 1, items: ['a'] });
});

test('a doc that is not valid is kept at <key>.corrupt and the empty doc loads', () => {
  const storage = fakeStorage({ [KEY]: '{"version":9}' });
  assert.deepEqual(loadDoc(storage, opts), empty());
  assert.equal(storage.getItem(`${KEY}.corrupt`), '{"version":9}');
});

test('text that is not JSON is kept at <key>.corrupt', () => {
  const storage = fakeStorage({ [KEY]: 'not json' });
  assert.deepEqual(loadDoc(storage, opts), empty());
  assert.equal(storage.getItem(`${KEY}.corrupt`), 'not json');
});

test('a broken storage loads the empty doc and a save returns false', () => {
  assert.deepEqual(loadDoc(brokenStorage(), opts), empty());
  assert.equal(saveDoc(brokenStorage(), KEY, empty()), false);
  assert.equal(hasStoredDoc(brokenStorage(), KEY), false);
});

test('a stored doc that is not valid, or not JSON, is lost; a valid doc, no doc or a broken storage is not (SYNC-2)', () => {
  assert.equal(isDocLost(fakeStorage({ [KEY]: '{"version":9}' }), opts), true);
  assert.equal(isDocLost(fakeStorage({ [KEY]: 'not json' }), opts), true);
  assert.equal(isDocLost(fakeStorage({ [KEY]: JSON.stringify({ version: 1, items: [] }) }), opts), false);
  assert.equal(isDocLost(fakeStorage(), opts), false);
  assert.equal(isDocLost(brokenStorage(), opts), false);
});

test('a saved doc loads back', () => {
  const storage = fakeStorage();
  assert.equal(saveDoc(storage, KEY, { version: 1, items: ['x'] }), true);
  assert.deepEqual(loadDoc(storage, opts), { version: 1, items: ['x'] });
  assert.equal(hasStoredDoc(storage, KEY), true);
});

test('hasStoredDoc is true for a stored text that is not a valid doc, and false for none', () => {
  assert.equal(hasStoredDoc(fakeStorage({ [KEY]: 'x' }), KEY), true);
  assert.equal(hasStoredDoc(fakeStorage(), KEY), false);
});

test('an import of text that is not JSON is an error', () => {
  assert.deepEqual(importJson('{', normalize), { error: { key: 'error.invalidJson' } });
});

test('an import of a file of another app is an error', () => {
  assert.deepEqual(importJson('{"version":5,"items":[],"recipes":[]}', normalize), { error: { key: 'error.notBackup' } });
});

test('an export imports back', () => {
  const doc = { version: 1, items: ['a'] };
  assert.deepEqual(importJson(exportJson(doc), normalize), { state: doc });
});

test('the export file name has the slug, the local date and the time', () => {
  assert.equal(exportFilename(new Date(2026, 0, 2, 3, 4, 5)), `${APP_SLUG}-2026-01-02-030405.json`);
});

test('loadLanguage returns the stored language when it is supported', () => {
  assert.equal(loadLanguage(fakeStorage({ [LANGUAGE_KEY]: 'es' }), ['es', 'en']), 'es');
});

test('loadLanguage returns null for no value and for an unsupported value', () => {
  assert.equal(loadLanguage(fakeStorage(), ['es', 'en']), null);
  assert.equal(loadLanguage(fakeStorage({ [LANGUAGE_KEY]: 'xx' }), ['es', 'en']), null);
  assert.equal(loadLanguage(fakeStorage({ [LANGUAGE_KEY]: '' }), ['es', 'en']), null);
});

test('saveLanguage stores a language and null removes it', () => {
  const storage = fakeStorage();
  assert.equal(saveLanguage(storage, 'en'), true);
  assert.equal(storage.getItem(LANGUAGE_KEY), 'en');
  assert.equal(saveLanguage(storage, null), true);
  assert.equal(storage.getItem(LANGUAGE_KEY), null);
});

test('the language functions do not throw when the storage does', () => {
  assert.equal(loadLanguage(brokenStorage(), ['es']), null);
  assert.equal(saveLanguage(brokenStorage(), 'es'), false);
  assert.equal(saveLanguage(brokenStorage(), null), false);
});

test('a preference is not part of the stored doc', () => {
  const storage = fakeStorage();
  saveLanguage(storage, 'en');
  saveTheme(storage, 'dark');
  saveModules(storage, ['combinations']);
  saveOnboarded(storage);
  assert.deepEqual(loadDoc(storage, opts), empty());
  assert.equal(hasStoredDoc(storage, KEY), false);
});

test('loadTheme returns the stored theme', () => {
  assert.equal(loadTheme(fakeStorage({ [THEME_KEY]: 'light' })), 'light');
  assert.equal(loadTheme(fakeStorage({ [THEME_KEY]: 'dark' })), 'dark');
});

test('loadTheme returns system for no value and for an unknown value', () => {
  assert.equal(loadTheme(fakeStorage()), 'system');
  assert.equal(loadTheme(fakeStorage({ [THEME_KEY]: 'blue' })), 'system');
  assert.equal(loadTheme(fakeStorage({ [THEME_KEY]: '' })), 'system');
});

test('saveTheme stores light and dark and system removes the key', () => {
  const storage = fakeStorage();
  assert.equal(saveTheme(storage, 'dark'), true);
  assert.equal(storage.getItem(THEME_KEY), 'dark');
  assert.equal(saveTheme(storage, 'light'), true);
  assert.equal(storage.getItem(THEME_KEY), 'light');
  assert.equal(saveTheme(storage, 'system'), true);
  assert.equal(storage.getItem(THEME_KEY), null);
});

test('saveTheme removes the key for an unknown theme', () => {
  const storage = fakeStorage({ [THEME_KEY]: 'dark' });
  assert.equal(saveTheme(storage, 'blue'), true);
  assert.equal(storage.getItem(THEME_KEY), null);
});

test('the theme functions do not throw when the storage does', () => {
  assert.equal(loadTheme(brokenStorage()), 'system');
  assert.equal(saveTheme(brokenStorage(), 'dark'), false);
  assert.equal(saveTheme(brokenStorage(), 'system'), false);
});

test('loadCards returns the stored view, photos for no value and for an unknown value', () => {
  assert.equal(loadCards(fakeStorage({ [CARDS_KEY]: 'color' })), 'color');
  assert.equal(loadCards(fakeStorage()), 'photos');
  assert.equal(loadCards(fakeStorage({ [CARDS_KEY]: 'photos' })), 'photos');
  assert.equal(loadCards(fakeStorage({ [CARDS_KEY]: 'blue' })), 'photos');
});

test('saveCards stores color and photos or an unknown value removes the key', () => {
  const storage = fakeStorage();
  assert.equal(saveCards(storage, 'color'), true);
  assert.equal(storage.getItem(CARDS_KEY), 'color');
  assert.equal(saveCards(storage, 'photos'), true);
  assert.equal(storage.getItem(CARDS_KEY), null);
  storage.setItem(CARDS_KEY, 'color');
  assert.equal(saveCards(storage, 'blue'), true);
  assert.equal(storage.getItem(CARDS_KEY), null);
});

test('the cards functions do not throw when the storage does', () => {
  assert.equal(loadCards(brokenStorage()), 'photos');
  assert.equal(saveCards(brokenStorage(), 'color'), false);
});

test('loadModules returns the stored ids that are modules', () => {
  assert.deepEqual(loadModules(fakeStorage({ [MODULES_KEY]: '["combinations"]' })), ['combinations']);
});

test('loadModules returns no module off for no value, bad JSON, a value that is not a list and unknown ids', () => {
  assert.deepEqual(loadModules(fakeStorage()), []);
  assert.deepEqual(loadModules(fakeStorage({ [MODULES_KEY]: '{' })), []);
  assert.deepEqual(loadModules(fakeStorage({ [MODULES_KEY]: '"combinations"' })), []);
  assert.deepEqual(loadModules(fakeStorage({ [MODULES_KEY]: '{"combinations":true}' })), []);
  assert.deepEqual(loadModules(fakeStorage({ [MODULES_KEY]: '["shops",1,null]' })), []);
});

test('saveModules stores the known ids and an empty list removes the key', () => {
  const storage = fakeStorage();
  assert.equal(saveModules(storage, ['shops', 'combinations']), true);
  assert.equal(storage.getItem(MODULES_KEY), '["combinations"]');
  assert.equal(saveModules(storage, []), true);
  assert.equal(storage.getItem(MODULES_KEY), null);
});

test('the module functions do not throw when the storage does', () => {
  assert.deepEqual(loadModules(brokenStorage()), []);
  assert.equal(saveModules(brokenStorage(), ['combinations']), false);
  assert.equal(saveModules(brokenStorage(), []), false);
});

test('loadMatching reads the stored choice through normalizeMatching (MAT-6)', () => {
  assert.equal(MATCHING_KEY, `${APP_SLUG}.matching`);
  assert.deepEqual(
    loadMatching(fakeStorage({ [MATCHING_KEY]: '{"neutrals":true,"contrast":"high"}' })),
    { ...MATCHING, neutrals: true, contrast: 'high' },
  );
  assert.deepEqual(loadMatching(fakeStorage()), MATCHING);
  assert.deepEqual(loadMatching(fakeStorage({ [MATCHING_KEY]: '{' })), MATCHING);
  assert.deepEqual(loadMatching(fakeStorage({ [MATCHING_KEY]: '{"contrast":"max"}' })), MATCHING);
});

test('saveMatching stores the fields that differ from the defaults, and the defaults remove the key (MAT-6)', () => {
  const storage = fakeStorage();
  assert.equal(saveMatching(storage, { ...MATCHING, colorType: 'winter', formality: true }), true);
  assert.equal(storage.getItem(MATCHING_KEY), '{"colorType":"winter","formality":true}');
  assert.equal(saveMatching(storage, MATCHING), true);
  assert.equal(storage.getItem(MATCHING_KEY), null);
});

test('the matching functions do not throw when the storage does (MAT-6)', () => {
  assert.deepEqual(loadMatching(brokenStorage()), MATCHING);
  assert.equal(saveMatching(brokenStorage(), { ...MATCHING, neutrals: true }), false);
});

test('loadFamily gives the stored family, or wada (FAM-6)', () => {
  assert.equal(FAMILY_KEY, `${APP_SLUG}.family`);
  assert.equal(loadFamily(fakeStorage({ [FAMILY_KEY]: 'triadic' })), 'triadic');
  assert.equal(loadFamily(fakeStorage()), 'wada');
  assert.equal(loadFamily(fakeStorage({ [FAMILY_KEY]: 'pastel' })), 'wada');
  assert.equal(loadFamily(brokenStorage()), 'wada');
});

test('saveFamily stores the family and wada removes the key (FAM-6)', () => {
  const storage = fakeStorage();
  assert.equal(saveFamily(storage, 'mono'), true);
  assert.equal(storage.getItem(FAMILY_KEY), 'mono');
  assert.equal(saveFamily(storage, 'wada'), true);
  assert.equal(storage.getItem(FAMILY_KEY), null);
  assert.equal(saveFamily(brokenStorage(), 'mono'), false);
});

test('loadFamiliesOff gives the known ids in order, and none for a list that turns every family off (FAM-6)', () => {
  assert.equal(FAMILIES_KEY, `${APP_SLUG}.families`);
  assert.deepEqual(loadFamiliesOff(fakeStorage({ [FAMILIES_KEY]: '["mono","x","wada"]' })), ['wada', 'mono']);
  assert.deepEqual(loadFamiliesOff(fakeStorage({ [FAMILIES_KEY]: JSON.stringify(FAMILIES) })), []);
  assert.deepEqual(loadFamiliesOff(fakeStorage({ [FAMILIES_KEY]: '{' })), []);
  assert.deepEqual(loadFamiliesOff(fakeStorage({ [FAMILIES_KEY]: '"mono"' })), []);
  assert.deepEqual(loadFamiliesOff(fakeStorage()), []);
  assert.deepEqual(loadFamiliesOff(brokenStorage()), []);
});

test('saveFamiliesOff stores the known ids, and none removes the key (FAM-6)', () => {
  const storage = fakeStorage();
  assert.equal(saveFamiliesOff(storage, ['mono', 'x', 'triadic']), true);
  assert.equal(storage.getItem(FAMILIES_KEY), '["triadic","mono"]');
  assert.equal(saveFamiliesOff(storage, []), true);
  assert.equal(storage.getItem(FAMILIES_KEY), null);
  assert.equal(saveFamiliesOff(brokenStorage(), ['mono']), false);
});

test('loadOnboarded is true only when the flag is stored', () => {
  assert.equal(loadOnboarded(fakeStorage({ [ONBOARDED_KEY]: '1' })), true);
  assert.equal(loadOnboarded(fakeStorage()), false);
  assert.equal(loadOnboarded(fakeStorage({ [ONBOARDED_KEY]: 'yes' })), false);
});

test('loadOnboarded is true for a storage that throws, so the walkthrough does not show at each start', () => {
  assert.equal(loadOnboarded(brokenStorage()), true);
});

test('saveOnboarded stores the flag, and is false for a storage that throws', () => {
  const storage = fakeStorage();
  assert.equal(saveOnboarded(storage), true);
  assert.equal(storage.getItem(ONBOARDED_KEY), '1');
  assert.equal(saveOnboarded(brokenStorage()), false);
});

test('loadSeen gives the stored version, and null when there is none or the storage throws', () => {
  assert.equal(loadSeen(fakeStorage({ [SEEN_VERSION_KEY]: '1.2.3' })), '1.2.3');
  assert.equal(loadSeen(fakeStorage()), null);
  assert.equal(loadSeen(brokenStorage()), null);
});

test('saveSeen stores the version, and is false for a storage that throws', () => {
  const storage = fakeStorage();
  assert.equal(saveSeen(storage, '1.2.3'), true);
  assert.equal(loadSeen(storage), '1.2.3');
  assert.equal(saveSeen(brokenStorage(), '1.2.3'), false);
});

test('resetAll removes every key of the app, the corrupt copies too, and keeps the keys of other apps (SET-3)', () => {
  const storage = fakeStorage({
    [keyOf('garments')]: '{}',
    [`${keyOf('garments')}.corrupt`]: 'x',
    [keyOf('lang')]: 'es',
    [keyOf('session')]: '{}',
    [keyOf('offline')]: '1',
    'other.notes': 'kept',
    [`${APP_SLUG}x.lang`]: 'kept',
  });
  assert.equal(resetAll(storage), true);
  assert.deepEqual([...Array(storage.length).keys()].map((index) => storage.key(index)).sort(), [`${APP_SLUG}x.lang`, 'other.notes'].sort());
});

test('resetAll reports a storage that refuses the removal (SET-3)', () => {
  const storage = { length: 1, key: () => keyOf('lang'), removeItem: () => { throw new Error('denied'); } };
  assert.equal(resetAll(storage), false);
});
