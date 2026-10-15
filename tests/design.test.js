import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { LAYERS, rulesOf, iconsOf, parseCatalog, classesOf, classesInScript } from '../designs/catalog.js';

// The rules of docs/spec/15-design-system.md over the real files.
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const css = read('styles.css');
const rules = rulesOf(css);
const html = read('index.html');
const sprite = existsSync(new URL('icons.svg', root)) ? read('icons.svg') : '';
const scripts = readdirSync(new URL('src/ui/', root)).map((file) => [file, read(`src/ui/${file}`)]);
const symbols = [...sprite.matchAll(/<symbol\b[^>]*\bid="([^"]+)"/g)].map(([, id]) => id);
// The walkthrough is optional: with it removed there is no art to leave out.
const art = html.match(/<div class="onboarding-art">[\s\S]*?<\/div>/)?.[0] ?? '';

test('styles.css declares the five layers first, and each rule is in one of them (DS-1)', () => {
  assert.match(css, /^@layer tokens, base, components, layouts, screens;/);
  assert.deepEqual(rules.filter((rule) => !LAYERS.includes(rule.layer)).map((rule) => `${rule.line}: ${rule.selector}`), []);
});

const TOKEN_PROPERTIES = /^(color|background(-color)?|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|fill|stroke|padding(-\w+)?|margin(-\w+)?|gap|row-gap|column-gap|inset|top|right|bottom|left|font-size|font-weight|font-family|font|border-radius|box-shadow|transition|animation)$/;
// A value part that needs no token: a keyword, a token, env(), a percent, or a small border width.
const ALLOWED = /^(0|1px|2px|-?\d+(\.\d+)?%|-?\d+deg|var\(--[\w-]+\)|env\([\w-]+\)|[a-zA-Z-]+)$/;

