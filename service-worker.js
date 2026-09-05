const CACHE = "freelancekit-static-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/pricing.html",
  "/privacy.html",
  "/terms.html",
  "/contact.html",
  "/login.html",
  "/signup.html",
  "/style.css",
  "/config.js",
  "/ui.js",
  "/auth.js",
  "/assets/favicon.svg",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const privatePages = [
    "/dashboard.html",
    "/clients.html",
    "/invoices.html",
    "/quotations.html",
    "/payments.html",
    "/settings.html",
    "/expenses.html",
    "/reset-password.html",
  ];
  if (privatePages.some((path) => url.pathname.endsWith(path) || url.pathname === path)) {
    return;
  }

  if (url.pathname.startsWith("/auth/") || url.pathname.includes("supabase")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") return response;
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
