/**
 * Soke Service Worker
 * 
 * Provides:
 * - Offline-first caching (app shell + API responses)
 * - Background Sync API for pending writes
 * - Push notification handling
 */

const CACHE_VERSION = "9jatruth-v3";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const API_CACHE = `${CACHE_VERSION}-api`;
const OFFLINE_URL = "/offline.html";

// App shell resources to precache
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/offline.html",
];

// Install: precache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(async (cache) => {
      await Promise.all(
        APP_SHELL.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "reload" });
            if (res.ok) await cache.put(url, res);
          } catch {
            // Skip entries that fail (e.g. offline) instead of failing install
          }
        })
      );
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching (they go through sync queue)
  if (request.method !== "GET") {
    // For POST/PUT/DELETE, try network, fall back to sync queue
    if (request.url.includes("/api/")) {
      event.respondWith(
        fetch(request).catch(() => {
          return new Response(
            JSON.stringify({ error: "offline", message: "Operation queued for sync" }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        })
      );
    }
    return;
  }

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fall back to cache
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({ error: "offline", message: "Data unavailable offline" }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            );
          });
        })
    );
    return;
  }

  // Page navigations: network-first, fall back to offline page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// Background Sync: process pending operations
self.addEventListener("sync", (event) => {
  if (event.tag === "soke-background-sync") {
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll();
        // Notify clients to sync
        clients.forEach((client) => {
          client.postMessage({ type: "BACKGROUND_SYNC_TRIGGER" });
        });
      })()
    );
  }
});

// Push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "9jatruth Alert", body: event.data.text() };
  }

  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag: data.category || "general",
    data: {
      url: data.url || "/",
      category: data.category,
      neighborhoodId: data.neighborhoodId,
    },
    actions: [
      { action: "view", title: "View Details" },
      { action: "dismiss", title: "Dismiss" },
    ],
    requireInteraction: data.severity === "critical",
    vibrate: data.severity === "critical" ? [200, 100, 200] : [100],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Soke Alert", options)
  );
});

// Notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      // Focus existing window
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Message handler for communication with client
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
