// Service worker: keeps the app itself available offline and loading instantly.
// Hub data never goes through here (it's POSTed to Apps Script and kept in IndexedDB).
// Bump VERSION whenever app files change so devices pick up the update.
const VERSION = 'hh-0.2.0';

const SHELL = [
  './',
  'index.html',
  'config.js',
  'manifest.webmanifest',
  'css/tokens.css',
  'css/app.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'js/main.js', 'js/vendor.js', 'js/api.js', 'js/db.js', 'js/schema.js', 'js/store.js', 'js/sync.js',
  'js/device.js', 'js/demo.js',
  'js/ui/shell.js', 'js/ui/hooks.js', 'js/ui/icons.js', 'js/ui/bits.js', 'js/ui/home.js', 'js/ui/settings.js',
  'js/ui/setup.js', 'js/ui/sheets.js', 'js/ui/ambient.js', 'js/ui/placeholder.js',
  'https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.module.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;            // API calls are POSTs: straight to the network
  const url = new URL(req.url);
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com')) return;

  // Fonts: cache as they're used.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(VERSION).then((cache) => cache.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    }))));
    return;
  }

  // App files: from the cache first, network as a fallback; page navigations fall back to the app.
  event.respondWith(caches.match(req, { ignoreSearch: url.origin === self.location.origin }).then((hit) => {
    if (hit) return hit;
    return fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
  }));
});
