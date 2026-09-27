// Service Worker: hält Portal und Spiele offline verfügbar (Cache-first, Version 9d41a7ff1d)
const CACHE = 'spsquest-9d41a7ff1d';
const FILES = ["./","./index.html","./impressum.html","./datenschutz.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./data/scl.json","./data/scl_live.json","./scl/","./scl/index.html","./scl/manifest.webmanifest","./data/kop.json","./data/kop_live.json","./kop/","./kop/index.html","./kop/manifest.webmanifest"];
const QUESTS = ["scl","kop"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(caches.match(e.request, { ignoreSearch:true }).then(r => r || fetch(e.request).then(res => {
    if(res.ok){ const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
    return res;
  }).catch(() => { const q = QUESTS.find(k => url.pathname.startsWith('/' + k + '/')); return caches.match(q ? './' + q + '/index.html' : './index.html'); })));
});
