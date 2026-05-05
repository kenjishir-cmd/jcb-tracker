const CACHE_NAME = 'jcb-v1.21-stable';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&family=DM+Mono:wght@400;500&display=swap'
];

// 安裝時快取關鍵檔案
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 清理舊快取
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// 離線攔截邏輯
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cachedResponse => {
      // 如果快取有，直接回傳
      if (cachedResponse) return cachedResponse;

      // 如果快取沒有，去網路上抓
      return fetch(e.request).then(networkResponse => {
        // 抓到後順便存進快取
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return networkResponse;
      }).catch(() => {
        // 如果網路也斷了，且是 HTML 請求，回傳首頁
        if (e.request.mode === 'navigate') {
          return caches.match('./') || caches.match('./index.html');
        }
      });
    })
  );
});
