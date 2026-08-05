// CACHE_VERSION is replaced with a unique timestamp by amplify.yml before each build
const CACHE = 'free-mind-BUILD_VERSION';
const PRECACHE = ['/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        // After the new SW takes control, reload all open windows so they pick up
        // the new HTML (which references new content-hashed JS/CSS chunks).
        // Without this, old open tabs keep running stale bundles.
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      })
      .then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      })
  );
});

// Clone response synchronously before returning — cloning after return causes
// "Response body is already used" because the browser consumes it immediately.
function cacheResponse(request, response) {
  const clone = response.clone(); // must clone BEFORE the original is returned
  caches.open(CACHE).then((c) => c.put(request, clone));
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // Never intercept API calls — always hit the network
  if (e.request.url.includes('/api/')) return;

  const url = new URL(e.request.url);

  // ── Next.js hashed static assets (_next/static/) ──────────────
  // Cache-first: filenames are content-hashed so stale is impossible
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res.ok) cacheResponse(e.request, res);
          return res;
        });
      })
    );
    return;
  }

  // ── HTML navigation requests ───────────────────────────────────
  // Network-first so new deployments are always picked up immediately.
  // Falls back to cache only when offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) cacheResponse(e.request, res);
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // ── Everything else (images, fonts, manifests) ─────────────────
  // Network-first with cache fallback for offline resilience
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) cacheResponse(e.request, res);
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
