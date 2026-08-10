// Kill-switch: la v1 de este SW cacheaba "/" en cache-first para siempre, lo que dejaba a
// cualquiera que ya lo hubiera instalado atascado en una build vieja (solo incógnito, sin SW
// instalado, mostraba la version actual). Etapa de demo: mejor sin SW por ahora que arriesgar
// este tipo de bug otra vez. Este archivo reemplaza al viejo, se autodestruye en cuanto el
// navegador lo detecta (chequeo de update automático en cada navegación dentro del scope) y
// fuerza un reload de las pestañas abiertas para que carguen limpio desde la red.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      const clientsList = await self.clients.matchAll({ type: "window" });
      clientsList.forEach((client) => client.navigate(client.url));
      await self.registration.unregister();
    })()
  );
});
