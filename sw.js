/* Tabe service worker — app-shell cache, network-first for updates */
const CACHE = 'tabe-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only handle our own origin; let Firebase / Open Food Facts / CDN go straight to network.
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // network-first so a new deploy is picked up; fall back to cached shell offline
    e.respondWith(
      fetch(req).then(r => { caches.open(CACHE).then(c => c.put('./index.html', r.clone())); return r; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  // static assets: cache-first, revalidate in background
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(r => { caches.open(CACHE).then(c => c.put(req, r.clone())); return r; }).catch(() => cached);
      return cached || net;
    })
  );
});
