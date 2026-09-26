const CACHE_NAME = "residence-ops-shell-v3";

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
      data: { url: data.url || "/notifications" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Un appui sur la notification ouvre directement la page concernée. Seules les adresses de l'app
  // elle-même sont suivies : tout autre lien retombe sur le centre de notifications.
  let target = new URL("/notifications", self.location.origin);
  try {
    const candidate = new URL(event.notification.data?.url || "/notifications", self.location.origin);
    if (candidate.origin === self.location.origin) target = candidate;
  } catch {
    // lien invalide : centre de notifications
  }
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if ("navigate" in open) await open.navigate(target.href).catch(() => {});
        return;
      }
      await self.clients.openWindow(target.href);
    })()
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
