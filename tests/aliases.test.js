import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const modules = readdirSync(new URL('src/', root), { recursive: true })
  .filter((file) => file.endsWith('.js'))
  .map((file) => file.slice(0, -'.js'.length).replaceAll('\\', '/'));

const importMap = () => {
  const [, json] = read('index.html').match(/<script type="importmap">([\s\S]*?)<\/script>/);
  return JSON.parse(json).imports;
};

test('the import map of the page gives each module of src its alias', () => {
  const expected = Object.fromEntries(modules.map((name) => [`#${name}`, `./src/${name}.js`]));
  assert.deepEqual(Object.entries(importMap()).sort(), Object.entries(expected).sort());
});

test('the import map comes before the module script of the page', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('type="importmap"') < html.indexOf('type="module"'));
});

test('Node resolves an alias to the same file as the page', () => {
  for (const [alias, path] of Object.entries(importMap())) {
    assert.equal(import.meta.resolve(alias), new URL(path, root).href);
  }
});

test('no module of src imports another one by a relative path', () => {
  for (const name of modules) {
    assert.doesNotMatch(read(`src/${name}.js`), /from '\.{1,2}\//);
  }
});
