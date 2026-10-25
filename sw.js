// Offline support. Bump VERSION whenever you deploy changes so phones pick up the new files.
const VERSION = 'tubecards-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/store.js', 'js/srs.js', 'js/csv.js', 'js/stats.js', 'js/pronounce.js', 'js/speech.js',
  'js/ui.js', 'js/theme.js', 'js/sample.js', 'js/firebase-config.js', 'js/backend-local.js', 'js/backend-firebase.js',
  'js/views/auth.js', 'js/views/study.js', 'js/views/session.js', 'js/views/face.js', 'js/views/editor.js',
  'js/views/import.js', 'js/views/cards.js', 'js/views/speak.js', 'js/views/statsview.js', 'js/views/more.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Firebase SDK files from Google's CDN: cache after first use, refresh in the background.
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(req);
        const net = fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      }),
    );
    return;
  }

  // Our own files: network first so updates show up, cache when offline.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return r;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((m) => m || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
    );
  }
  // Firebase API traffic (Firestore, Auth) is left alone; the SDK has its own offline cache.
});
