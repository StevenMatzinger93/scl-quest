// Service Worker: hält Portal und Spiele offline verfügbar (Cache-first, Version 964c48f62a)
const CACHE = 'spsquest-964c48f62a';
const FILES = ["./","./index.html","./impressum.html","./datenschutz.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./data/scl.json","./scl/","./scl/index.html","./scl/manifest.webmanifest"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(caches.match(e.request, { ignoreSearch:true }).then(r => r || fetch(e.request).then(res => {
    if(res.ok){ const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
    return res;
  }).catch(() => caches.match(url.pathname.startsWith('/scl/') ? './scl/index.html' : './index.html'))));
});
