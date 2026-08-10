/* 병원 관리 앱 서비스워커 — 오프라인 지원 */
const CACHE = 'hosp-v1';
const STATIC = ['./', './index.html', './xlsx.mini.min.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;

  // 설정/HTML은 항상 최신 우선(네트워크 우선) → 배포 갱신 즉시 반영, 오프라인이면 캐시
  const freshFirst = sameOrigin && (
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('index.html') ||
    url.pathname.endsWith('firebase-config.js') ||
    url.pathname.endsWith('manifest.webmanifest'));

  if (freshFirst) {
    e.respondWith(fetch(req).then(res => {
      const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  // 그 외 같은 출처 정적 파일(라이브러리·아이콘)은 캐시 우선
  if (sameOrigin) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res;
    })));
  }
  // 외부(파이어베이스/gstatic 등)는 그대로 네트워크
});
