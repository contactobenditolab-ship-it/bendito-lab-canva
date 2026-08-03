
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

function abrirModalPresupuesto(articuloId, detallesPrefill) {
  articuloSeleccionado = ARTICULOS_MOSTRADOS.find(function(a){ return a.id === articuloId; }) || null;
  document.getElementById('mp-producto-nombre').textContent = articuloSeleccionado ? articuloSeleccionado.nombre : '';
  document.getElementById('presupuesto-form').style.display = 'flex';
  document.getElementById('presupuesto-success').style.display = 'none';
  document.getElementById('presupuesto-form').reset();
  if (detallesPrefill) {
    var mensajeEl = document.querySelector('#presupuesto-form [name="mensaje"]');
    if (mensajeEl) mensajeEl.value = detallesPrefill;
  }
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

// Guard contra doble envío: en móvil un doble-tap (o Enter del teclado +
// tap casi simultáneo) puede disparar dos eventos "submit" antes de que
// btn.disabled surta efecto visualmente. btn.disabled por sí solo no basta
// porque ambos handlers ya están en cola cuando eso pasa; este flag corta
// el segundo en seco nada más entrar.
var enviandoPresupuesto = false;

document.getElementById('presupuesto-form').addEventListener('submit', async function(e){
  e.preventDefault();
  if (enviandoPresupuesto) return;
  enviandoPresupuesto = true;

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
    enviandoPresupuesto = false;
  }
});

// ── Cuadrados de color (en vez del nombre en texto) ────────
// colores_resueltos viene ya calculado por /api/catalogo: cada color es
// { nombre, segmentos: [{hex, esEstampado}, ...] } — 2 segmentos para
// bicolores tipo "Celeste/Blanco" (se pintan partidos en diagonal), 1 para
// el resto. hex null (estampados o nombres sin match en la carta de
// colores) cae en el estilo .color-swatch--sin-match.
// Los cuadrados de color funcionan como el "desplegable" de color: son
// seleccionables (rol de radio) y la selección se guarda en
// COLOR_SELECCIONADO para prefijar el mensaje al pedir presupuesto.
var COLOR_SELECCIONADO = null;
var TALLA_SELECCIONADA = null;

function renderColoresSwatches(coloresResueltos) {
  if (!coloresResueltos || !coloresResueltos.length) return '';

  var swatches = coloresResueltos.map(function(c, i) {
    var segmentos = c.segmentos || [];
    var sinMatch = segmentos.some(function(s){ return !s.hex; });
    var estampado = segmentos.some(function(s){ return s.esEstampado; });

    var estiloExtra = '';
    if (!sinMatch) {
      if (segmentos.length === 2) {
        estiloExtra = 'background:linear-gradient(135deg,' + segmentos[0].hex + ' 0 50%,' + segmentos[1].hex + ' 50% 100%);';
      } else {
        estiloExtra = 'background:' + segmentos[0].hex + ';';
      }
    }

    var clase = 'color-swatch' + (sinMatch ? ' color-swatch--sin-match' : '') + (estampado ? ' color-swatch--estampado' : '');
    return '<span class="' + clase + '" style="' + estiloExtra + '" title="' + escapeHtml(c.nombre) + '"' +
      ' role="radio" aria-checked="false" tabindex="0" data-color-nombre="' + escapeHtml(c.nombre) + '"></span>';
  }).join('');

  return '<div class="md-colores"><span class="md-colores-label">Color</span><div class="md-colores-lista" id="md-colores-lista">' + swatches + '</div></div>';
}

function activarSelectorColores() {
  var lista = document.getElementById('md-colores-lista');
  if (!lista) return;
  lista.addEventListener('click', function(e){
    var swatch = e.target.closest('[data-color-nombre]');
    if (!swatch) return;
    var yaActivo = swatch.classList.contains('color-swatch--activo');
    Array.prototype.forEach.call(lista.querySelectorAll('.color-swatch'), function(s){
      s.classList.remove('color-swatch--activo');
      s.setAttribute('aria-checked', 'false');
    });
    if (yaActivo) {
      COLOR_SELECCIONADO = null;
    } else {
      swatch.classList.add('color-swatch--activo');
      swatch.setAttribute('aria-checked', 'true');
      COLOR_SELECCIONADO = swatch.dataset.colorNombre;
    }
  });
}

function renderTallaSelect(tallas) {
  if (!tallas || !tallas.length) return '';
  var options = '<option value="">Selecciona talla</option>' +
    tallas.map(function(t){ return '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>'; }).join('');
  return '<div class="md-talla"><label class="md-colores-label" for="md-talla-select">Talla</label>' +
    '<select id="md-talla-select">' + options + '</select></div>';
}

