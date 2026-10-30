const CACHE = 'wardrobe-shell-v7';

const SHELL = [
  './',
  './index.html',
  './vendor/design-system/design-system.css',
  './vendor/design-system/sheet.js',
  './vendor/design-system/geist.woff2',
  './styles.css',
  './icons.svg',
  './manifest.webmanifest',
  './src/app.js',
  './src/config.js',
  './src/pocketbase.js',
  './src/session.js',
  './src/ui/context.js',
  './src/ui/controls.js',
  './src/ui/install.js',
  './src/ui/motion.js',
  './src/ui/nav.js',
  './src/ui/outfit.js',
  './src/ui/combinations.js',
  './src/ui/wardrobe.js',
  './src/ui/settings.js',
  './src/ui/update.js',
  './src/ui/dust.js',
  './src/ui/onboarding.js',
  './src/ui/whatsnew.js',
  './src/ui/account.js',
  './src/swipe.js',
  './src/particles.js',
  './src/onboarding.js',
  './src/wada.js',
  './src/palette.js',
  './src/garments.js',
  './src/records.js',
  './src/sync.js',
  './src/brands.js',
  './src/measures.js',
  './src/links.js',
  './src/outfits.js',
  './src/install.js',
  './src/sections.js',
  './src/modules.js',
  './src/storage.js',
  './src/version.js',
  './src/whatsnew.js',
  './src/i18n.js',
  './src/locales/en.js',
  './src/locales/es.js',
  './version.json',
  './release-notes/en.md',
  './release-notes/es.md',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/logo.png',
];

// The text of the manifest in the language of the screen, which the page sends (`manifest`
// message). A cache of its own, so it outlives a deploy.
const MANIFEST = 'wardrobe-manifest';
const MANIFEST_TEXT = './manifest-text.json';
const LOCALIZED = ['lang', 'name', 'description'];

// The manifest with each member of LOCALIZED that `text` holds as a non-empty string.
const localizeManifest = (manifest, text) => ({
  ...manifest,
  ...Object.fromEntries(
    LOCALIZED.filter((key) => typeof text?.[key] === 'string' && text[key]).map((key) => [key, text[key]]),
  ),
});

// The images of the garments, from the shops: cache first, so that they show with no connection.
// A cache of its own, so it outlives a deploy; the page sends the URLs to keep (`images` message).
const IMAGES = 'wardrobe-images';

const isRemoteImage = (request) =>
  request.method === 'GET' && request.destination === 'image' && new URL(request.url).origin !== self.location.origin;

const staleImages = (cached, keep) => {
  const kept = new Set(keep);
  return cached.filter((url) => !kept.has(url));
};

// An image of another origin answers opaque: its status cannot be read, so it is kept as it is.
const respondImage = async (request) => {
  const cache = await caches.open(IMAGES);
  const cached = await cache.match(request.url);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') await cache.put(request.url, response.clone()).catch(() => {});
  return response;
};

const pruneImages = async (urls) => {
  const cache = await caches.open(IMAGES);
  const cached = (await cache.keys()).map((request) => request.url);
  await Promise.all(staleImages(cached, urls).map((url) => cache.delete(url)));
};

// `reload` goes past the HTTP cache, so the shell is never a mix of two deploys.
const fill = async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })));
};

self.addEventListener('install', (event) => {
  event.waitUntil(fill().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => ![CACHE, MANIFEST, IMAGES].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Fetches a fresh copy past the HTTP cache and stores it for the next launch.
const refresh = async (cache, request) => {
  const response = await fetch(request.url, { cache: 'no-cache' });
  if (response.ok) await cache.put(request.url, response.clone());
  return response;
};

// Stale-while-revalidate: answer from the cache at once, refresh in the background.
const respond = async (event) => {
  const { request } = event;
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request.url, { ignoreSearch: true });
  const fresh = refresh(cache, request);
  if (cached) {
    event.waitUntil(fresh.catch(() => {}));
    return cached;
  }
  try {
    return await fresh;
  } catch (error) {
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw error;
  }
};

const readManifestText = async () => {
  const stored = await (await caches.open(MANIFEST)).match(MANIFEST_TEXT);
  return stored ? stored.json() : null;
};

// The shell copy of the manifest, in the language that the page sent last.
const respondManifest = async (event) => {
  const response = await respond(event);
  try {
    const text = await readManifestText();
    if (!text) return response;
    const manifest = localizeManifest(await response.clone().json(), text);
    return new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/manifest+json' } });
  } catch {
    return response;
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (isRemoteImage(request)) {
    event.respondWith(respondImage(request));
    return;
  }
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // The page reads the deployed version: the cache must not answer.
  if (url.searchParams.has('latest')) return;
  const manifest = url.pathname === new URL('./manifest.webmanifest', self.location).pathname;
  event.respondWith(manifest ? respondManifest(event) : respond(event));
});

// The Update button and the update toast: load the full shell of the new deploy, then answer on
// the port.
// The page sends the text of the manifest in the language of the screen at each start and
// change of language.
const storeManifestText = async ({ lang, name, description }) => {
  const cache = await caches.open(MANIFEST);
  const body = JSON.stringify({ lang, name, description });
  await cache.put(MANIFEST_TEXT, new Response(body, { headers: { 'Content-Type': 'application/json' } }));
};

self.addEventListener('message', (event) => {
  if (event.data?.type === 'images' && Array.isArray(event.data.urls)) {
    event.waitUntil(pruneImages(event.data.urls).catch(() => {}));
    return;
  }
  if (event.data?.type === 'manifest') {
    event.waitUntil(storeManifestText(event.data).catch(() => {}));
    return;
  }
  if (event.data?.type !== 'refresh') return;
  const [port] = event.ports;
  event.waitUntil(
    fill().then(
      () => port?.postMessage({ ok: true }),
      () => port?.postMessage({ ok: false }),
    ),
  );
});
