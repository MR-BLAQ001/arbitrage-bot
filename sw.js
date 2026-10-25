/* Service worker: makes the app installable and usable offline.
 * App shell is cached on install; same-origin GETs are cached
 * (stale-while-revalidate). Exchange API calls are never cached.
 */
const CACHE = "praise-arb-v1";
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "js/config.js",
  "js/market.js",
  "js/livefeed.js",
  "js/exchange-api.js",
  "js/arbitrage.js",
  "js/portfolio.js",
  "js/bot.js",
  "js/ui.js",
  "js/main.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return; // let APIs through

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
