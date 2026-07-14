/*
 * Service Worker KedaiPOS
 * - App shell & aset statis: stale-while-revalidate (cepat + selalu diperbarui di belakang layar)
 * - Navigasi (HTML): network-first, fallback ke shell yang di-cache saat offline
 * - GET /api/*: network-first dengan fallback cache — POS tetap bisa memuat menu/meja saat offline
 * - Request non-GET tidak pernah di-cache (transaksi offline ditangani oleh antrian di aplikasi)
 */

const VERSION = 'kedaipos-v1';
const STATIC_CACHE = `${VERSION}-static`;
const API_CACHE = `${VERSION}-api`;
const APP_SHELL = ['/', '/manifest.json', '/logo.png', '/favicon.ico'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached || networkPromise.then((res) => {
    if (!res) throw new Error('offline dan tidak ada cache');
    return res;
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API: network-first supaya data selalu segar, cache sebagai cadangan offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Navigasi halaman: network-first, fallback ke app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Aset statis (JS/CSS/font/gambar hasil build & /storage)
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});
