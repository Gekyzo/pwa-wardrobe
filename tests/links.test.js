import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CANDIDATES, PROXY, TIMEOUT, proxyUrl, imagesOfPage, loadPageImages } from '#links';

const base = 'https://shop.example/es/p/shirt-123?colour=blue';

test('the proxy URL carries the encoded link (LNK-1)', () => {
  assert.equal(proxyUrl('https://a.example/p?x=1&y=2'), `${PROXY}${encodeURIComponent('https://a.example/p?x=1&y=2')}`);
  assert.equal(TIMEOUT, 15000);
});

test('the meta images come first, then JSON-LD, then the img tags (LNK-2)', () => {
  const html = `
    <img src="/img/b.jpg">
    <meta content="https://cdn.example/og.jpg" property="og:image">
    <script type="application/ld+json">{"@type":"Product","image":["https://cdn.example/ld1.jpg",{"url":"https://cdn.example/ld2.jpg"}]}</script>
    <meta name="twitter:image" content="https://cdn.example/tw.jpg">`;
  assert.deepEqual(imagesOfPage(html, base), [
    'https://cdn.example/og.jpg',
    'https://cdn.example/tw.jpg',
    'https://cdn.example/ld1.jpg',
    'https://cdn.example/ld2.jpg',
    'https://shop.example/img/b.jpg',
  ]);
});

test('a Product inside @graph and a single image string are read', () => {
  const html = `<script type="application/ld+json">
    {"@graph":[{"@type":"WebPage"},{"@type":["Product"],"image":"https://cdn.example/g.jpg"}]}
  </script><script type="application/ld+json">not json</script>`;
  assert.deepEqual(imagesOfPage(html, base), ['https://cdn.example/g.jpg']);
});

test('srcset gives its widest candidate, data-src counts, entities and relative URLs resolve', () => {
  const html = `
    <img srcset="a-400.jpg 400w, a-1200.jpg 1200w, a-800.jpg 800w">
    <img data-src="//cdn.example/lazy.jpg?w=10&amp;h=20" src="data:image/gif;base64,AA">
    <IMG SRC='../up.webp'>`;
  assert.deepEqual(imagesOfPage(html, base), [
    'https://shop.example/es/p/a-1200.jpg',
    'https://cdn.example/lazy.jpg?w=10&h=20',
    'https://shop.example/es/up.webp',
  ]);
});

test('icons, logos, svg, data and other schemes are dropped, and each URL is listed once', () => {
  const html = `
    <img src="/logo.png"><img src="/icons/cart.png"><img src="/sprite.jpg"><img src="/a.svg">
    <img src="/tracking-pixel.gif"><img src="/placeholder.jpg"><img src="data:image/png;base64,AA">
    <img src="ftp://x.example/a.jpg"><img src="/ok.jpg"><img src="https://shop.example/ok.jpg">`;
  assert.deepEqual(imagesOfPage(html, base), ['https://shop.example/ok.jpg']);
});

test('at most MAX_CANDIDATES images are given', () => {
  const html = Array.from({ length: MAX_CANDIDATES + 5 }, (_, i) => `<img src="/p${i}.jpg">`).join('');
  const images = imagesOfPage(html, base);
  assert.equal(images.length, MAX_CANDIDATES);
  assert.equal(images[0], 'https://shop.example/p0.jpg');
});

test('a page with no image gives an empty list', () => {
  assert.deepEqual(imagesOfPage('<html><body>Hi</body></html>', base), []);
  assert.deepEqual(imagesOfPage('', base), []);
});

const fakeFetch = (respond) => {
  const calls = [];
  const fetchFn = async (url, options) => {
    calls.push({ url, options });
    return respond(url);
  };
  return { calls, fetchFn };
};

test('loadPageImages fetches through the proxy with a timeout (LNK-1)', async () => {
  const { calls, fetchFn } = fakeFetch(() => ({ ok: true, text: async () => '<img src="/a.jpg">' }));
  assert.deepEqual(await loadPageImages(base, fetchFn), { images: ['https://shop.example/a.jpg'] });
  assert.equal(calls[0].url, proxyUrl(base));
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test('loadPageImages gives error.linkFailed and never throws (LNK-3)', async () => {
  const failed = { error: { key: 'error.linkFailed' } };
  const responses = [
    () => ({ ok: false, status: 404, text: async () => '<img src="/a.jpg">' }),
    () => { throw new TypeError('network'); },
    () => ({ ok: true, text: async () => '<p>no images</p>' }),
    () => ({ ok: true, text: async () => { throw new Error('body'); } }),
  ];
  for (const respond of responses) assert.deepEqual(await loadPageImages(base, fakeFetch(respond).fetchFn), failed);
  assert.deepEqual(await loadPageImages('not a url', fakeFetch(responses[2]).fetchFn), failed);
});
