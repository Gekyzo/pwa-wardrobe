import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { RULES } from '../vendor/design-system/rules.js';
import { parseCatalog } from '../vendor/design-system/catalog.js';

// The rules of the design system (docs/spec/04-design-system.md) over the files of the app.
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const optional = (path) => (existsSync(new URL(path, root)) ? read(path) : '');

const files = {
  css: [read('vendor/design-system/design-system.css'), read('styles.css')],
  html: read('index.html'),
  scripts: readdirSync(new URL('src/ui/', root)).map((file) => [file, read(`src/ui/${file}`)]),
  sprite: optional('icons.svg'),
  page: optional('designs/page.js'),
  pageHtml: optional('designs/index.html'),
};

// The exceptions of docs/spec/04-design-system.md, by rule id.
const SKIP = { 'DS-8': 'DSV-5 adds the desktop breakpoint 1024px; the test below runs DS-8 without it' };

// The app's desktop breakpoint (DSV-5), and a stylesheet with the content of one query's blocks taken out.
const DESKTOP = '(min-width: 1024px)';
const withoutQuery = (css, query) => {
  let out = css;
  for (let at = out.indexOf(`@media ${query}`); at !== -1; at = out.indexOf(`@media ${query}`)) {
    let depth = 0;
    let end = out.indexOf('{', at);
    do {
      if (out[end] === '{') depth += 1;
      if (out[end] === '}') depth -= 1;
      end += 1;
    } while (depth > 0);
    out = out.slice(0, at) + out.slice(end);
  }
  return out;
};

test('the rules read the shared stylesheet and styles.css', () => {
  // LAY-4 reads the body rule of the app only when there are two sheets.
  assert.equal(files.css.length, 2);
});

test('the design system has rules to run', () => {
  assert.ok(RULES.length > 0);
});

for (const rule of RULES) test(rule.title, { skip: SKIP[rule.id] ?? false }, () => assert.deepEqual(rule.check(files), []));

test('a width query uses 600px, 840px or the 1024px of DSV-5, as min-width (DS-8)', () => {
  const ds8 = RULES.find((rule) => rule.id === 'DS-8');
  assert.ok(read('styles.css').includes(`@media ${DESKTOP}`));
  assert.deepEqual(ds8.check({ ...files, css: [files.css[0], withoutQuery(files.css[1], DESKTOP)] }), []);
});

test('styles.css changes the rail only from 600px (LAY-2, DSV-5)', () => {
  const app = withoutQuery(withoutQuery(read('styles.css'), DESKTOP), '(min-width: 600px)');
  assert.doesNotMatch(app, /\.nav-bar\s*[{,]/);
  assert.match(read('styles.css'), /@extends nav-bar/);
});

test('the components of the app are documented in styles.css (DSV-3)', () => {
  const names = parseCatalog({ css: read('styles.css'), sprite: files.sprite }).components.map((part) => part.name);
  for (const name of ['swatch', 'strip', 'blocks', 'swatch-grid', 'thumb', 'image-strip', 'image-grid', 'color-pick', 'detail-head', 'outfits', 'outfit']) {
    assert.ok(names.includes(name), name);
  }
});

test('styles.css has the versions of a shared component: nav-bar, app-header and sheet (DSV-5), item-row, segmented in fit-pick, list-group in settings (DSV-3)', () => {
  assert.deepEqual([...read('styles.css').matchAll(/\/\*\s*@extends\s+([\w-]+)/g)].map(([, name]) => name), ['nav-bar', 'app-header', 'sheet', 'item-row', 'segmented', 'list-group']);
});
