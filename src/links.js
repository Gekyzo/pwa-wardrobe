import { isWebUrl } from '#garments';

// The images of a shop page. The browser cannot read another origin's page (CORS), so the page
// comes through a public proxy, Jina Reader, which also runs the scripts of the page and gives the
// rendered HTML. The HTML is read with patterns, not a DOM, so that the tests run in Node.
export const PROXY = 'https://r.jina.ai/';
export const TIMEOUT = 20000;
export const MAX_CANDIDATES = 24;

const SKIP = /logo|icon|sprite|pixel|placeholder|chip|swatch/i;

export const proxyUrl = (link) => `${PROXY}${link}`;

const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
const decode = (text) =>
  text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (whole, name) => {
    if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? whole;
    return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  });

const attributesOf = (tag) =>
  Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)].map(([, name, a, b, c]) => [
      name.toLowerCase(),
      decode(a ?? b ?? c),
    ]),
  );

const tagsOf = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(([tag]) => attributesOf(tag));

// The widest candidate of a srcset: by its `w`, else by its `x`, else the first.
const widest = (srcset = '') => {
  const candidates = srcset
    .split(',')
    .map((part) => part.trim().split(/\s+/))
    .filter(([url]) => url)
    .map(([url, size = '1x']) => ({ url, size: parseFloat(size) || 0 }));
  return candidates.reduce((best, next) => (next.size > best.size ? next : best), candidates[0] ?? { url: null }).url;
};

const metaImages = (html) =>
  tagsOf(html, 'meta')
    .filter((meta) => ['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image'].includes(meta.property ?? meta.name))
    .map((meta) => meta.content);

const isProduct = (node) => [node?.['@type']].flat().includes('Product');

const ldImages = (html) =>
  [...html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap(([, body]) => {
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return [];
    }
    const nodes = [data].flat().flatMap((node) => [node, ...[node?.['@graph'] ?? []].flat()]);
    return nodes
      .filter(isProduct)
      .flatMap((node) => [node.image ?? []].flat())
      .map((image) => (typeof image === 'string' ? image : image?.url))
      .filter((image) => typeof image === 'string');
  });

// Each <img> gives one image: the widest of its srcset, else data-src, else src, the first that
// is kept.
const imgImages = (html, keep) =>
  tagsOf(html, 'img')
    .map((img) => [widest(img.srcset), widest(img['data-srcset']), img['data-src'], img.src].map((url) => keep(url)).find(Boolean))
    .filter(Boolean);

const resolver = (base) => (url) => {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    const absolute = new URL(url.trim(), base);
    if (!isWebUrl(absolute.href) || absolute.pathname.toLowerCase().endsWith('.svg') || SKIP.test(absolute.pathname)) return null;
    return absolute.href;
  } catch {
    return null;
  }
};

// The images of a page, in the order of trust: meta, JSON-LD of a Product, then the img tags.
export const imagesOfPage = (html, base) => {
  const keep = resolver(base);
  const found = [...metaImages(html).map(keep), ...ldImages(html).map(keep), ...imgImages(html, keep)].filter(Boolean);
  // One path with another query, such as `?width=600`, is the same image.
  const byPath = new Map();
  for (const url of found) {
    const { origin, pathname } = new URL(url);
    if (!byPath.has(origin + pathname)) byPath.set(origin + pathname, url);
  }
  return [...byPath.values()].slice(0, MAX_CANDIDATES);
};

const failed = { error: { key: 'error.linkFailed' } };

// `{ images }` of the page at `link`, or `{ error }`. It never throws.
export const loadPageImages = async (link, fetchFn = fetch) => {
  if (!isWebUrl(link)) return failed;
  try {
    const response = await fetchFn(proxyUrl(link), { headers: { 'X-Return-Format': 'html' }, signal: AbortSignal.timeout(TIMEOUT) });
    if (!response.ok) return failed;
    const images = imagesOfPage(await response.text(), link);
    return images.length ? { images } : failed;
  } catch {
    return failed;
  }
};
