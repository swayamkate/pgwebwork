const CACHE_NAME = "pg-manager-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./login.html",
  "./signup.html",
  "./styles.css",
  "./manage.css",
  "./config.js",
  "./auth.js",
  "./store.js",
  "./app.js",
  "./profile.js",
  "./rent.js",
  "./import.js",
  "./account.js",
  "./sheets.js",
  "./manifest.json",
  "./favicon.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) { return caches.delete(k); }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Network-first strategy for dynamic data, falling back to cache
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") { return; }
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((cached) => cached || caches.match("./index.html")))
  );
});