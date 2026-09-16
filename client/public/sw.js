const CACHE_NAME = "residence-ops-shell-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  let data = { title: "Résidence Ops", body: "Nouvelle notification" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // ignore malformed payloads
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/pwa-icon.svg",
      badge: "/pwa-icon.svg",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow("/notifications");
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.url.includes("/api/") || event.request.url.includes("/socket.io/")) {
    return;
  }
  // Priorité réseau (pas cache-first) : l'app est déployée souvent, et servir une page/JS
  // périmé pendant qu'une version plus récente attend en arrière-plan a causé de la
  // confusion (page figée jusqu'à un rechargement manuel). Le cache ne sert que de secours
  // hors-ligne, jamais en priorité.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      } catch {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        throw new Error("Réseau indisponible et rien en cache pour cette ressource.");
      }
    })
  );
});
