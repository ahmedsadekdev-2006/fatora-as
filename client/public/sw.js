const CACHE = "daftary-shell-v3";
const SHELL = ["/", "/manifest.webmanifest", "/site-icon.ico", "/logo.png"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }).catch(() => new Response(JSON.stringify({ message: "لا يوجد اتصال بالخادم" }), { status: 503, headers: { "Content-Type": "application/json" } })));
    return;
  }
  const isAppAsset = event.request.mode === "navigate" || /\.(js|css|tsx?|jsx?)($|\?)/.test(url.pathname);
  if (isAppAsset) {
    event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(cached => cached || caches.match("/"))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match("/"))));
});
