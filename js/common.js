// js/common.js — Funciones compartidas entre todas las páginas
// para evitar duplicación en catalogo-1, index-1/2/3, contacto-1/2, etc.

/** Toggle navegación móvil */
function toggleNav() {
  document.body.classList.toggle('nav-open');
}

/** Cerrar navegación al hacer click en un link */
document.querySelectorAll('.site-nav a').forEach(function(a) {
  a.addEventListener('click', function() {
    document.body.classList.remove('nav-open');
  });
});

var navHamburger = document.querySelector('.nav-hamburger');
if (navHamburger) navHamburger.addEventListener('click', toggleNav);

/** Escape HTML para evitar XSS */
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/** Slugificar texto (normalizar acentos, espacios, caracteres especiales) */
function slugificarCliente(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Modal genérico: abrirModal(tipo) — utilizado por legal, contacto, catalogo */
var MODAL_TEXTOS = {};

function abrirModal(tipo) {
  var contenido = MODAL_TEXTOS[tipo] || '<p>Contenido no disponible</p>';
  var el = document.getElementById('modal-contenido');
  if (el) {
    el.innerHTML = contenido;
    var modal = document.getElementById('modal-legal') || document.getElementById('modal-generico');
    if (modal) {
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }
  }
}

function cerrarModal() {
  var modals = document.querySelectorAll('[id$="-modal"]');
  modals.forEach(function(m) { m.style.display = 'none'; });
  document.body.style.overflow = '';
}

// Cerrar modal con Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') cerrarModal();
});

/** Manejo de cookies y analytics */
var COOKIES_ACEPTADAS = localStorage.getItem('bl_cookie_consent') === 'true';

function aceptarCookies() {
  localStorage.setItem('bl_cookie_consent', 'true');
  COOKIES_ACEPTADAS = true;
  activarAnalytics();
  var banner = document.getElementById('cookie-banner');
  if (banner) banner.style.display = 'none';
}

function rechazarCookies() {
  localStorage.setItem('bl_cookie_consent', 'false');
  COOKIES_ACEPTADAS = false;
  var banner = document.getElementById('cookie-banner');
  if (banner) banner.style.display = 'none';
}

function activarAnalytics() {
  if (COOKIES_ACEPTADAS && window.gtag) {
    gtag('config', 'G-XXXXX', { 'anonymize_ip': true });
  }
}

// Auto-activar analytics si cookies aceptadas
if (COOKIES_ACEPTADAS) activarAnalytics();

/** Cierre de modal/menu móvil con tecla Escape o click fuera */
document.addEventListener('click', function(e) {
  if (e.target.id && e.target.id.includes('-modal')) {
    cerrarModal();
  }
});

/** Inicializar Service Worker updater (notificación de nuevas versiones) */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then(function(reg) {
      console.log('[SW] Registrado OK');
      
      // Escuchar cuando hay una actualización disponible
      reg.addEventListener('updatefound', function() {
        var newWorker = reg.installing;
        newWorker.addEventListener('statechange', function() {
          if (newWorker.state === 'waiting' && navigator.serviceWorker.controller) {
            // Nueva versión instalada y lista → mostrar banner
            (function showUpdateBanner() {
              if (document.getElementById('sw-update-banner')) return;
              var banner = document.createElement('div');
              banner.id = 'sw-update-banner';
              banner.innerHTML = '<div style="position: fixed; bottom: 20px; right: 20px; background: #17233F; color: white; padding: 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 14px; max-width: 300px; z-index: 9999; font-family: system-ui, -apple-system, sans-serif; animation: slideIn 0.3s ease-out;"><p style="margin: 0 0 12px 0; font-weight: 500;">✨ Bendito Lab actualizado</p><p style="margin: 0 0 12px 0; color: #ccc; font-size: 13px;">Nueva versión disponible.</p><div style="display: flex; gap: 8px;"><button id="sw-update-reload" style="flex: 1; background: #FF6B35; border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500;">Recargar</button><button id="sw-update-close" style="flex: 1; background: transparent; border: 1px solid #555; color: #ccc; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">Ahora no</button></div></div><style>@keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }</style>';
              document.body.appendChild(banner);
              document.getElementById('sw-update-reload').addEventListener('click', function() { window.location.reload(); });
              document.getElementById('sw-update-close').addEventListener('click', function() { banner.remove(); });
              setTimeout(function() { if (banner.parentNode) banner.remove(); }, 10000);
            })();
          }
        });
      });
      
      // Polling: chequear actualizaciones cada hora
      setInterval(function() { reg.update(); }, 60 * 60 * 1000);
    })
    .catch(function(err) { console.error('[SW] Error:', err); });
}
