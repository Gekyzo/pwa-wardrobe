import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rulesOf, blocksOf, parseCatalog, classesOf, iconsOf, classesInScript, menuOf } from '../designs/catalog.js';

const CSS = `@layer tokens, base, components;

@layer tokens {
  :root {
    --space-2: 8px; /* gap inside a control */
    --accent: light-dark(#1f7a4d, #5fc491);
  }
}

@layer components {
  /* @component button
     @summary Tap target for one action.
     @variant primary  Main action
       of a view.
     @state lifted  Set by the drag code.
     @example <button class="button primary">Send</button> */
  .button { padding: 0 var(--space-4); }
  @media (prefers-reduced-motion: reduce) {
    .button { transition: none; }
  }
  @keyframes spin { to { transform: rotate(1turn); } }
}
`;

test('rulesOf gives each style rule with its layer, selector and declarations', () => {
  const rules = rulesOf(CSS);
  assert.deepEqual(rules.map((rule) => [rule.layer, rule.selector, rule.keyframe]), [
    ['tokens', ':root', false],
    ['components', '.button', false],
    ['components', '.button', false],
    ['components', 'to', true],
  ]);
  assert.deepEqual(rules[0].declarations[0], { property: '--space-2', value: '8px', line: 5 });
});

test('rulesOf gives a null layer to a rule outside every layer', () => {
  assert.equal(rulesOf('.x { color: red; }')[0].layer, null);
});

test('blocksOf reads the tags of a block, and a line without a tag continues the tag above', () => {
  const [block] = blocksOf(CSS);
  assert.equal(block.name, 'button');
  assert.equal(block.summary, 'Tap target for one action.');
  assert.deepEqual(block.variants, [{ name: 'primary', text: 'Main action of a view.' }]);
  assert.deepEqual(block.states, [{ name: 'lifted', text: 'Set by the drag code.' }]);
  assert.deepEqual(block.examples, ['<button class="button primary">Send</button>']);
  assert.deepEqual(block.errors, []);
});

test('blocksOf reports a block with no summary, no example or an unknown tag', () => {
  const [block] = blocksOf('/* @component x\n   @colour red */\n.x {}');
  assert.deepEqual(block.errors, ['x: unknown tag @colour', 'x: no @summary', 'x: no @example']);
});

test('parseCatalog gives the layer of a component, the tokens with notes and scales, and the icons', () => {
  const sprite = '<svg><symbol id="cart" viewBox="0 0 24 24"/><symbol id="check" viewBox="0 0 24 24"/></svg>';
  const catalog = parseCatalog({ css: CSS, sprite });
  assert.equal(catalog.components[0].layer, 'components');
  assert.deepEqual(catalog.tokens, [
    { name: '--space-2', value: '8px', note: 'gap inside a control', scale: 'space' },
    { name: '--accent', value: 'light-dark(#1f7a4d, #5fc491)', note: '', scale: 'colour' },
  ]);
  assert.deepEqual(catalog.icons, ['cart', 'check']);
  assert.deepEqual(catalog.errors, []);
});

test('parseCatalog reports a name used twice', () => {
  const css = '/* @component a\n @summary A.\n @example <i class="a"></i> */\n.a {}\n/* @component a\n @summary B.\n @example <i class="a"></i> */\n.a {}';
  assert.deepEqual(parseCatalog({ css, sprite: '' }).errors, ['a: documented twice']);
});

test('classesOf and iconsOf read an HTML string', () => {
  const html = '<button class="button  primary" type="button"><svg class="icon"><use href="icons.svg#cart"/></svg></button>';
  assert.deepEqual(classesOf(html), ['button', 'primary', 'icon']);
  assert.deepEqual(iconsOf(html), ['cart']);
});

test('classesInScript reads the literals of className, variant and classList', () => {
  const js = `el('li', { className: open ? 'swipe open' : 'swipe' });
iconButton('trash', label, run, { variant: 'danger' });
node.classList.add('lifted');
el('li', { className: [
  'item',
  bought && 'bought',
].filter(Boolean).join(' ') });`;
  assert.deepEqual(classesInScript(js).sort(), ['bought', 'danger', 'item', 'lifted', 'open', 'swipe']);
});

test('parseCatalog gives the size scale to each size token, and colour only to a colour', () => {
  const css = '@layer tokens { :root { --tap: 44px; --arrow: 6px; --art-width: 240px; --scrim: rgb(0 0 0 / 0.45); --knob: #fff; } }';
  assert.deepEqual(parseCatalog({ css, sprite: '' }).tokens.map((token) => [token.name, token.scale]), [
    ['--tap', 'size'],
    ['--arrow', 'size'],
    ['--art-width', 'size'],
    ['--scrim', 'colour'],
    ['--knob', 'colour'],
  ]);
});

test('classesInScript skips a literal that a comparison uses', () => {
  const js = "el('li', { className: [view === 'active' && 'bought', mode !== 'next' ? 'wide' : ''].join(' ') });";
  assert.deepEqual(classesInScript(js).sort(), ['bought', 'wide']);
});

test('menuOf gives the sections of the catalogue, each with the names of its parts', () => {
  const part = (name, layer, scope = null) => ({ name, layer, scope });
  const catalog = {
    components: [part('button', 'components'), part('split', 'layouts'), part('main', 'base'), part('day', 'screens', 'menu'), part('search', 'screens', 'list'), part('meal', 'screens', 'menu')],
  };
  assert.deepEqual(menuOf(catalog), [
    { id: 'colours', title: 'Colours', items: [] },
    { id: 'scales', title: 'Scales', items: [] },
    { id: 'icons', title: 'Icons', items: [] },
    { id: 'components', title: 'Components', items: ['button'] },
    { id: 'layouts', title: 'Layouts', items: ['split'] },
    { id: 'base', title: 'Base', items: ['main'] },
    { id: 'screens-menu', title: 'Screen parts · menu', items: ['day', 'meal'] },
    { id: 'screens-list', title: 'Screen parts · list', items: ['search'] },
  ]);
});

test('menuOf leaves out a layer with no part', () => {
  assert.deepEqual(menuOf({ components: [part2('button')] }).map((section) => section.id), ['colours', 'scales', 'icons', 'components']);
});

const part2 = (name) => ({ name, layer: 'components', scope: null });