// ── Modal de detalle de producto ──────────────────────────
function abrirModalDetalle(articuloId) {
  var a = ARTICULOS_MOSTRADOS.find(function(x){ return x.id === articuloId; });
  if (!a) return;

  var img = a.imagen_principal_url
    ? '<img src="' + escapeHtml(a.imagen_principal_url) + '" alt="' + escapeHtml(a.nombre) + '">'
    : '<span>Sin imagen</span>';

  var atributos = [
    ['Material', a.material],
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

  var coloresHtml = renderColoresSwatches(a.colores_resueltos);
  var tallaHtml = renderTallaSelect(a.tallas);
  COLOR_SELECCIONADO = null;
  TALLA_SELECCIONADA = null;

  var desc = a.descripcion || a.descripcion_corta || '';

  document.getElementById('md-contenido').innerHTML =
    '<button class="btn-cerrar" id="btn-cerrar-detalle">✕</button>' +
    '<div class="md-img">' + img + '</div>' +
    '<div>' +
      (a.categoria ? '<p class="md-cat">' + escapeHtml(a.categoria) + (a.subcategoria ? ' · ' + escapeHtml(a.subcategoria) : '') + '</p>' : '') +
      '<h3>' + escapeHtml(a.nombre) + '</h3>' +
      (desc ? '<p class="md-desc">' + escapeHtml(desc) + '</p>' : '') +
      coloresHtml +
      tallaHtml +
      atributosHtml +
      '<div class="md-calc" id="md-calc"></div>' +
      '<button type="button" class="btn-presupuesto" id="btn-presupuesto-desde-detalle">Pedir presupuesto</button>' +
    '</div>';

  document.getElementById('btn-cerrar-detalle').addEventListener('click', cerrarModalDetalle);
  activarSelectorColores();
  var tallaSelect = document.getElementById('md-talla-select');
  if (tallaSelect) {
    tallaSelect.addEventListener('change', function(){ TALLA_SELECCIONADA = tallaSelect.value || null; });
  }
  document.getElementById('btn-presupuesto-desde-detalle').addEventListener('click', function(){
    cerrarModalDetalle();
    var detalles = [COLOR_SELECCIONADO ? 'Color: ' + COLOR_SELECCIONADO : null, TALLA_SELECCIONADA ? 'Talla: ' + TALLA_SELECCIONADA : null]
      .filter(Boolean).join(' · ');
    abrirModalPresupuesto(a.id, detalles);
  });

  renderCalculadora(a);

  document.getElementById('modal-detalle').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

// ── Calculadora de precio aproximado (producto + técnica + extras) ────────
var METAP_CACHE = null;
function cargarMetaPersonalizacion() {
  if (METAP_CACHE) return METAP_CACHE;
  METAP_CACHE = fetch('/api/catalogo?meta=personalizacion').then(function(r){ return r.json(); }).catch(function(){ return { tecnicas: [], extras: [] }; });
  return METAP_CACHE;
}

async function renderCalculadora(articulo) {
  var cont = document.getElementById('md-calc');
  if (!cont) return;
  cont.innerHTML = '<p class="md-calc-loading">Cargando calculadora…</p>';

  var meta = await cargarMetaPersonalizacion();
  var todasTecnicas = meta.tecnicas || [];
  var extrasDisponibles = meta.extras || [];

  var tecnicasArticulo = (articulo.tecnicas_personalizacion || []).map(function(t){ return String(t).toLowerCase(); });
  var tecnicasAplicables = tecnicasArticulo.length
    ? todasTecnicas.filter(function(t){ return tecnicasArticulo.indexOf(String(t).toLowerCase()) !== -1; })
    : todasTecnicas;
  if (!tecnicasAplicables.length) tecnicasAplicables = todasTecnicas;

  // El precio base del artículo (sin personalizar) siempre se puede calcular
  // con solo la cantidad — la técnica/extras son opcionales. Antes, si no
  // había fichas de coste de tipo "tecnica"/"extra" en el catálogo interno
  // (fichas_costes), aquí se vaciaba el contenedor entero y la calculadora
  // desaparecía sin más, aunque el precio base sí se pudiera calcular.
  var tecnicaHtml = tecnicasAplicables.length
    ? '<label>Técnica (opcional)<select id="calc-tecnica"><option value="">Sin personalizar</option>' +
        tecnicasAplicables.map(function(t){ return '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>'; }).join('') +
      '</select></label>'
    : '';
  var extrasHtml = extrasDisponibles.length
    ? '<div class="md-calc-extras">' + extrasDisponibles.map(function(ex, i){
        return '<label class="md-calc-extra"><input type="checkbox" data-extra-nombre="' + escapeHtml(ex.nombre) + '"> ' +
          escapeHtml(ex.nombre) + ' (+' + Number(ex.precio || 0).toFixed(2) + '€)</label>';
      }).join('') + '</div>'
    : '';

  cont.innerHTML =
    '<div class="md-calc-title">Calcula tu precio aproximado</div>' +
    '<div class="md-calc-row">' +
      '<label>Cantidad<input type="number" id="calc-cantidad" min="1" value="25"></label>' +
      tecnicaHtml +
    '</div>' +
    extrasHtml +
    '<button type="button" class="btn-calcular" id="btn-calcular">CALCULAR PRECIO→</button>' +
    '<div class="md-calc-resultado" id="calc-resultado" style="display:none;"></div>';

  document.getElementById('btn-calcular').addEventListener('click', function(){ ejecutarCalculo(articulo.id); });
  // Se calcula ya con la cantidad por defecto (25) al abrir el modal, para
  // que el cliente vea de entrada el precio y el descuento por cantidad sin
  // tener que pulsar nada.
  ejecutarCalculo(articulo.id);
}

async function ejecutarCalculo(articuloId) {
  var btn = document.getElementById('btn-calcular');
  var resEl = document.getElementById('calc-resultado');
  var cantidad = parseInt(document.getElementById('calc-cantidad').value, 10) || 1;
  var tecnicaEl = document.getElementById('calc-tecnica');
  var tecnica = tecnicaEl && tecnicaEl.value ? tecnicaEl.value : null;
  var extras = Array.prototype.slice.call(document.querySelectorAll('#md-calc [data-extra-nombre]:checked'))
    .map(function(el){ return el.dataset.extraNombre; });

  btn.disabled = true; btn.textContent = 'Calculando...';
  resEl.style.display = 'none';

  try {
    var r = await fetch('/api/catalogo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'calcularPrecio', articulo_id: articuloId, cantidad: cantidad, tecnica: tecnica, extras: extras })
    });
    var d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Error al calcular');

    var extrasLinea = d.extras && d.extras.length
      ? '<div class="md-calc-linea">Extras: +' + d.extras_total.toFixed(2) + '€</div>' : '';

    var descuentoLinea = '';
    var tablaLinea = '';
    if (d.tramos && d.tramos.tiene_tramos) {
      if (d.tramos.descuento_pct > 0) {
        descuentoLinea = '<div class="md-calc-descuento">Ahorras ' + d.tramos.descuento_pct + '% por comprar ' + d.cantidad + ' uds</div>';
      }
      tablaLinea =
        '<table class="md-calc-tramos"><thead><tr><th>Cantidad</th><th>Precio/ud</th></tr></thead><tbody>' +
        d.tramos.tabla.map(function(t){
          var activo = t.cantidad_min === d.tramos.cantidad_min_tramo_actual ? ' class="tramo-activo"' : '';
          return '<tr' + activo + '><td>' + (t.cantidad_min === 1 ? '1+' : t.cantidad_min + '+') + '</td><td>' + t.precio_unitario.toFixed(2) + '€</td></tr>';
        }).join('') +
        '</tbody></table>';
    }

    // El precio del producto en blanco (sin técnica elegida) es "desde": no
    // incluye personalización salvo que la ficha del artículo aclare cuál
    // lleva incluida y sus medidas (personalizacion_incluida/_medidas).
    var personalizacionLinea = '';
    if (!tecnica) {
      var art = ARTICULOS_MOSTRADOS.find(function(x){ return x.id === articuloId; });
      if (art && art.personalizacion_incluida) {
        personalizacionLinea = '<div class="md-calc-personalizacion">Incluye: ' + escapeHtml(art.personalizacion_incluida) +
          (art.personalizacion_medidas ? ' (' + escapeHtml(art.personalizacion_medidas) + ')' : '') + '</div>';
      } else {
        personalizacionLinea = '<div class="md-calc-personalizacion">Precio desde, no incluye personalización.</div>';
      }
    }

    resEl.innerHTML =
      '<div class="md-calc-total">Total aprox.: ' + d.total.toFixed(2) + '€ <span>(' + d.precio_unitario.toFixed(2) + '€/ud × ' + d.cantidad + ')</span></div>' +
      descuentoLinea +
      extrasLinea +
      tablaLinea +
      personalizacionLinea +
      '<div class="md-calc-aviso">' + escapeHtml(d.aviso) + '</div>';
    resEl.style.display = 'block';
  } catch (e) {
    resEl.innerHTML = '<div class="md-calc-error">' + escapeHtml(e.message) + '</div>';
    resEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'CALCULAR PRECIO→';
  }
}

function cerrarModalDetalle() {
  document.getElementById('modal-detalle').style.display = 'none';
  document.body.style.overflow = '';
}

document.getElementById('modal-detalle').addEventListener('click', function(e){
  if (e.target === this) cerrarModalDetalle();
});
