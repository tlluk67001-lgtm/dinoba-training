// sw.js — DINO BA Service Worker
// Caches the app so it loads even with weak signal.
// Update CACHE_VERSION whenever you deploy a new version of the app.

const CACHE_VERSION = 'dinoba-v1';
const CACHE_FILES = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(CACHE_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Delete old caches when a new version is deployed
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // API calls always go to network (never cache)
  if (e.request.url.includes('/api/')) {
    return;
  }
  // For everything else: try network first, fall back to cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
