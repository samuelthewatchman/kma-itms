// Makes the app installable and fast on repeat visits by caching the app's own
// files (HTML/CSS/JS/icons). It deliberately does NOT cache anything from
// Supabase or the CDN — your data always comes fresh over the network; only the
// "shell" of the app (the code itself) is cached.
//
// Bump this version string any time you change a cached file, so old phones
// pick up the update instead of serving a stale copy forever.
const CACHE_VERSION = 'kma-itms-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/main.js',
  './js/router.js',
  './js/auth.js',
  './js/ui.js',
  './js/supabaseClient.js',
  './js/api/assets.js',
  './js/api/audit.js',
  './js/api/complaints.js',
  './js/api/notify.js',
  './js/api/reports.js',
  './js/api/tasks.js',
  './js/api/users.js',
  './js/views/assetDetail.js',
  './js/views/assets.js',
  './js/views/audit.js',
  './js/views/complaintDetail.js',
  './js/views/complaints.js',
  './js/views/dashboard.js',
  './js/views/login.js',
  './js/views/newComplaint.js',
  './js/views/pendingWork.js',
  './js/views/register.js',
  './js/views/reports.js',
  './js/views/soon.js',
  './js/views/users.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only ever handle our own GET requests. Supabase calls, the Supabase SDK
  // (jsdelivr) and Google Fonts are left completely alone — untouched, they
  // just use the browser's normal HTTP cache.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => cached); // offline: fall back to whatever we have
      // stale-while-revalidate: serve the cached file instantly if we have one,
      // and quietly refresh the cache in the background for next time
      return cached || network;
    })
  );
});
