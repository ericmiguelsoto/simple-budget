// sw.js — the service worker: makes the app open offline.
//
// STRATEGY: NETWORK-FIRST, cache as fallback. When online, every request
// goes to the network and the fresh copy is stored; the cache is only
// used when the network fails (offline / flaky venue wifi). This is a
// deliberate safety choice: cache-first workers once trapped Eric's phone
// on a broken version for days (see tasks/lessons.md). Slightly slower
// to open, impossible to poison.
//
// Bump CACHE_VERSION whenever deployed files change, so retired files
// get cleaned out of storage on activate.

const CACHE_VERSION = "budget-v3";

const CORE_FILES = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/logic.js",
  "./js/storage.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Install: stash a first copy of everything, activate immediately.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete caches from older versions, take over open pages.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Fetch: network first, fall back to cache, and for page loads fall
// back to the cached shell as a last resort.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (!request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Keep the offline copy fresh with every successful load.
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === "navigate") {
          const shell = await caches.match("./index.html");
          if (shell) return shell;
        }
        return Response.error();
      })
  );
});
