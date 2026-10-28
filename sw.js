// Service worker: deja la app disponible sin señal. Los datos viajan por
// Graph (nunca se cachean aquí); los cambios offline viven en IndexedDB.
const CACHE = 'obrasdrf-v4';
const SHELL = [
  './', 'index.html', 'config.js', 'manifest.json', 'icon.svg', 'vendor/msal-browser.min.js',
  'js/app.js', 'js/auth.js', 'js/graph.js', 'js/schema.js', 'js/store.js', 'js/catalogo.js',
  'js/forms.js', 'js/engine.js', 'js/avance.js',
];

self.addEventListener('install', (e) => {
  // cache:'reload' evita guardar una versión anterior desde la caché HTTP.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
