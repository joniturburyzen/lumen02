// ─── LUMEN SERVICE WORKER ───────────────────────────────────────────────────
// v1 — Cache-first para assets estáticos, red para el resto
// El WASM (1.9MB) y el JS se precargan en install → segunda carga instantánea
// ────────────────────────────────────────────────────────────────────────────

const CACHE = 'lumen-v1';

// Assets críticos que se precargan en el install (bloquea activación hasta que estén)
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './pkg/lumen_quill.js',
  './pkg/lumen_quill_bg.wasm',   // ← el más pesado, esencial cachear
];

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())   // activa sin esperar a que cierren tabs
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE)    // borra caches de versiones anteriores
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // toma control inmediato de todos los tabs
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  // Solo GET
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Ignorar peticiones externas (Google Fonts, APIs, etc.)
  if (url.origin !== self.location.origin) return;

  // Ignorar peticiones a la API (/api/...)
  if (url.pathname.includes('/api/')) return;

  // Estrategia: Cache-first → si no está en caché, red → guarda en caché
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      return fetch(e.request).then(response => {
        // No cachear respuestas erróneas u opacas
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }

        // Clonar antes de consumir (los streams solo se leen una vez)
        const toCache = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, toCache));
        return response;
      }).catch(() => {
        // Offline y no está en caché: devuelve la página principal como fallback
        if (e.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
