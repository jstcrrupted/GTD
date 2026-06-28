/* GTD Pro Service Worker — self-updating app shell */
const CACHE_NAME = 'gtd-pro-shell';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/core.js',
  './js/actions.js',
  './js/storage.js',
  './js/model.js',
  './js/render.js',
  './js/views.js',
  './js/detail.js',
  './js/capture.js',
  './js/settings.js',
  './js/keyboard.js',
  './js/app.js',
  './assets/icons.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null))))
      .then(() => self.clients.claim())
  );
});

// Allow the page to tell a waiting SW to take over immediately.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // Cross-origin (Supabase, Google Fonts, CDNs, etc.): do not intercept/cache.
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first so new HTML/code is picked up immediately,
  // fall back to cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return resp;
        })
        .catch(() => caches.match('./index.html').then((c) => c || caches.match('./')))
    );
    return;
  }

  // Same-origin assets: stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((resp) => {
            if (resp && resp.status === 200) cache.put(req, resp.clone());
            return resp;
          })
          .catch(() => cached);
        // Serve cache immediately if present; otherwise wait for network.
        return cached || network;
      })
    )
  );
});
