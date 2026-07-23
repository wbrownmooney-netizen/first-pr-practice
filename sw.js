// Minimal app-shell service worker. Only ever touches same-origin GET
// requests for this site's own static files (HTML/JS/manifest/icon) —
// every request to CoinGecko, Finnhub, Twelve Data, CryptoCompare-style
// news APIs, or the charting CDN passes straight through untouched, so
// this never caches or serves stale live price/news data.
const CACHE_NAME = 'trading-app-shell-v2';
const APP_SHELL = [
  'index.html',
  'trading.html',
  'signals.js',
  'portfolio.js',
  'options.js',
  'manifest.json',
  'icon.svg',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network-first: always prefer a fresh copy of the app's own files,
  // falling back to the cached version only when offline.
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
