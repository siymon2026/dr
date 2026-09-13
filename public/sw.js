const CACHE = "siymon-static-v1";
const ASSETS = ["/offline.html", "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/fonts/dm-sans-regular.ttf", "/fonts/dm-sans-semibold.ttf", "/fonts/dm-sans-bold.ttf", "/images/delivery-scooter.png"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("siymon-static-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("message", event => { if (event.data?.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate") { event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html"))); return; }
  // Only public, non-sensitive assets are cached. Driver data and authenticated pages never enter the cache.
  if (ASSETS.includes(url.pathname)) event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
