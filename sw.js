/**
 * sw.js — Service Worker（PWA Phase2準備）
 * 現時点ではキャッシュ戦略の骨格のみ。
 * Phase2でオフライン完全対応に拡張予定。
 */

const CACHE_NAME = 'drill-v1';

// キャッシュするリソース（静的アセット）
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/i18n.js',
  '/js/storage.js',
  '/js/extractor.js',
  '/js/generator.js',
  '/js/drill.js',
  '/js/app.js',
];

/* インストール：静的アセットをキャッシュ */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* アクティベート：古いキャッシュを削除 */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* フェッチ：キャッシュファースト戦略 */
self.addEventListener('fetch', event => {
  // CDN（PDF.js / Tesseract.js）はネットワーク優先
  if (event.request.url.includes('cdnjs.cloudflare.com') ||
      event.request.url.includes('jsdelivr.net')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 静的アセットはキャッシュファースト
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // 成功したレスポンスをキャッシュに追加
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
