/* Kanva service worker — network-first for pages (fixes always land), cache-first for assets */
const CACHE = 'kanva-v9';
const SHELL = ['./', './index.html', './style.css?v=4', './app.js?v=6', './manifest.json', './kanva-logo.png', './Kanva icon 192.png', './Kanva icon 512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const isPage = e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html');
  if (isPage) {
    // Network-first: a fixed page must never be stuck behind an old cached copy.
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => { try { c.put('./index.html', copy); } catch(_){} });
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => { try { c.put(e.request, copy); } catch(_){} });
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
