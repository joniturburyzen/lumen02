// ─── SERVICE WORKER: ACTUALIZACIÓN GARANTIZADA ───────────────────────────────
// v20 — Siempre carga la última versión, incluso en iOS
// ─────────────────────────────────────────────────────────────────────────────

const CACHE = "lumen-v21";

// Archivos mínimos para funcionar offline
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

// ── INSTALL ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting(); // activa inmediatamente
});

// ── ACTIVATE ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim(); // controla todas las pestañas
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo GET
  if (req.method !== "GET") return;

  // 1) HTML SIEMPRE desde la red (network-first)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // 2) JS y WASM → network-first (siempre intenta la red, fallback a caché)
  if (url.pathname.endsWith(".js") || url.pathname.endsWith(".wasm")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 3) Resto de assets → cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((res) => {
        if (!res || res.status !== 200) return res;
        caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      });
    })
  );
});
