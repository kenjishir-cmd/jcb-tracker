// =============================================
// JCB 登錄管家 Service Worker v1.22
// 離線優先策略：Cache First → Network Fallback
// =============================================

const CACHE_NAME = 'jcb-butler-v1.22';
const OFFLINE_URL = './index.html';

// 預先快取的資源清單
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  // Google Fonts — 快取字型讓離線也能顯示中文
  'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&family=DM+Mono:wght@400;500&display=swap',
];

// ── Install：預先快取所有資源 ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 逐一快取，單一失敗不影響整體
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] 快取失敗:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate：清除舊版快取 ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] 刪除舊快取:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch：Cache First，失敗才走網路 ─────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 只處理 GET 請求
  if (request.method !== 'GET') return;

  // Google Fonts：Stale-While-Revalidate
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 同源資源：Cache First
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }
});

// Cache First 策略
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // 網路失敗時，嘗試回傳主頁（讓 App Shell 顯示）
    const fallback = await caches.match(OFFLINE_URL);
    return fallback || new Response('離線中，請稍後再試', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// Stale-While-Revalidate 策略（字型用）
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);

  return cached || fetchPromise;
}

// ── Message：手動觸發更新 ──────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
