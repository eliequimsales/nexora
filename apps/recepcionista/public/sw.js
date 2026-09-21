// Service Worker para Nexora PWA
const CACHE_NAME = "nexora-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Apenas métodos GET
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Não intercepta chamadas de API ou extensões
  if (url.pathname.startsWith("/api/") || !url.protocol.startsWith("http")) {
    return;
  }

  // Network-first com fallback para cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a resposta for válida, clona para o cache caso seja asset estático
        if (response.status === 200 && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
