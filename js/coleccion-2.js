
// js/coleccion-2.js — Específico de coleccion.html: lee el slug de la
// colección de la URL (?c=slug), carga su configuración (título, imagen,
// etiqueta a filtrar) desde /api/colecciones —gestionada en admin.html,
// panel "Colecciones catálogo"— pinta la cabecera y filtra el catálogo por
// esa etiqueta. El render del grid y los modales viven en
// catalogo-comun.js (compartido con catalogo.html).

function slugActual() {
  return new URLSearchParams(window.location.search).get('c') || '';
}

async function cargarColeccion() {
  var slug = slugActual();
  var grid = document.getElementById('coleccion-grid');

  var coleccion;
  try {
    var rc = await fetch('/api/colecciones');
    var dc = await rc.json();
    coleccion = (dc.colecciones || {})[slug];
  } catch (e) {
    document.getElementById('coleccion-titulo').textContent = 'Error al cargar la colección';
    grid.innerHTML = '<p class="catalogo-vacio">No se ha podido cargar. Prueba de nuevo o escríbenos a <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a>.</p>';
    return;
  }

  if (!coleccion) {
    document.getElementById('coleccion-titulo').textContent = 'Colección no encontrada';
    document.getElementById('coleccion-subtitulo').textContent = '';
    grid.innerHTML = '<p class="catalogo-vacio">Esta colección no existe. Vuelve al <a href="catalogo.html">catálogo completo</a>.</p>';
    return;
  }

  document.title = coleccion.titulo + ' · Bendito Lab';
  document.getElementById('page-title').textContent = coleccion.titulo + ' · Bendito Lab';
  document.getElementById('coleccion-titulo').textContent = coleccion.titulo;
  document.getElementById('coleccion-subtitulo').textContent = coleccion.subtitulo || '';
  if (coleccion.heroImg) {
    var img = document.createElement('img');
    img.src = coleccion.heroImg;
    img.alt = coleccion.titulo;
    document.getElementById('coleccion-hero').prepend(img);
  }

  try {
    var r = await fetch('/api/catalogo');
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Error al cargar el catálogo');
    var tag = (coleccion.tag || '').toLowerCase();
    var filtrados = (d.articulos || []).filter(function(a){
      return (a.etiquetas || []).some(function(et){ return String(et).toLowerCase() === tag; });
    });
    renderGridEn('coleccion-grid', filtrados, 'Todavía no hay artículos en esta colección.');
  } catch (e) {
    grid.innerHTML = '<p class="catalogo-vacio">No se ha podido cargar el catálogo. Prueba de nuevo o escríbenos a <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a>.</p>';
  }
}
cargarColeccion();
