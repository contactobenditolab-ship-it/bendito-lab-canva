// Service Worker — Bendito Lab
// Estrategia: network-first para HTML, cache-first para assets estáticos

const CACHE_NAME = 'bendito-lab-v19';
const STATIC_CACHE = 'bendito-static-v19';

// Solo cachear assets estáticos (imágenes, fuentes, iconos) + la portada,
// que es el único HTML que se sirve como fallback offline.
const STATIC_ASSETS = [
  '/manifest.json',
  '/logo-bendito.png',
  '/portada.html',
];

self.addEventListener('install', event => {
  // Activar inmediatamente sin esperar a que cierren las tabs anteriores
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', event => {
  // Eliminar TODAS las caches antiguas sin excepción
  event.waitUntil(
    caches.keys().then(keys => {
      console.log('[SW] Caches encontradas:', keys);
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
            .map(k => {
              console.log('[SW] Eliminando cache antigua:', k);
              return caches.delete(k);
            })
      );
    }).then(() => {
      console.log('[SW] Limpieza completa. Versión activa: ' + CACHE_NAME);
      return self.clients.claim();
    }).then(() => {
      // Forzar recarga de todos los clientes abiertos
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.navigate(client.url));
      });
    })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // HTML: siempre red primero (nunca cache)
  if (event.request.mode === 'navigate' || 
      url.pathname.endsWith('.html') || 
      url.pathname === '/') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        // Solo offline: intentar cache como fallback. caches.match()
        // devuelve una promesa, así que hay que esperarla (un "||" entre dos
        // promesas siempre es truthy y se queda con la primera, nunca prueba
        // la segunda) y, si tampoco hay nada en caché, devolver una
        // Response real en vez de undefined (si no, respondWith lanza error).
        const cached = await caches.match('/portada.html');
        return cached || new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      })
    );
    return;
  }

  // API: nunca cachear
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Assets estáticos: cache-first
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|webp|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(c => c.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Todo lo demás: red primero
  event.respondWith(fetch(event.request));
});
