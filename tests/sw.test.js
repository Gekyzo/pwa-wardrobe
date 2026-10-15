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

const { isRemoteImage, staleImages, IMAGES } = vm.runInNewContext(`${source}\n;({ isRemoteImage, staleImages, IMAGES })`, {
  self: { addEventListener: () => {}, location: { origin: 'https://app.example' } },
  URL,
});

test('the image cache has a name of its own (SW-14)', () => {
  assert.equal(IMAGES, 'wardrobe-images');
});

test('isRemoteImage takes a GET image of another origin only (SW-14)', () => {
  const request = (url, destination = 'image', method = 'GET') => ({ url, destination, method });
  assert.equal(isRemoteImage(request('https://cdn.example/a.jpg')), true);
  assert.equal(isRemoteImage(request('https://app.example/icons/logo.png')), false);
  assert.equal(isRemoteImage(request('https://cdn.example/a.jpg', '')), false);
  assert.equal(isRemoteImage(request('https://r.jina.ai/https://shop.example/p', '')), false);
  assert.equal(isRemoteImage(request('https://cdn.example/a.jpg', 'image', 'POST')), false);
});

test('staleImages gives the cached URLs that no garment keeps (SW-14)', () => {
  const cached = ['https://a/1.jpg', 'https://a/2.jpg', 'https://a/3.jpg'];
  assert.deepEqual(plain(staleImages(cached, ['https://a/2.jpg'])), ['https://a/1.jpg', 'https://a/3.jpg']);
  assert.deepEqual(plain(staleImages(cached, cached)), []);
  assert.deepEqual(plain(staleImages([], ['https://a/1.jpg'])), []);
});
