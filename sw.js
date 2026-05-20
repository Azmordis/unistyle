// UniStyle - Service Worker
// Strategy: network-first for index.html (updates reach users immediately);
//           cache-first for everything else (icons, manifest - rarely change).

const CACHE_NAME = 'unistyle-v2';

const ASSETS = [
  './',
  './index.html',
  './engine.js',
  './manifest.json',
  './icon.svg',
  './privacy.html'
];

// On install: cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// On activate: delete old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// On fetch: network-first for HTML (ensures updates reach installed PWA users);
//           cache-first for all other assets.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isHTML = url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '';

  if (isHTML) {
    // Network-first: try live version, fall back to cache if offline
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first: icons, manifest, etc. change rarely.
    // On miss, fetch from network AND write to cache so subsequent offline visits work.
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});
