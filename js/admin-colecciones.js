
// js/admin-colecciones.js — Panel "Colecciones catálogo" de admin.html.
// Gestiona las sub-páginas de /catalogo por negocio/temporada/campaña
// (ver coleccion.html + js/coleccion-2.js), guardadas vía api/colecciones.js
// en el mismo Blob de contenido que usa el resto del sitio. Se carga al
// abrir el panel (ver el hook en show() de admin-1.js), no al iniciar la
// página, porque el listado de categorías/etiquetas requiere sesión.

var COLECCIONES_STATE = {};

function renderColecciones() {
  var cont = document.getElementById('colecciones-list');
  if (!cont) return;
  var slugs = Object.keys(COLECCIONES_STATE);

  if (!slugs.length) {
    cont.innerHTML = '<p style="font-size:12px;color:#888;padding:12px 0;">No hay colecciones todavía. Pulsa "+ Añadir colección" para crear la primera.</p>';
    return;
  }

  cont.innerHTML = slugs.map(function (slug) {
    var c = COLECCIONES_STATE[slug] || {};
    var heroPreview = c.heroImg
      ? '<img src="' + c.heroImg + '" style="width:100%;height:100%;object-fit:cover;">'
      : '<span style="font-size:10px;color:#aaa;text-align:center;padding:0 6px;">Sin imagen</span>';
    var uid = 'col-' + slug.replace(/[^a-z0-9]/gi, '-');
    return (
      '<div class="card" style="margin-bottom:12px;">' +
        '<div style="display:grid;grid-template-columns:110px 1fr;gap:14px;">' +
          '<div>' +
            '<div style="width:110px;height:110px;background:#F4F1E6;border:1px solid #E0DDD6;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:6px;">' + heroPreview + '</div>' +
            '<label class="img-btn" for="file-' + uid + '" style="display:block;text-align:center;font-size:11px;cursor:pointer;">📤 Cabecera</label>' +
            '<input type="file" id="file-' + uid + '" accept="image/*" data-action="subir-hero-coleccion" data-slug="' + slug + '" style="display:none">' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;">' +
            '<div><label style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;">Slug (URL: /coleccion/&lt;slug&gt;)</label>' +
              '<input type="text" value="' + slug + '" data-action="upd-coleccion-slug" data-slug="' + slug + '" style="padding:8px;border:1.5px solid #E0DDD6;font-size:13px;width:100%;font-family:monospace;box-sizing:border-box;"></div>' +
            '<div><label style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;">Título</label>' +
              '<input type="text" value="' + (c.titulo || '') + '" placeholder="Ej. Catálogo de Verano" data-action="upd-coleccion-titulo" data-slug="' + slug + '" style="padding:8px;border:1.5px solid #E0DDD6;font-size:13px;width:100%;box-sizing:border-box;"></div>' +
            '<div><label style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;">Subtítulo</label>' +
              '<textarea rows="2" placeholder="Texto breve bajo el título" data-action="upd-coleccion-subtitulo" data-slug="' + slug + '" style="padding:8px;border:1.5px solid #E0DDD6;font-size:13px;width:100%;resize:vertical;box-sizing:border-box;">' + (c.subtitulo || '') + '</textarea></div>' +
            '<div><label style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;">Etiqueta a filtrar</label>' +
              '<input type="text" value="' + (c.tag || '') + '" placeholder="Ej. verano" data-action="upd-coleccion-tag" data-slug="' + slug + '" style="padding:8px;border:1.5px solid #E0DDD6;font-size:13px;width:100%;font-family:monospace;box-sizing:border-box;"></div>' +
            '<button data-action="rm-coleccion" data-slug="' + slug + '" style="align-self:flex-end;background:#FFEBEE;color:#C0392B;border:1px solid #FFCDD2;padding:6px 12px;font-size:11px;cursor:pointer;">🗑 Eliminar</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function addColeccion() {
  var slug = 'coleccion-' + Date.now().toString(36);
  COLECCIONES_STATE[slug] = { titulo: '', subtitulo: '', heroImg: '', tag: '' };
  renderColecciones();
  markDirty();
}

function rmColeccion(slug) {
  if (!confirm('¿Eliminar la colección "' + slug + '"?\n\nEsto solo quita la sub-página — no borra ni desactiva ningún producto.')) return;
  delete COLECCIONES_STATE[slug];
  renderColecciones();
  markDirty();
}

function updColeccionCampo(slug, campo, valor) {
  if (!COLECCIONES_STATE[slug]) return;
  COLECCIONES_STATE[slug][campo] = valor;
  markDirty();
}

function updColeccionSlug(oldSlug, nuevoValor) {
  var nuevo = nuevoValor.trim().toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!nuevo || nuevo === oldSlug) { renderColecciones(); return; }
  if (COLECCIONES_STATE[nuevo]) {
    alert('Ya existe una colección con el slug "' + nuevo + '"');
    renderColecciones();
    return;
  }

  var reordenado = {};
  Object.keys(COLECCIONES_STATE).forEach(function (s) {
    reordenado[s === oldSlug ? nuevo : s] = COLECCIONES_STATE[s];
  });
  COLECCIONES_STATE = reordenado;
  renderColecciones();
  markDirty();
}

async function subirHeroColeccion(el, slug) {
  var file = el.files && el.files[0];
  if (!file || !COLECCIONES_STATE[slug]) return;
  try {
    var url = await subirImagenSlot('coleccion-hero/' + slug, file);
    COLECCIONES_STATE[slug].heroImg = url;
    renderColecciones();
    markDirty();
  } catch (e) {
    alert('Error subiendo la imagen: ' + e.message);
  } finally {
    el.value = '';
  }
}

async function guardarColecciones() {
  var status = document.getElementById('colecciones-status');
  if (status) { status.textContent = 'Guardando…'; status.style.color = '#888'; }
  try {
    var r = await fetch('/api/colecciones', {
      method: 'POST',
      headers: BL_API.authHeaders(),
      body: JSON.stringify({ colecciones: COLECCIONES_STATE }),
    });
    var d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Error al guardar');
    if (status) { status.textContent = '✓ Guardado — ya está en la web'; status.style.color = '#2e7d32'; }
    dirty = false;
    var dirtyEl = document.getElementById('dirty');
    if (dirtyEl) dirtyEl.classList.remove('on');
  } catch (e) {
    if (status) { status.textContent = 'Error: ' + e.message; status.style.color = '#C0392B'; }
  }
}

async function cargarColecciones() {
  try {
    var r = await fetch('/api/colecciones');
    var d = await r.json();
    COLECCIONES_STATE = d.colecciones || {};
    renderColecciones();
  } catch (e) {
    console.warn('No se pudieron cargar las colecciones:', e);
  }
}

async function cargarMetaCatalogo() {
  var contCat = document.getElementById('meta-categorias');
  var contTag = document.getElementById('meta-etiquetas');
  if (!contCat || !contTag) return;
  contCat.textContent = 'Cargando…';
  contTag.textContent = '';
  try {
    var r = await fetch('/api/catalogo-meta', { headers: BL_API.authHeaders() });
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Error al cargar');
    contCat.innerHTML = '<b>Categorías:</b> ' + (d.categorias.length ? d.categorias.join(', ') : '(ninguna)');
    contTag.innerHTML = '<b>Etiquetas:</b> ' + (d.etiquetas.length ? d.etiquetas.join(', ') : '(ninguna todavía — añade etiquetas desde la ficha de artículo en Bendito OS)');
  } catch (e) {
    contCat.textContent = 'No se pudo cargar: ' + e.message;
  }
}
