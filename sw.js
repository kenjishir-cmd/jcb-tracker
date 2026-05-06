const CACHE_VERSION = 'jcb-v3';
const CACHE_URLS = [
  './index.html',
  './index.html?v=3',
  './manifest.json',
  './sw.js',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&family=DM+Mono:wght@400;500&display=swap'
];

// ── INSTALL：預快取所有核心資源 ──────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      Promise.allSettled(
        CACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] cache.add failed:', url, err))
        )
      )
    ).then(() => console.log('[SW] Install complete:', CACHE_VERSION))
  );
  self.skipWaiting();
});

// ── ACTIVATE：清除所有舊版快取 ───────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      console.log('[SW] Existing caches:', keys);
      return Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH：Cache First + 背景更新 ────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;
  if (e.request.url.startsWith('chrome-extension')) return;

  e.respondWith(
    caches.match(e.request, { ignoreSearch: false }).then(cached => {

      // ── 有快取：立即回傳，背景偷偷更新 ──
      if (cached) {
        fetch(e.request).then(res => {
          if (res && res.status === 200)
            caches.open(CACHE_VERSION).then(c => c.put(e.request, res.clone()));
        }).catch(() => {});
        return cached;
      }

      // ── 沒快取：嘗試網路，成功就存入快取 ──
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, resClone));
        }
        return res;
      }).catch(() => {
        // 完全離線且無快取 → 回傳 index.html
        return caches.match('./index.html').then(fallback => {
          if (fallback) return fallback;
          return new Response(
            '<html><body style="background:#0d0f14;color:#e8eaf0;font-family:sans-serif;text-align:center;padding:60px"><h2>⚠️ 離線中</h2><p>請連線後重新開啟</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        });
      });
    })
  );
});

// ── 接收主頁面訊息 ────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING received');
    self.skipWaiting();
  }
});
