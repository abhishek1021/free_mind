// BUILD_VERSION is replaced with a unique timestamp by amplify.yml before each build.
// Changing this string is what tells the browser a new SW is available.
const CACHE_NAME = 'free-mind-BUILD_VERSION';

const PRECACHE = ['/manifest.json', '/icon-192.png', '/icon-512.png'];

// ── Install: open the new cache and pre-cache shell assets ────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE))
    // Do NOT call skipWaiting() here — we let the activate handler decide
    // after old caches are cleaned up, so we never skip into a broken state.
  );
});

// ── Activate: purge stale caches, claim clients, notify them to reload ────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME) // delete every cache except the current build
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())   // take control of all open tabs immediately
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then((clients) => {
        // Tell every open tab "a new build is live — please reload".
        // The app listens for this and calls window.location.reload().
        // postMessage is used instead of client.navigate() because navigate()
        // has inconsistent support (especially on iOS Safari).
        clients.forEach((client) =>
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME })
        );
      })
  );
});

// ── Fetch: routing strategy per asset type ────────────────────────────────────
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // Never intercept API calls — always go to the network
  if (e.request.url.includes('/api/')) return;

  const url = new URL(e.request.url);

  // Next.js content-hashed static assets: cache-first (filenames change each build,
  // so a cached file is always the right version — no staleness possible)
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res.ok) putInCache(e.request, res);
          return res;
        });
      })
    );
    return;
  }

  // HTML navigation: network-first so new deployments are always picked up.
  // Falls back to cache only when offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) putInCache(e.request, res);
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Everything else (images, fonts, manifests): network-first with cache fallback
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) putInCache(e.request, res);
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Clone before storing — body can only be consumed once
function putInCache(request, response) {
  const clone = response.clone();
  caches.open(CACHE_NAME).then((c) => c.put(request, clone));
}
