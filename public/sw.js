// Civia — Service Worker
//
// Strategy summary:
//   - Static assets (/_next/static, fonts, images): cache-first
//   - HTML documents: network-first, fall back to cache, then offline
//   - APIs (/api/*): network-only (data is dynamic, no value in caching)
//   - Cross-origin: passthrough (don't try to manage caches we don't own)
//
// Update flow: when a new SW is installed, it waits in `installed` state
// until all clients close. We post a message ("CIVIA_SW_UPDATE_READY")
// and the client UI shows a "refresh to update" pill. Once the user
// acknowledges, the client posts back "SKIP_WAITING" and we activate.

// Bump CACHE_VERSION whenever the precache list or strategy changes
// — old caches get dropped on activate.
// v7 (mai 2026): adăugat /petitii, /proteste, /stiri, /cum-functioneaza
// la precache (high-traffic post launch). PWA users primesc instant
// aceste pagini la a doua deschidere.
const CACHE_VERSION = "v7";
const STATIC_CACHE = `civia-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `civia-runtime-${CACHE_VERSION}`;
const IMAGE_CACHE = `civia-images-${CACHE_VERSION}`;

// Trimmed precache: only the entry points + offline fallback. The old
// 50-route list bloated the install step (every URL is a network round-
// trip) and most of those pages got stale fast anyway. Runtime cache
// picks up other pages as the user visits them.
const STATIC_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  // Top entry points — likely first-click destinations from the home screen
  "/sesizari",
  "/petitii",
  "/proteste",
  "/stiri",
  "/harti",
  "/intreruperi",
  "/ghiduri",
  "/cum-functioneaza",
  // Emergency-critical guides — must be readable when there's no signal
  "/ghiduri/ghid-cutremur",
  "/ghiduri/ghid-vara",
  "/ghiduri/ghid-sesizari",
];

// Cap the runtime caches so installs on low-storage devices don't get
// evicted by the OS for using too much room. Quotas are aspirational —
// the browser may evict earlier under storage pressure.
const RUNTIME_CACHE_MAX_ENTRIES = 60;
const IMAGE_CACHE_MAX_ENTRIES = 100;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // addAll fails atomically — if one URL 404s, the whole install
      // breaks. We add individually so a bad URL doesn't sabotage the
      // SW install.
      await Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch(() => {
            /* asset missing — skip silently */
          }),
        ),
      );
      // Don't auto-activate — let the client decide when to apply the
      // update. The client will postMessage("SKIP_WAITING") after the
      // user acknowledges. Falls back to immediate activation if no
      // client is around to ack (first install).
      const allClients = await self.clients.matchAll({ includeUncontrolled: true });
      if (allClients.length === 0) {
        await self.skipWaiting();
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE && k !== IMAGE_CACHE,
          )
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
      // Notify all open clients that a new SW is in charge — they can
      // optionally show a "you're on the latest" toast. Most apps just
      // show this on the install path; both are valid.
      const allClients = await self.clients.matchAll();
      allClients.forEach((client) =>
        client.postMessage({ type: "CIVIA_SW_ACTIVATED", version: CACHE_VERSION }),
      );
    })(),
  );
});

// Update flow — when the client says "go", drop our `waiting` state
// and take over. The activate handler above takes it from there.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/** LRU-ish trim: keep cache under maxEntries by evicting the oldest. */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // Cache.keys() returns insertion order — drop the oldest excess.
  const overflow = keys.length - maxEntries;
  for (let i = 0; i < overflow; i++) {
    await cache.delete(keys[i]);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET (POST/PUT/PATCH/DELETE bypass SW entirely)
  if (request.method !== "GET") return;

  // Skip cross-origin (we don't manage their caches, and intercepting
  // breaks CORS on a lot of third-party APIs)
  if (url.origin !== self.location.origin) return;

  // Skip Next.js RSC payload routes — they're tightly coupled to the
  // page version that sent them; caching them produces hydration
  // mismatches when the build changes.
  if (url.pathname.startsWith("/_next/data")) return;
  if (url.search.includes("_rsc=")) return;

  // API routes: pass through, never cache. Data is dynamic by design.
  if (url.pathname.startsWith("/api/")) return;

  // Image cache (separate so it has its own LRU budget) — covers all
  // user-uploaded sesizare photos, news thumbnails, county imagery.
  if (request.destination === "image" || /\.(png|jpg|jpeg|webp|avif|gif|svg)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response.ok && response.status !== 206) {
              const clone = response.clone();
              caches
                .open(IMAGE_CACHE)
                .then((cache) => cache.put(request, clone))
                .then(() => trimCache(IMAGE_CACHE, IMAGE_CACHE_MAX_ENTRIES))
                .catch(() => {
                  /* quota exceeded — silent */
                });
            }
            return response;
          })
          .catch(() => {
            // Image fetch failed AND no cache hit — return a tiny
            // 1px transparent PNG so the layout doesn't break with
            // a broken-image icon. Better UX than a missing img.
            return new Response(
              Uint8Array.from(
                atob(
                  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
                ),
                (c) => c.charCodeAt(0),
              ),
              { headers: { "Content-Type": "image/png" } },
            );
          });
      }),
    );
    return;
  }

  // Static assets (JS, CSS, fonts): cache-first with runtime backfill
  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(woff2|woff|ttf|otf|css|js|json)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && response.status !== 206) {
            const clone = response.clone();
            caches
              .open(RUNTIME_CACHE)
              .then((cache) => cache.put(request, clone))
              .then(() => trimCache(RUNTIME_CACHE, RUNTIME_CACHE_MAX_ENTRIES))
              .catch(() => {
                /* quota exceeded — silent */
              });
          }
          return response;
        });
      }),
    );
    return;
  }

  // HTML documents: network-first, fall back to cache, then offline page.
  // The cache-update happens in the background so subsequent offline
  // loads see the latest version the user actually visited.
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.status !== 206) {
            const clone = response.clone();
            caches
              .open(RUNTIME_CACHE)
              .then((cache) => cache.put(request, clone))
              .then(() => trimCache(RUNTIME_CACHE, RUNTIME_CACHE_MAX_ENTRIES))
              .catch(() => {
                /* quota exceeded — silent */
              });
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached ?? caches.match("/offline.html")),
        ),
    );
    return;
  }
});