// The parts of a value that are raw: a length, a time, a colour or a quoted font name.
const rawParts = (value) =>
  value
    .replace(/var\(--[\w-]+\)/g, ' ')
    .replace(/env\([\w-]+\)/g, ' ')
    .replace(/[(),/*+]/g, ' ')
    .split(/\s+/)
    .filter((part) => part && !ALLOWED.test(part) && !/^-?\d+(\.\d+)?$/.test(part));

const where = (rule, d) => `${d.line}: ${rule.selector} { ${d.property}: ${d.value} }`;

test('a raw value of a token property is only in the tokens layer (DS-2)', () => {
  const raw = rules
    .filter((rule) => rule.layer !== 'tokens' && !rule.keyframe)
    .flatMap((rule) => rule.declarations.filter((d) => TOKEN_PROPERTIES.test(d.property) && rawParts(d.value).length).map((d) => where(rule, d)));
  assert.deepEqual(raw, []);
});

test('a keyframe takes its colours from the tokens (DS-2)', () => {
  const raw = rules
    .filter((rule) => rule.keyframe)
    .flatMap((rule) => rule.declarations.filter((d) => /colou?r|background/.test(d.property) && rawParts(d.value).length).map((d) => where(rule, d)));
  assert.deepEqual(raw, []);
});

test('a raw width or height is not in the screens layer (DS-2)', () => {
  const raw = rules
    .filter((rule) => rule.layer === 'screens')
    .flatMap((rule) => rule.declarations.filter((d) => /^(min-|max-)?(width|height)$/.test(d.property) && /\d(px|rem)/.test(d.value.replace(/var\([^)]*\)/g, '').replace(/^1px$/, ''))).map((d) => where(rule, d)));
  assert.deepEqual(raw, []);
});

test('reduced motion sets the motion tokens to 0ms in one place (DS-2)', () => {
  assert.equal((css.match(/prefers-reduced-motion/g) ?? []).length, 1);
  const motion = rules.filter((rule) => rule.layer === 'tokens' && rule.declarations.some((d) => d.property === '--motion' && d.value === '0ms'));
  assert.equal(motion.length, 1);
});

test('each svg of the page uses a symbol, except the drawings of the walkthrough (DS-5)', () => {
  const svgs = html.replace(art, '').match(/<svg\b[\s\S]*?<\/svg>/g) ?? [];
  const icon = /^<svg (data-for="\w+" )?class="icon[^"]*" aria-hidden="true"><use href="icons\.svg#[\w-]+"\/><\/svg>$/;
  assert.deepEqual(svgs.filter((svg) => !icon.test(svg)), []);
});

test('each icon that the page or the code names is a symbol of icons.svg (DS-5)', () => {
  const named = [...iconsOf(html), ...scripts.flatMap(([, js]) => [...js.matchAll(/\bicon(?:Button)?\('([\w-]+)'/g)].map(([, id]) => id))];
  assert.ok(named.length > 0);
  assert.deepEqual(named.filter((id) => !symbols.includes(id)), []);
});

test('each symbol of icons.svg is used (DS-5)', () => {
  const text = [html, ...scripts.map(([, js]) => js)].join('\n');
  assert.ok(symbols.length > 0);
  assert.deepEqual(symbols.filter((id) => !text.includes(`#${id}"`) && !text.includes(`'${id}'`)), []);
});

test('only icon() of controls.js builds an svg (DS-5)', () => {
  assert.deepEqual(scripts.filter(([file, js]) => file !== 'controls.js' && /createElementNS|'svg'/.test(js)).map(([file]) => file), []);
});

const catalog = parseCatalog({ css, sprite });
const used = new Set([...classesOf(html), ...scripts.flatMap(([, js]) => classesInScript(js))]);

// A family of components: each name is documented, no old class is used, and no rule styles one.
const family = (names, retired, gone = []) => () => {
  for (const name of names) assert.ok(catalog.components.some((part) => part.name === name), `${name} has an @component block`);
  assert.deepEqual(retired.filter((name) => used.has(name)), [], 'an old class is still used');
  const old = new RegExp(`\\.(${retired.join('|')})(?![\\w-])`);
  assert.deepEqual(rules.filter((rule) => old.test(rule.selector) || gone.some((selector) => rule.selector.includes(selector))).map((rule) => rule.selector), [], 'a rule styles an old class');
};

test('every action is a button of the design system (DS-3)', family(
  ['button', 'fab'],
  ['tool', 'send', 'recur', 'more', 'recipe-link'],
  ['#search-button', '#menu-clear', '#meal-remove', '#update', '#onboarding-skip', '.actions button', '.actions .danger', '.empty button', '.banner button', '.menu-actions button', '.add-row button', '.toast button', '.onboarding-actions button'],
));

test('primary is a variant of button only (DS-3)', () => {
  assert.deepEqual(rules.filter((rule) => /\.primary\b/.test(rule.selector) && !rule.selector.includes('.button')).map((rule) => rule.selector), []);
  assert.deepEqual([...html.matchAll(/class="([^"]*\bprimary\b[^"]*)"/g)].map(([, value]) => value).filter((value) => !value.split(' ').includes('button')), []);
});

test('chips, pills, segments and switches are components (DS-3)', family(
  ['chip', 'pill', 'segmented', 'switch', 'cluster'],
  ['chips', 'shop-chips', 'chip-count', 'seg'],
  ['.chips button', '.seg button', 'button.pill', '.group .switch'],
));

test('the muted colour of an icon button does not outrank its variants', () => {
  const icon = rules.find((rule) => rule.selector.startsWith('.button.icon') && rule.declarations.some((d) => d.property === 'color'));
  assert.match(icon.selector, /^\.button\.icon:where\(/);
});

test('inputs, fields and selects are components (DS-3)', family(
  ['input', 'field', 'select', 'input-row'],
  ['add-row', 'edit-name', 'edit-quantity'],
  ['.sheet .field', '.search input', '.product-form input', '.group select', '#meal-query'],
));

test('the header and the bottom bar are components (DS-3)', family(
  ['app-header', 'nav-bar', 'badge', 'ring'],
  ['head', 'head-text', 'bnav', 'badge-count'],
  ['.ring span', '.bnav button', '.head h1', '.head p'],
));

test('sheets, toasts, banners and empty states are components (DS-3)', family(
  ['sheet', 'toast', 'banner', 'empty-state'],
  ['veil', 'grab', 'empty', 'meal-empty'],
  ['.sheet h2', '.sheet .entry', '.toast span', '.banner p', '#edit-chips', '#edit-empty'],
));

test('rows, list groups and section heads are components (DS-3)', family(
  ['item-row', 'swipe-action', 'section-head', 'group-head', 'list-group', 'item-list', 'version-status'],
  ['items', 'item', 'row', 'swipe', 'side', 'backdrop', 'name', 'qty', 'section', 'actions', 'suggestions', 'group', 'suggestion-name', 'suggestion-where', 'create'],
  ['#version-status', 'input[type="checkbox"]', '.item-row-name small'],
));

const names = (part) => [part.name, ...part.parts.map((p) => p.name), ...part.variants.map((v) => v.name), ...part.states.map((s) => s.name)];
const known = new Set(catalog.components.flatMap(names));

test('the catalogue has no error (DS-6)', () => {
  assert.deepEqual(catalog.errors, []);
});

test('each class that the page or the code uses is documented (DS-6)', () => {
  assert.deepEqual([...used].filter((name) => !known.has(name)).sort(), []);
});

test('each class of a selector is documented (DS-6)', () => {
  const inSelectors = rules.filter((rule) => !rule.keyframe).flatMap((rule) => [...rule.selector.matchAll(/\.([a-z][\w-]*)/g)].map(([, name]) => name));
  assert.deepEqual([...new Set(inSelectors)].filter((name) => !known.has(name)).sort(), []);
});

test('each example of the catalogue uses known classes and icons (DS-6)', () => {
  const examples = catalog.components.flatMap((part) => part.examples);
  assert.deepEqual(examples.flatMap(classesOf).filter((name) => !known.has(name)), []);
  assert.deepEqual(examples.flatMap(iconsOf).filter((id) => !symbols.includes(id)), []);
});

// The drawings of the walkthrough are art: their shapes are bare svg elements.
const ART = /^\.onboarding-art > svg/;

test('no selector styles a bare element inside a class, and none has an id (DS-4)', () => {
  const selectors = rules.filter((rule) => !rule.keyframe && rule.layer !== 'tokens' && rule.layer !== 'base').map((rule) => rule.selector);
  assert.deepEqual(selectors.filter((selector) => selector.includes('#')), []);
  const bare = /\.[\w-]+[^,]*?(\s+|\s*>\s*)(button|input|span|small|p|h[1-6]|li|ul|svg|select|em|strong|label|form|a)\b(?![\w-])/;
  assert.deepEqual(selectors.filter((selector) => !ART.test(selector) && bare.test(selector)), []);
});

test('a variant is used with its block in the page (DS-3)', () => {
  const owners = new Map();
  for (const part of catalog.components) {
    for (const variant of part.variants) owners.set(variant.name, [...(owners.get(variant.name) ?? []), part.name, ...part.parts.map((p) => p.name)]);
  }
  const alone = new Set(catalog.components.flatMap((part) => [part.name, ...part.parts.map((p) => p.name), ...part.states.map((s) => s.name)]));
  const lists = [...html.matchAll(/\bclass="([^"]*)"/g)].map(([, value]) => value.split(/\s+/));
  const stray = lists.flatMap((list) => list.filter((name) => owners.has(name) && !alone.has(name) && !owners.get(name).some((owner) => list.includes(owner))).map((name) => `${name} in "${list.join(' ')}"`));
  assert.deepEqual(stray, []);
});

test('a className of the code is a literal, so that the test can read it', () => {
  assert.deepEqual(scripts.filter(([, js]) => /className:\s*`|\.className\s*=/.test(js)).map(([file]) => file), []);
});

test('the catalogue page reads each view of src/ui/ (DS-7)', () => {
  const page = existsSync(new URL('designs/page.js', root)) ? read('designs/page.js') : '';
  const listed = (page.match(/const UI = \[([^\]]*)\]/)?.[1] ?? '').match(/'([\w-]+)'/g)?.map((name) => name.slice(1, -1)) ?? [];
  assert.deepEqual(listed.sort(), scripts.map(([file]) => file.replace(/\.js$/, '')).sort());
});

test('the frame of the catalogue page does not reach into the examples (DS-7)', () => {
  const frame = rulesOf(read('designs/index.html').match(/<style>([\s\S]*?)<\/style>/)[1]);
  // An unlayered frame rule beats every layer of styles.css, so a frame rule that ends in a bare
  // element must reach only a direct child of a frame box.
  const reaching = frame.filter((rule) => /(^|\s)(h[1-6]|p|span|div|code|pre)$/.test(rule.selector) && !/>\s*(h[1-6]|p|span|div|code|pre)$/.test(rule.selector));
  assert.deepEqual(reaching.map((rule) => rule.selector), []);
});

test('a width query uses only the breakpoints 600px and 840px, as min-width (DS-8)', () => {
  const queries = [...css.matchAll(/@media\s*([^{]+)\{/g)].map(([, query]) => query);
  const widths = queries.flatMap((query) =>
    [...query.matchAll(/\(\s*(min-|max-)?width\s*:\s*([^)]+)\)/g)].map(([, kind = '', value]) => `${kind}${value.trim()}`));
  assert.ok(widths.includes('min-600px'));
  assert.ok(widths.includes('min-840px'));
  assert.deepEqual(widths.filter((width) => !['min-600px', 'min-840px'].includes(width)), []);
});

test('the pane layout is documented with its parts (LAY-3)', () => {
  const pane = catalog.components.find((component) => component.name === 'pane');
  assert.ok(pane);
  assert.deepEqual(pane.parts.map((part) => part.name).sort(), ['pane-back', 'pane-detail', 'pane-list']);
});

test('the content and the fixed controls keep out of a cutout on either side (LAY-4)', () => {
  const declared = (selector, property) =>
    rules.filter((rule) => rule.selector === selector).flatMap((rule) => rule.declarations.filter((d) => d.property === property).map((d) => d.value));
  assert.ok(declared('body', 'padding-inline-end').some((value) => value.includes('safe-area-inset-right')), 'body end padding');
  assert.ok(declared('body', 'padding-inline-start').some((value) => value.includes('safe-area-inset-left')), 'body start padding');
  for (const selector of ['.fab', '.toast']) {
    assert.ok(declared(selector, 'right').some((value) => value.includes('safe-area-inset-right')), `${selector} right`);
  }
  assert.ok(declared('[data-hand="left"] .fab', 'left').every((value) => value.includes('safe-area-inset-left')), 'left-hand fab');
  assert.ok(declared('.toast', 'left').every((value) => value.includes('safe-area-inset-left')), 'toast left');
});

test('the doc comments of the design system carry no words of another app', () => {
  const docs = [...css.matchAll(/\/\*[\s\S]*?\*\//g)].map(([comment]) => comment).join('\n');
  const foreign = /\b(Leche|Café|Siempre|Buscar|Nueva tienda|Nombre|Idioma|Borrar|Próxima|Actual|recipes?|shops?|trip|bought|products?|groceries)\b/gi;
  assert.deepEqual([...new Set(docs.match(foreign) ?? [])], []);
});
