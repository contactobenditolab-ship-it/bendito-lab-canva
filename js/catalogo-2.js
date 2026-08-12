
// js/catalogo-2.js — Específico de catalogo.html: filtro por categoría
// (tipo de producto) sobre el listado completo. El render del grid y los
// modales de detalle/presupuesto viven en catalogo-comun.js (compartido
// con coleccion.html).

var TODOS_LOS_ARTICULOS = [];
var categoriaActiva = '';

function renderCategorias(articulos) {
  var cats = [];
  articulos.forEach(function(a){ if (a.categoria && cats.indexOf(a.categoria) === -1) cats.push(a.categoria); });
  cats.sort();
  var cont = document.getElementById('categorias');
  if (!cats.length) { cont.style.display = 'none'; return; }

  var html = '<button type="button" class="cat-btn' + (!categoriaActiva ? ' activo' : '') + '" data-cat="">Todos</button>';
  cats.forEach(function(c){
    html += '<button type="button" class="cat-btn' + (categoriaActiva === c ? ' activo' : '') + '" data-cat="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>';
  });
  cont.innerHTML = html;
  cont.style.display = 'flex';
  cont.querySelectorAll('.cat-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      categoriaActiva = btn.dataset.cat || '';
      renderCategorias(TODOS_LOS_ARTICULOS);
      pintarGrid();
    });
  });
}

function pintarGrid() {
  var lista = categoriaActiva
    ? TODOS_LOS_ARTICULOS.filter(function(a){ return a.categoria === categoriaActiva; })
    : TODOS_LOS_ARTICULOS;
  renderGridEn('catalogo-grid', lista, 'No hay artículos disponibles ahora mismo en esta categoría.');
}

async function cargarCatalogo() {
  var cont = document.getElementById('catalogo-grid');
  try {
    var r = await fetch('/api/catalogo');
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Error al cargar el catálogo');
    TODOS_LOS_ARTICULOS = d.articulos || [];
    renderCategorias(TODOS_LOS_ARTICULOS);
    pintarGrid();
    abrirArticuloDesdeUrl();
  } catch (e) {
    cont.innerHTML = '<p class="catalogo-vacio">No se ha podido cargar el catálogo. Prueba de nuevo o escríbenos a <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a>.</p>';
  }
}
cargarCatalogo();

// Deep-link: /catalogo?articulo=<id> abre directamente la ficha de ese
// artículo (usado por el botón "Ver en la web" de Bendito OS).
function abrirArticuloDesdeUrl() {
  var id = new URLSearchParams(location.search).get('articulo');
  if (id) abrirModalDetalle(id);
}

// ── Menú "¿Qué necesitas?" ──────────────────────────────────
// Se sirve desde Bendito OS (panel de gestión: Catálogo → ¿Qué necesitas?),
// vía el endpoint público /api/public/necesidades[/recomendaciones]. Si
// falla o no hay ninguna necesidad activa, el menú simplemente no se
// muestra y el catálogo funciona igual que antes (por categoría).
var NECESIDADES_API = 'https://app.benditolab.com';
var necesidadActiva = null;

async function cargarNecesidades() {
  try {
    var r = await fetch(NECESIDADES_API + '/api/public/necesidades');
    var d = await r.json();
    renderNecesidades(d.necesidades || []);
  } catch (e) {
    // silencioso: sin menú de necesidades, el catálogo sigue funcionando
  }
}

function renderNecesidades(necesidades) {
  var cont = document.getElementById('necesidades');
  if (!necesidades.length) { cont.style.display = 'none'; return; }
  cont.innerHTML = necesidades.map(function(n){
    return '<button type="button" class="nec-btn' + (necesidadActiva === n.slug ? ' activo' : '') +
      '" data-slug="' + escapeHtml(n.slug) + '" data-nombre="' + escapeHtml(n.nombre) + '">' +
      (n.icono ? '<span class="nec-icono">' + escapeHtml(n.icono) + '</span>' : '') +
      escapeHtml(n.nombre) +
      '</button>';
  }).join('');
  cont.style.display = 'flex';
  cont.querySelectorAll('.nec-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      if (necesidadActiva === btn.dataset.slug) {
        quitarFiltroNecesidad();
      } else {
        aplicarFiltroNecesidad(btn.dataset.slug, btn.dataset.nombre);
      }
    });
  });
}

async function aplicarFiltroNecesidad(slug, nombre) {
  necesidadActiva = slug;
  document.querySelectorAll('.nec-btn').forEach(function(b){ b.classList.toggle('activo', b.dataset.slug === slug); });

  var catCont = document.getElementById('categorias');
  catCont.style.display = 'none';

  var banner = document.getElementById('necesidad-banner');
  banner.style.display = 'block';
  banner.innerHTML = 'Mostrando artículos para <strong>' + escapeHtml(nombre) + '</strong> · ' +
    '<button type="button" id="btn-quitar-necesidad">Ver todo el catálogo</button>';
  document.getElementById('btn-quitar-necesidad').addEventListener('click', quitarFiltroNecesidad);

  var cont = document.getElementById('catalogo-grid');
  cont.innerHTML = '<p class="catalogo-cargando">Cargando…</p>';
  try {
    var r = await fetch(NECESIDADES_API + '/api/public/necesidades/recomendaciones?necesidad=' + encodeURIComponent(slug));
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Error');
    var articulos = (d.articulos || []).map(function(x){ return x.catalogo_articulos; }).filter(Boolean);
    renderGridEn('catalogo-grid', articulos, 'Todavía no tenemos artículos destacados para esta necesidad. Escríbenos y te ayudamos a elegir.');
  } catch (e) {
    cont.innerHTML = '<p class="catalogo-vacio">No se han podido cargar los resultados. Prueba de nuevo o escríbenos a <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a>.</p>';
  }
}

function quitarFiltroNecesidad() {
  necesidadActiva = null;
  document.querySelectorAll('.nec-btn').forEach(function(b){ b.classList.remove('activo'); });
  document.getElementById('necesidad-banner').style.display = 'none';
  if (TODOS_LOS_ARTICULOS.length) renderCategorias(TODOS_LOS_ARTICULOS);
  pintarGrid();
}

cargarNecesidades();
