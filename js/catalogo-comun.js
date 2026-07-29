
// js/catalogo-comun.js — Lógica compartida entre catalogo.html (por tipo de
// producto) y coleccion.html (por negocio/temporada/campaña, filtrado por
// etiqueta): render del grid de productos, modal de detalle y modal de
// presupuesto. Cada página solo aporta su propia forma de obtener/filtrar
// la lista de artículos a mostrar (ver catalogo-2.js / coleccion-2.js).

function toggleNav(){ document.body.classList.toggle('nav-open'); }
document.querySelectorAll('.site-nav a').forEach(function(a){
  a.addEventListener('click', function(){ document.body.classList.remove('nav-open'); });
});

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Artículos actualmente pintados en el grid — el modal de detalle/presupuesto
// busca ahí por id cuando se hace clic en una tarjeta.
var ARTICULOS_MOSTRADOS = [];

function renderGridEn(containerId, lista, mensajeVacio) {
  ARTICULOS_MOSTRADOS = lista;
  var cont = document.getElementById(containerId);

  if (!lista.length) {
    cont.innerHTML = '<p class="catalogo-vacio">' + escapeHtml(mensajeVacio || 'No hay artículos disponibles ahora mismo.') + '</p>';
    return;
  }

  cont.innerHTML = lista.map(function(a){
    var img = a.imagen_principal_url
      ? '<img src="' + escapeHtml(a.imagen_principal_url) + '" alt="' + escapeHtml(a.nombre) + '" loading="lazy">'
      : '<span>Sin imagen</span>';
    var desc = a.descripcion_corta || a.descripcion || '';
    return (
      '<div class="prod-card">' +
        '<div class="prod-clicable" data-detalle-id="' + escapeHtml(a.id) + '">' +
          '<div class="prod-card-img">' + img + '</div>' +
        '</div>' +
        '<div class="prod-card-body">' +
          (a.categoria ? '<p class="prod-cat">' + escapeHtml(a.categoria) + '</p>' : '') +
          '<p class="prod-nombre prod-clicable" data-detalle-id="' + escapeHtml(a.id) + '">' + escapeHtml(a.nombre) + '</p>' +
          (desc ? '<p class="prod-desc">' + escapeHtml(desc) + '</p>' : '') +
          '<button type="button" class="btn-presupuesto" data-articulo-id="' + escapeHtml(a.id) + '">Pedir presupuesto</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  cont.querySelectorAll('.btn-presupuesto').forEach(function(btn){
    btn.addEventListener('click', function(){ abrirModalPresupuesto(btn.dataset.articuloId); });
  });
  cont.querySelectorAll('.prod-clicable').forEach(function(el){
    el.addEventListener('click', function(){ abrirModalDetalle(el.dataset.detalleId); });
  });
}

// ── Modal de presupuesto ──────────────────────────────────
var articuloSeleccionado = null;

function abrirModalPresupuesto(articuloId) {
  articuloSeleccionado = ARTICULOS_MOSTRADOS.find(function(a){ return a.id === articuloId; }) || null;
  document.getElementById('mp-producto-nombre').textContent = articuloSeleccionado ? articuloSeleccionado.nombre : '';
  document.getElementById('presupuesto-form').style.display = 'flex';
  document.getElementById('presupuesto-success').style.display = 'none';
  document.getElementById('presupuesto-form').reset();
  document.getElementById('presupuesto-error').style.display = 'none';
  document.getElementById('modal-presupuesto').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function cerrarModalPresupuesto() {
  document.getElementById('modal-presupuesto').style.display = 'none';
  document.body.style.overflow = '';
}

document.getElementById('btn-cerrar-presupuesto').addEventListener('click', cerrarModalPresupuesto);
document.getElementById('modal-presupuesto').addEventListener('click', function(e){
  if (e.target === this) cerrarModalPresupuesto();
});

document.getElementById('presupuesto-form').addEventListener('submit', async function(e){
  e.preventDefault();
  var form = e.target;
  var f = new FormData(form);
  var errEl = document.getElementById('presupuesto-error');
  errEl.style.display = 'none';
  var btn = form.querySelector('.btn-presupuesto');
  btn.disabled = true; btn.textContent = 'Enviando...';

  var nombreProducto = articuloSeleccionado ? articuloSeleccionado.nombre : 'artículo del catálogo';
  var mensajeExtra = f.get('mensaje');
  var mensaje = 'Interesad@ en: ' + nombreProducto + (mensajeExtra ? ' · ' + mensajeExtra : '');

  try {
    var r = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'cotizacion',
        data: { nombre: f.get('nombre'), email: f.get('email'), telefono: f.get('telefono'), servicio: 'Bendito Lab', mensaje: mensaje }
      })
    });
    var d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Error al enviar');
    form.style.display = 'none';
    document.getElementById('presupuesto-success').style.display = 'block';
  } catch (err) {
    errEl.textContent = err.message + ' — o escríbenos directamente a contacto@benditolab.com';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'ENVIAR SOLICITUD→';
  }
});

// ── Modal de detalle de producto ──────────────────────────
function abrirModalDetalle(articuloId) {
  var a = ARTICULOS_MOSTRADOS.find(function(x){ return x.id === articuloId; });
  if (!a) return;

  var img = a.imagen_principal_url
    ? '<img src="' + escapeHtml(a.imagen_principal_url) + '" alt="' + escapeHtml(a.nombre) + '">'
    : '<span>Sin imagen</span>';

  var atributos = [
    ['Material', a.material],
    ['Colores', a.colores && a.colores.length ? a.colores.join(', ') : null],
    ['Medidas', a.medidas],
    ['Capacidad', a.capacidad],
    ['Formato', a.formato],
    ['Acabados', a.acabados],
    ['Personalización', a.tecnicas_personalizacion && a.tecnicas_personalizacion.length ? a.tecnicas_personalizacion.join(', ') : null],
    ['Guía de tallas', a.guia_tallas],
  ].filter(function(par){ return !!par[1]; });

  var atributosHtml = atributos.length
    ? '<dl class="md-atributos">' + atributos.map(function(par){
        return '<div><dt>' + escapeHtml(par[0]) + '</dt><dd>' + escapeHtml(par[1]) + '</dd></div>';
      }).join('') + '</dl>'
    : '';

  var desc = a.descripcion || a.descripcion_corta || '';

  document.getElementById('md-contenido').innerHTML =
    '<button class="btn-cerrar" id="btn-cerrar-detalle">✕</button>' +
    '<div class="md-img">' + img + '</div>' +
    '<div>' +
      (a.categoria ? '<p class="md-cat">' + escapeHtml(a.categoria) + (a.subcategoria ? ' · ' + escapeHtml(a.subcategoria) : '') + '</p>' : '') +
      '<h3>' + escapeHtml(a.nombre) + '</h3>' +
      (desc ? '<p class="md-desc">' + escapeHtml(desc) + '</p>' : '') +
      atributosHtml +
      '<button type="button" class="btn-presupuesto" id="btn-presupuesto-desde-detalle">Pedir presupuesto</button>' +
    '</div>';

  document.getElementById('btn-cerrar-detalle').addEventListener('click', cerrarModalDetalle);
  document.getElementById('btn-presupuesto-desde-detalle').addEventListener('click', function(){
    cerrarModalDetalle();
    abrirModalPresupuesto(a.id);
  });

  document.getElementById('modal-detalle').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function cerrarModalDetalle() {
  document.getElementById('modal-detalle').style.display = 'none';
  document.body.style.overflow = '';
}

document.getElementById('modal-detalle').addEventListener('click', function(e){
  if (e.target === this) cerrarModalDetalle();
});
