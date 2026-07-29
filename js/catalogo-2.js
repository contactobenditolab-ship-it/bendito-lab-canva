
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
  } catch (e) {
    cont.innerHTML = '<p class="catalogo-vacio">No se ha podido cargar el catálogo. Prueba de nuevo o escríbenos a <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a>.</p>';
  }
}
cargarCatalogo();
