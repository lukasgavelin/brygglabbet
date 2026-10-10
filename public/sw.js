/**
 * Brygglabbet Service Worker.
 * Enables 100% offline capability in cellars and brew rooms,
 * instant loading via Stale-While-Revalidate caching,
 * and reliable asset serving without external network dependencies.
 */

const CACHE_NAME = 'brygglabbet-cache-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW install] Precache error:', err);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only intercept GET requests
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Ignore browser extension requests or non-http(s)
  if (!url.protocol.startsWith('http')) return;

  // Same-origin handling
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        // Stale-While-Revalidate: fetch in background to update cache
        const fetchPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failed - if it's a navigation request and nothing in cache, return index.html
            if (req.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return null;
          });

        // Return cached immediately if found, else wait for network
        return cachedResponse || fetchPromise;
      })
    );
  }
});
