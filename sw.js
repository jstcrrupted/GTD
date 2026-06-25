/* GTD Pro Service Worker (offline shell) */
const CACHE_NAME = 'gtd-pro-cache-v1';
const ASSETS = [
  './',
  './GTD_Pro_App.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        // cache same-origin navigations/assets
        try {
          const url = new URL(req.url);
          if (url.origin === self.location.origin) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
        } catch(e) {}
        return resp;
      }).catch(() => cached || caches.match('./GTD_Pro_App.html'));
    })
  );
});
