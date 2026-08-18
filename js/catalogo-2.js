
// js/catalogo-2.js — Específico de catalogo.html: filtro por categoría
// (tipo de producto) sobre el listado completo. El render del grid y los
// modales de detalle/presupuesto viven en catalogo-comun.js (compartido
// con coleccion.html).

var TODOS_LOS_ARTICULOS = [];
var categoriaActiva = '';
var subcategoriaActiva = '';
var leerOrdenActiva = null;

function obtenerCategoriasUnicas(articulos) {
  var cats = [];
  articulos.forEach(function(a){ if (a.categoria && cats.indexOf(a.categoria) === -1) cats.push(a.categoria); });
  return cats.sort();
}

function obtenerSubcategoriasDeCategoria(articulos, categoria) {
  var subs = [];
  articulos.forEach(function(a){
    if (a.categoria === categoria && a.subcategoria && subs.indexOf(a.subcategoria) === -1) {
      subs.push(a.subcategoria);
    }
  });
  return subs.sort();
}

function existenPacks(articulos) {
  return articulos.some(function(a){
    var cats = (a.etiquetas || []).map(function(e){ return String(e).toLowerCase(); });
    return (a.categoria && a.categoria.toLowerCase().includes('pack')) || cats.indexOf('pack') !== -1;
  });
}

function renderCategorias(articulos) {
  var cats = obtenerCategoriasUnicas(articulos);
  var cont = document.getElementById('categorias');
  if (!cats.length) { cont.style.display = 'none'; return; }

  // Si no hay categoría activa, mostrar lista de categorías
  if (!categoriaActiva) {
    var html = cats.map(function(c){
      return '<button type="button" class="cat-btn" data-cat="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>';
    }).join('');
    
    // Agregar sección de Packs si existen
    if (existenPacks(articulos)) {
      html += '<div class="pack-section">' +
        '<span class="pack-title">📦 Packs</span>' +
        '<button type="button" class="cat-btn" data-cat="__packs__">Ver packs</button>' +
        '</div>';
    }
    
    cont.innerHTML = html;
    cont.style.display = 'flex';
    cont.querySelectorAll('.cat-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        categoriaActiva = btn.dataset.cat || '';
        subcategoriaActiva = '';
        renderCategorias(articulos);
      });
    });
  } else {
    // Si es la categoría virtual de Packs
    if (categoriaActiva === '__packs__') {
      var html = '<button type="button" class="cat-btn" data-back="true">← Packs</button>' +
        '<button type="button" class="cat-btn' + (!subcategoriaActiva ? ' activo' : '') + '" data-subcat="">Ver todos</button>';
      
      cont.innerHTML = html;
      cont.style.display = 'flex';
      
      cont.querySelector('[data-back="true"]').addEventListener('click', function(){
        categoriaActiva = '';
        subcategoriaActiva = '';
        renderCategorias(articulos);
      });
      
      cont.querySelector('[data-subcat]').addEventListener('click', function(){
        subcategoriaActiva = '';
        pintarGrid();
      });
    } else {
      // Mostrar subcategorías de categoría normal
      var subs = obtenerSubcategoriasDeCategoria(articulos, categoriaActiva);
      
      var html = '<button type="button" class="cat-btn" data-back="true">← ' + escapeHtml(categoriaActiva) + '</button>';
      
      if (subs.length) {
        html += subs.map(function(s){
          return '<button type="button" class="cat-btn' + (subcategoriaActiva === s ? ' activo' : '') + '" data-subcat="' + escapeHtml(s) + '">' + escapeHtml(s) + '</button>';
        }).join('');
      } else {
        html += '<button type="button" class="cat-btn' + (!subcategoriaActiva ? ' activo' : '') + '" data-subcat="">Ver todos</button>';
      }
      
      cont.innerHTML = html;
      cont.style.display = 'flex';
      
      cont.querySelector('[data-back="true"]').addEventListener('click', function(){
        categoriaActiva = '';
        subcategoriaActiva = '';
        renderCategorias(articulos);
      });
      
      cont.querySelectorAll('[data-subcat]').forEach(function(btn){
        btn.addEventListener('click', function(){
          subcategoriaActiva = btn.dataset.subcat || '';
          renderCategorias(articulos);
          pintarGrid();
        });
      });
    }
  }
}

function pintarGrid() {
  var lista = TODOS_LOS_ARTICULOS;
  
  // Filtro especial para Packs
  if (categoriaActiva === '__packs__') {
    lista = lista.filter(function(a){
      var cats = (a.etiquetas || []).map(function(e){ return String(e).toLowerCase(); });
      return (a.categoria && a.categoria.toLowerCase().includes('pack')) || cats.indexOf('pack') !== -1;
    });
  } else if (categoriaActiva) {
    lista = lista.filter(function(a){ return a.categoria === categoriaActiva; });
  }
  
  if (subcategoriaActiva) {
    lista = lista.filter(function(a){ return a.subcategoria === subcategoriaActiva; });
  }
  
  var criterio = leerOrdenActiva ? leerOrdenActiva() : 'nombre';
  var msgVacio = categoriaActiva === '__packs__' ? 'No hay packs disponibles.' : 'No hay artículos disponibles ahora mismo en esta sección.';
  renderGridEn('catalogo-grid', ordenarArticulos(lista, criterio), msgVacio);
}

async function cargarCatalogo() {
  var cont = document.getElementById('catalogo-grid');
  try {
    var r = await fetch('/api/catalogo');
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Error al cargar el catálogo');
    TODOS_LOS_ARTICULOS = d.articulos || [];
    leerOrdenActiva = montarOrdenSelect('catalogo-grid', pintarGrid);
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
// Busca en TODOS_LOS_ARTICULOS, no en ARTICULOS_MOSTRADOS, para que funcione
// aunque el usuario tenga una categoría filtrada activa.
function abrirArticuloDesdeUrl() {
  var id = new URLSearchParams(location.search).get('articulo');
  if (!id) return;
  
  // Busca el artículo en el listado completo (no filtrado)
  var articulo = TODOS_LOS_ARTICULOS.find(function(a){ return a.id === id; });
  if (!articulo) return; // Artículo no existe
  
  // Si hay una categoría filtrada activa y el artículo no es de esa categoría,
  // cambia el filtro a la categoría del artículo
  if (categoriaActiva && articulo.categoria !== categoriaActiva) {
    categoriaActiva = articulo.categoria || '';
    subcategoriaActiva = articulo.subcategoria || '';
    renderCategorias(TODOS_LOS_ARTICULOS);
    pintarGrid();
  } else if (categoriaActiva && subcategoriaActiva && articulo.subcategoria !== subcategoriaActiva) {
    // Si la subcategoría activa no coincide, actualizar
    subcategoriaActiva = articulo.subcategoria || '';
    renderCategorias(TODOS_LOS_ARTICULOS);
    pintarGrid();
  }
  
  // Abre el modal
  abrirModalDetalle(id);
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
  categoriaActiva = '';
  subcategoriaActiva = '';
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
