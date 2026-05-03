const CACHE_NAME = 'universal-pwa-cache-v1';

// 只要把你想離線保存的「進入點」放在這裡即可
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// 1. 安裝：儲存基本檔案
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting(); // 強制跳過等待，立即生效
});

// 2. 激活：清理舊快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
});

// 3. 核心邏輯：萬用策略 (Stale-While-Revalidate)
self.addEventListener('fetch', event => {
  // 只處理 GET 請求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        // 建立一個網路請求
        const fetchedResponse = fetch(event.request).then(networkResponse => {
          // 如果網路請求成功，就把新內容存進快取
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // 這裡可以處理完全斷網且沒快取時的備案（例如回傳 offline.html）
        });

        // 優先回傳快取內容，如果沒快取就等網路請求
        return cachedResponse || fetchedResponse;
      });
    })
  );
});
