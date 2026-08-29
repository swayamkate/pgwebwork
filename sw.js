// Service worker disabled — was causing cache issues on Cloudflare Pages.
// On activate, delete all old caches. No fetch handler = always network.
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});