// =============================================
// JCB 登錄管家 Service Worker v1.23
// 離線強化版：App Shell + API Cache
// =============================================

const CACHE_NAME = 'jcb-butler-v1.23';
const API_CACHE = 'jcb-api-cache-v1';
const OFFLINE_URL = './index.html';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&family=DM+Mono:wght@400;500&display=swap',
];

// ── Install ───────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(() => {})
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== API_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // ⭐⭐⭐ API（最重要）
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstAPI(request));
    return;
  }

  // Google Fonts
  if (url.hostname.includes('fonts')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // App Shell（HTML / JS / CSS）
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }
});

// ── API：Network First（離線用 cache） ───────
async function networkFirstAPI(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;

    return new Response(JSON.stringify({ offline: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ── App Shell：Cache First ─────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // 只對「頁面」fallback
    if (request.destination === 'document') {
      return caches.match(OFFLINE_URL);
    }
  }
}

// ── Stale While Revalidate ────────────────
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(res => {
    if (res && res.ok) {
      cache.put(request, res.clone());
    }
    return res;
  }).catch(() => null);

  return cached || fetchPromise;
}

// ── Message ───────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
