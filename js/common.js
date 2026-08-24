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
