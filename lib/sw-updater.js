/**
 * sw-updater.js — Notifica al usuario cuando hay una nueva versión disponible
 * 
 * Lógica:
 * 1. Registra el SW si no está registrado
 * 2. Escucha controllerchange (nuevo SW ha tomado control)
 * 3. Muestra un banner "Actualización disponible - Recarga"
 */

export async function initSWUpdater() {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service Workers no soportados');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none' // Ignorar cache para sw.js
    });

    console.log('[SW] Registrado:', registration);

    // Listener 1: Cuando un nuevo SW se ha instalado (waiting state)
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      
      newWorker.addEventListener('statechange', () => {
        // Cuando el nuevo SW está "waiting" (listo pero no activado aún),
        // mostrar banner
        if (newWorker.state === 'waiting' && navigator.serviceWorker.controller) {
          // Ya hay un SW anterior en control → hay actualización
          showUpdateBanner();
        }
      });
    });

    // Listener 2: Cuando el nuevo SW ha tomado control
    // (significa que el usuario recargó o aceptó la actualización)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        console.log('[SW] Controlador actualizado');
        // Opcionalmente, recargar la página automáticamente
        // window.location.reload();
      }
    });

    // Polling opcional: cada hora, chequear si hay nuevas versiones
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000); // cada hora

  } catch (err) {
    console.error('[SW] Error al registrar:', err);
  }
}

/**
 * Mostrar banner de actualización disponible
 */
function showUpdateBanner() {
  // Evitar mostrar múltiples banners
  if (document.getElementById('sw-update-banner')) {
    return;
  }

  const banner = document.createElement('div');
  banner.id = 'sw-update-banner';
  banner.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #17233F;
      color: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-size: 14px;
      max-width: 300px;
      z-index: 9999;
      font-family: system-ui, -apple-system, sans-serif;
      animation: slideIn 0.3s ease-out;
    ">
      <p style="margin: 0 0 12px 0; font-weight: 500;">✨ Bendito Lab actualizado</p>
      <p style="margin: 0 0 12px 0; color: #ccc; font-size: 13px;">Una nueva versión está disponible.</p>
      <div style="display: flex; gap: 8px;">
        <button id="sw-update-reload" style="
          flex: 1;
          background: #FF6B35;
          border: none;
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        ">Recargar</button>
        <button id="sw-update-close" style="
          flex: 1;
          background: transparent;
          border: 1px solid #555;
          color: #ccc;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        ">Ahora no</button>
      </div>
    </div>
    <style>
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    </style>
  `;

  document.body.appendChild(banner);

  // Listeners
  document.getElementById('sw-update-reload').addEventListener('click', () => {
    window.location.reload();
  });

  document.getElementById('sw-update-close').addEventListener('click', () => {
    banner.remove();
  });

  // Auto-close después de 10 segundos si no interactúan
  setTimeout(() => {
    if (banner.parentNode) {
      banner.remove();
    }
  }, 10000);
}
