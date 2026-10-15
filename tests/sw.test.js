import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// sw.js is a classic script: run it with a stub `self` and return its pure functions.
const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const { localizeManifest } = vm.runInNewContext(`${source}\n;({ localizeManifest })`, {
  self: { addEventListener: () => {} },
});

// An object of the vm realm has another Object.prototype: compare a plain copy.
const plain = (value) => JSON.parse(JSON.stringify(value));

const build = () => ({
  name: 'Wardrobe',
  short_name: 'Wardrobe',
  description: 'Plantilla',
  lang: 'es',
  id: './',
  icons: [{ src: 'icons/icon-192.png' }],
});

test('localizeManifest takes the language, the name and the description of the text', () => {
  const manifest = localizeManifest(build(), { lang: 'en', name: 'Template app', description: 'Template' });
  assert.equal(manifest.lang, 'en');
  assert.equal(manifest.name, 'Template app');
  assert.equal(manifest.description, 'Template');
});

test('localizeManifest keeps the short name and the other members', () => {
  const manifest = localizeManifest(build(), { lang: 'en', name: 'Template app', description: 'Template' });
  assert.equal(manifest.short_name, 'Wardrobe');
  assert.equal(manifest.id, build().id);
  assert.deepEqual(manifest.icons, build().icons);
});

test('localizeManifest with no text returns the manifest as it is', () => {
  assert.deepEqual(plain(localizeManifest(build(), null)), build());
});

test('localizeManifest ignores a member of the text that is not a non-empty string', () => {
  const manifest = localizeManifest(build(), { lang: 'en', name: '', description: 42, short_name: 'Other' });
  assert.equal(manifest.lang, 'en');
  assert.equal(manifest.name, build().name);
  assert.equal(manifest.description, build().description);
  assert.equal(manifest.short_name, 'Wardrobe');
});

test('localizeManifest does not change its input', () => {
  const input = build();
  localizeManifest(input, { lang: 'en', name: 'Template app', description: 'Template' });
  assert.deepEqual(input, build());
});
