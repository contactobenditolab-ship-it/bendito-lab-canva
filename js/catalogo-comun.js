
// js/catalogo-comun.js — Lógica compartida entre catalogo.html (por tipo de
// producto) y coleccion.html (por negocio/temporada/campaña, filtrado por
// etiqueta): render del grid de productos, modal de detalle y modal de
// presupuesto. Cada página solo aporta su propia forma de obtener/filtrar
// la lista de artículos a mostrar (ver catalogo-2.js / coleccion-2.js).

function toggleNav(){ document.body.classList.toggle('nav-open'); }
document.querySelectorAll('.site-nav a').forEach(function(a){
  a.addEventListener('click', function(){ document.body.classList.remove('nav-open'); });
});
var navHamburger = document.querySelector('.nav-hamburger');
if (navHamburger) navHamburger.addEventListener('click', toggleNav);

/** "Camiseta Esencial Roly" -> "camiseta-esencial-roly" (misma lógica que lib/articulo-publico.js) */
function slugificarCliente(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function urlProducto(articulo) {
  var slug = slugificarCliente(articulo.nombre) || 'producto';
  return '/producto/' + slug + '-' + articulo.id;
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Estilos añadidos por JS (compartidos entre catalogo.html y coleccion.html)
// para no duplicarlos en cada página: tooltip de nombre de color al pasar el
// cursor, botón de guía de tallas y su modal.
(function injectCatalogoComunStyles(){
  var s = document.createElement('style');
  s.textContent =
    '.swatch-btn{position:relative;}' +
    '.swatch-btn::after{content:attr(data-color-nombre);position:absolute;bottom:calc(100% + 7px);left:50%;' +
    'transform:translateX(-50%);background:#17233F;color:#FBF4E9;font-size:11px;font-weight:600;' +
    'padding:4px 8px;border-radius:6px;white-space:nowrap;opacity:0;pointer-events:none;' +
    'transition:opacity .12s;z-index:10;}' +
    '.swatch-btn::before{content:"";position:absolute;bottom:calc(100% + 3px);left:50%;transform:translateX(-50%);' +
    'border:4px solid transparent;border-top-color:#17233F;opacity:0;pointer-events:none;transition:opacity .12s;z-index:10;}' +
    '.swatch-btn:hover::after,.swatch-btn:hover::before{opacity:1;}' +
    '.btn-guia-tallas{display:inline-block;background:none;border:1px solid var(--baby,#8FA3C2);' +
    'color:var(--baby,#8FA3C2);font-size:12px;font-weight:700;letter-spacing:.3px;padding:8px 14px;' +
    'border-radius:20px;cursor:pointer;margin:0 0 18px;}' +
    '.btn-guia-tallas:hover{background:var(--baby,#8FA3C2);color:#fff;}' +
    '#modal-tallas{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100001;' +
    'align-items:center;justify-content:center;padding:24px 16px;}' +
    '#modal-tallas.on{display:flex;}' +
    '.mt-caja{background:#FBF4E9;border-radius:12px;max-width:480px;width:100%;max-height:85vh;' +
    'overflow-y:auto;padding:28px;position:relative;}' +
    '.mt-caja h3{margin:0 0 14px;color:#17233F;}' +
    '.mt-caja img{width:100%;height:auto;border-radius:8px;display:block;margin-top:10px;}' +
    '.mt-caja .btn-cerrar{position:absolute;top:10px;right:10px;background:none;border:none;' +
    'font-size:20px;cursor:pointer;color:#17233F;line-height:1;padding:6px;}' +
    '.mt-tabla-scroll{overflow-x:auto;margin-top:4px;}' +
    '.mt-tabla{width:100%;border-collapse:collapse;font-size:13px;}' +
    '.mt-tabla th,.mt-tabla td{padding:9px 12px;text-align:center;white-space:nowrap;}' +
    '.mt-tabla th{background:#17233F;color:#FBF4E9;font-weight:700;text-transform:uppercase;' +
    'font-size:11px;letter-spacing:.3px;}' +
    '.mt-tabla th:first-child,.mt-tabla td:first-child{text-align:left;font-weight:700;}' +
    '.mt-tabla tbody tr:nth-child(even){background:rgba(143,163,194,.12);}' +
    '.mt-tabla tbody tr:hover{background:rgba(143,163,194,.25);}' +
    '.mt-tabla td{border-bottom:1px solid rgba(23,35,63,.08);}';
  document.head.appendChild(s);
})();

var MODAL_TALLAS_HTML =
  '<div id="modal-tallas"><div class="mt-caja">' +
    '<button type="button" class="btn-cerrar" id="btn-cerrar-tallas">✕</button>' +
    '<div id="mt-contenido"></div>' +
  '</div></div>';
document.body.insertAdjacentHTML('beforeend', MODAL_TALLAS_HTML);
document.getElementById('btn-cerrar-tallas').addEventListener('click', cerrarModalTallas);
document.getElementById('modal-tallas').addEventListener('click', function(e){ if (e.target === this) cerrarModalTallas(); });

// Muchos proveedores mandan la guía de tallas como texto plano tabular,
// p.ej. "TALLA ANCHO (CM) ALTO (CM)\nXS 46 66\nS 49 69\n...": una fila por
// línea, columnas separadas por espacios. La cabecera suele tener más
// tokens que las filas de datos porque sus nombres de columna llevan
// espacios ("ANCHO (CM)"), así que el número de columnas real se calcula
// por la moda de tokens entre todas las líneas, y el resto de líneas con
// más tokens de los que tocan se reparten a partes iguales en las últimas
// columnas. Si el texto no tiene pinta de tabla (menos de 2 líneas, o los
// tokens no convergen en un recuento común), se devuelve null y se
// muestra como texto plano.
function parseTablaTallas(texto) {
  if (!texto) return null;
  var lineas = String(texto).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
  if (lineas.length < 2) return null;

  var filas = lineas.map(function (l) { return l.split(/\s+/).filter(Boolean); });

  var conteo = {};
  filas.forEach(function (f) { conteo[f.length] = (conteo[f.length] || 0) + 1; });
  var dataCols = Object.keys(conteo).reduce(function (mejor, k) {
    return conteo[k] > (conteo[mejor] || 0) ? k : mejor;
  }, Object.keys(conteo)[0]);
  dataCols = parseInt(dataCols, 10);
  if (!dataCols || dataCols < 2) return null;

  function normalizarFila(tokens) {
    if (tokens.length === dataCols) return tokens;
    if (tokens.length < dataCols) return null;
    var resto = tokens.slice(1);
    var grupos = dataCols - 1;
    var base = Math.floor(resto.length / grupos);
    var extra = resto.length % grupos;
    var salida = [tokens[0]];
    var idx = 0;
    for (var g = 0; g < grupos; g++) {
      var tam = base + (g < extra ? 1 : 0);
      salida.push(resto.slice(idx, idx + tam).join(' '));
      idx += tam;
    }
    return salida;
  }

  var normalizadas = filas.map(normalizarFila).filter(Boolean);
  if (normalizadas.length < 2) return null;

  return { cabecera: normalizadas[0], filas: normalizadas.slice(1) };
}

function renderTablaTallas(tabla) {
  return (
    '<div class="mt-tabla-scroll"><table class="mt-tabla"><thead><tr>' +
    tabla.cabecera.map(function (c) { return '<th>' + escapeHtml(c) + '</th>'; }).join('') +
    '</tr></thead><tbody>' +
    tabla.filas.map(function (f) {
      return '<tr>' + f.map(function (c) { return '<td>' + escapeHtml(c) + '</td>'; }).join('') + '</tr>';
    }).join('') +
    '</tbody></table></div>'
  );
}

function abrirModalTallas(nombreProducto, guiaTallas) {
  var esImagen = /^https?:\/\/.+\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(guiaTallas || '');
  var tabla = !esImagen ? parseTablaTallas(guiaTallas) : null;
  var cuerpo = esImagen
    ? '<img src="' + escapeHtml(guiaTallas) + '" alt="Guía de tallas">'
    : tabla
      ? renderTablaTallas(tabla)
      : '<p>' + escapeHtml(guiaTallas).replace(/\n/g, '<br>') + '</p>';
  document.getElementById('mt-contenido').innerHTML =
    '<h3>Guía de tallas' + (nombreProducto ? ' · ' + escapeHtml(nombreProducto) : '') + '</h3>' + cuerpo;
  document.getElementById('modal-tallas').classList.add('on');
  document.body.style.overflow = 'hidden';
}

function cerrarModalTallas() {
  document.getElementById('modal-tallas').classList.remove('on');
  // No tocar overflow si el modal de detalle sigue abierto debajo.
  var detalle = document.getElementById('modal-detalle');
  if (!detalle || detalle.style.display !== 'block') document.body.style.overflow = '';
}

// Artículos actualmente pintados en el grid — el modal de detalle/presupuesto
// busca ahí por id cuando se hace clic en una tarjeta.
var ARTICULOS_MOSTRADOS = [];

// Círculos de color en miniatura para la tarjeta del grid (no
// interactivos, a diferencia de renderColoresSwatches en la ficha de
// producto) — como mucho 3 + un contador "+N" del resto.
function renderSwatchesTarjeta(coloresResueltos) {
  if (!coloresResueltos || !coloresResueltos.length) return '';
  var visibles = coloresResueltos.slice(0, 3);
  var swatches = visibles.map(function(c){
    var segmentos = c.segmentos || [];
    var sinMatch = segmentos.some(function(s){ return !s.hex; });
    if (sinMatch) return '<span class="swatch" style="background:repeating-linear-gradient(45deg,#e0ddd6,#e0ddd6 2px,#f2f0ea 2px,#f2f0ea 4px);" title="' + escapeHtml(c.nombre) + '"></span>';
    var fondo = segmentos.length === 2
      ? 'linear-gradient(135deg,' + segmentos[0].hex + ' 0 50%,' + segmentos[1].hex + ' 50% 100%)'
      : segmentos[0].hex;
    return '<span class="swatch" style="background:' + fondo + ';" title="' + escapeHtml(c.nombre) + '"></span>';
  }).join('');
  var resto = coloresResueltos.length - visibles.length;
  return '<div class="card-swatches">' + swatches + (resto > 0 ? '<span class="swatch-more">+' + resto + '</span>' : '') + '</div>';
}

function renderGridEn(containerId, lista, mensajeVacio) {
  ARTICULOS_MOSTRADOS = lista;
  var cont = document.getElementById(containerId);

  if (!lista.length) {
    cont.innerHTML = '<p class="catalogo-vacio">' + escapeHtml(mensajeVacio || 'No hay artículos disponibles ahora mismo.') + '</p>';
    return;
  }

  cont.innerHTML = lista.map(function(a){
    var img = a.imagen_principal_url
      ? '<img src="' + escapeHtml(a.imagen_principal_url) + '" alt="' + escapeHtml(a.nombre) + '" loading="lazy" ' +
        'onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement(\'span\'),{textContent:\'Sin imagen\'}));">'
      : '<span>Sin imagen</span>';
    var href = urlProducto(a);
    var precio = (a.precio_desde != null) ? '<div class="card-precio">Desde <b>' + a.precio_desde.toFixed(2) + '€</b></div>' : '';
    return (
      '<a class="card" href="' + escapeHtml(href) + '">' +
        '<div class="card-img">' + img + '</div>' +
        '<div class="card-body">' +
          renderSwatchesTarjeta(a.colores_resueltos) +
          '<div class="card-nombre">' + escapeHtml(a.nombre) + '</div>' +
          precio +
        '</div>' +
      '</a>'
    );
  }).join('');
}

// ── Ordenación del listado (nombre A-Z, precio asc/desc) ──────────────────
function ordenarArticulos(lista, criterio) {
  var copia = lista.slice();
  switch (criterio) {
    case 'precio-asc':
      copia.sort(function(a, b){ return (a.precio_desde == null ? Infinity : a.precio_desde) - (b.precio_desde == null ? Infinity : b.precio_desde); });
      break;
    case 'precio-desc':
      copia.sort(function(a, b){ return (b.precio_desde == null ? -Infinity : b.precio_desde) - (a.precio_desde == null ? -Infinity : a.precio_desde); });
      break;
    case 'nombre':
    default:
      copia.sort(function(a, b){ return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'); });
      break;
  }
  return copia;
}

var ORDEN_SELECT_HTML =
  '<div class="orden-catalogo">' +
    '<label for="orden-select">Ordenar por</label>' +
    '<select id="orden-select">' +
      '<option value="nombre">Nombre (A-Z)</option>' +
      '<option value="precio-asc">Precio: más barato primero</option>' +
      '<option value="precio-desc">Precio: más caro primero</option>' +
    '</select>' +
  '</div>';

// Inserta el desplegable de ordenación justo antes del grid indicado y
// devuelve una función para leer el criterio activo. onCambio se llama con
// el nuevo criterio cada vez que el usuario cambia la selección.
function montarOrdenSelect(containerId, onCambio) {
  var grid = document.getElementById(containerId);
  if (!grid || document.getElementById('orden-select')) return function(){ return 'nombre'; };
  grid.insertAdjacentHTML('beforebegin', ORDEN_SELECT_HTML);
  var select = document.getElementById('orden-select');
  select.addEventListener('change', function(){ onCambio(select.value); });
  return function(){ return select.value; };
}

// ── Modal de presupuesto ──────────────────────────────────
var articuloSeleccionado = null;

// Rellena un <select> del modal de presupuesto con las opciones dadas
// (p.ej. áreas de marcaje o técnicas del artículo) y lo oculta si no hay
// ninguna — no tiene sentido mostrar un desplegable vacío.
function poblarSelectPresupuesto(selectId, opciones, valorPreseleccionado) {
  var select = document.getElementById(selectId);
  if (!select) return;
  var placeholder = select.options[0];
  select.innerHTML = '';
  select.appendChild(placeholder);
  (opciones || []).forEach(function(op){
    var option = document.createElement('option');
    option.value = op;
    option.textContent = op;
    select.appendChild(option);
  });
  select.style.display = opciones && opciones.length ? '' : 'none';

  // Comparación insensible a mayúsculas/espacios: la técnica preseleccionada
  // viene del desplegable de la calculadora (nombres de fichas_costes),
  // mientras que las opciones de este select vienen de
  // articulo.tecnicas_personalizacion — son dos campos mantenidos por
  // separado, así que un desajuste de mayúsculas/espacios entre ambos no
  // debe dejar la preselección en blanco silenciosamente.
  var normalizar = function(v){ return String(v || '').trim().toLowerCase(); };
  var coincidencia = valorPreseleccionado && opciones
    ? opciones.find(function(op){ return normalizar(op) === normalizar(valorPreseleccionado); })
    : null;
  select.value = coincidencia || '';
}

function abrirModalPresupuesto(articuloId, prefill) {
  articuloSeleccionado = ARTICULOS_MOSTRADOS.find(function(a){ return a.id === articuloId; }) || null;
  document.getElementById('mp-producto-nombre').textContent = articuloSeleccionado ? articuloSeleccionado.nombre : '';
  document.getElementById('presupuesto-form').style.display = 'flex';
  document.getElementById('presupuesto-success').style.display = 'none';
  document.getElementById('presupuesto-form').reset();

  var form = document.getElementById('presupuesto-form');
  prefill = prefill || {};

  var cantidadEl = document.getElementById('calc-cantidad');
  if (cantidadEl && cantidadEl.value) form.elements.namedItem('cantidad').value = cantidadEl.value;
  if (prefill.color) form.elements.namedItem('color').value = prefill.color;

  // "Personalización para eventos" no tiene cantidad ni técnica que elegir
  // en el sentido habitual — el número de invitados (y el pack que haya
  // salido en la calculadora) se prefija en "Otros datos" en su lugar.
  var invitadosEl = document.getElementById('calc-invitados');
  if (invitadosEl && invitadosEl.value) {
    var resultadoEventoEl = document.getElementById('calc-resultado');
    var totalEventoEl = resultadoEventoEl ? resultadoEventoEl.querySelector('.md-calc-total') : null;
    var packTexto = (resultadoEventoEl && resultadoEventoEl.style.display !== 'none' && totalEventoEl) ? totalEventoEl.textContent : null;
    form.elements.namedItem('otros_datos').value = 'Invitados: ' + invitadosEl.value + (packTexto ? ' · ' + packTexto : '');
  }

  poblarSelectPresupuesto('mp-zona-marcaje', articuloSeleccionado ? articuloSeleccionado.areas_marcaje : null);

  var tecnicaEl = document.getElementById('calc-tecnica');
  poblarSelectPresupuesto(
    'mp-tecnica',
    articuloSeleccionado ? articuloSeleccionado.tecnicas_personalizacion : null,
    tecnicaEl ? tecnicaEl.value : null
  );

  var otrosDatosEl = form.elements.namedItem('otros_datos');
  if (otrosDatosEl && prefill.talla) otrosDatosEl.value = 'Talla: ' + prefill.talla;

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

// Lee un <input type="file"> como data: URL (base64) para subirlo vía
// /api/contact (type "upload-logo") — igual que resizeImageToDataUrl en
// admin.html, pero sin redimensionar: el logo es solo referencia para el
// mockup, no una imagen del catálogo. Reutiliza /api/contact en vez de su
// propio endpoint porque el plan Hobby de Vercel tope a 12 Serverless
// Functions por deployment y ya estaba al límite.
function leerArchivoComoDataUrl(file) {
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(){ resolve(reader.result); };
    reader.onerror = function(){ reject(new Error('No se pudo leer el archivo')); };
    reader.readAsDataURL(file);
  });
}

async function subirLogoPresupuesto(file) {
  var dataUrl = await leerArchivoComoDataUrl(file);
  var r = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'upload-logo', dataUrl: dataUrl }),
  });
  var d = await r.json();
  if (!d.ok) throw new Error(d.error || 'No se pudo subir el logo');
  return d.url;
}

// Rellena la pantalla "presupuesto-success" con los datos reales que
// devuelve /api/contact (numero de presupuesto + estimación con el motor
// real de precios, ver /api/public/cotizacion en bendito-os). El número y
// la estimación son opcionales: si no llegan (fallo puntual del cálculo,
// artículo sin motor de precios...) esas filas simplemente no se muestran,
// la confirmación de "solicitud recibida" nunca depende de ellos.
// Estimación para la pantalla de "Todo listo": la MISMA cuenta que el botón
// "Calcular precio" (producto + técnica, vía /api/catalogo calcularPrecio),
// así cuadra con el "Total aprox." que el cliente acaba de ver. Antes la
// ponía Bendito OS solo con el precio del producto, sin la técnica.
// Devuelve null (y la fila se oculta) si no se puede calcular con
// seguridad: evento, sin cantidad, por debajo del MOQ o una técnica del
// formulario que no existe en las fichas de coste — mejor no enseñar
// precio que enseñar uno más bajo del real.
async function estimacionPresupuesto(articulo, cantidad, tecnicaFormulario) {
  if (!articulo || !cantidad || esArticuloEventos(articulo)) return null;
  var tecnica = null;
  if (tecnicaFormulario) {
    var meta = await cargarMetaPersonalizacion();
    var normalizar = function(v){ return String(v || '').trim().toLowerCase(); };
    tecnica = (meta.tecnicas || []).find(function(t){ return normalizar(t) === normalizar(tecnicaFormulario); }) || null;
    if (!tecnica) return null;
  }
  var r = await fetch('/api/catalogo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'calcularPrecio', articulo_id: articulo.id, cantidad: cantidad, tecnica: tecnica, extras: [] })
  });
  var d = await r.json();
  return d && d.ok && typeof d.total === 'number' ? d.total : null;
}

function mostrarConfirmacionPresupuesto(resultado) {
  var el = document.getElementById('presupuesto-success');
  // Si alguna página no tiene las filas de referencia/estimación, se muestra
  // el mensaje de éxito sin ellas en vez de romper con un TypeError (que se
  // tragaba el catch del envío y dejaba el modal en blanco).
  if (!el.querySelector('#ps-numero') || !el.querySelector('#ps-estimacion')) {
    el.style.display = 'block';
    return;
  }

  var numeroEl = el.querySelector('#ps-numero');
  var filaNumero = el.querySelector('#ps-fila-numero');
  if (resultado.numero) {
    numeroEl.textContent = resultado.numero;
    filaNumero.style.display = 'flex';
  } else {
    filaNumero.style.display = 'none';
  }

  var estimacionEl = el.querySelector('#ps-estimacion');
  var filaEstimacion = el.querySelector('#ps-fila-estimacion');
  if (typeof resultado.estimacion === 'number') {
    estimacionEl.textContent = '€' + resultado.estimacion.toFixed(2);
    filaEstimacion.style.display = 'flex';
  } else {
    filaEstimacion.style.display = 'none';
  }

  el.style.display = 'block';
}

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

  try {
    var logoUrl = null;
    var logoFile = form.elements.namedItem('logo').files[0];
    if (logoFile) {
      btn.textContent = 'Subiendo logo...';
      logoUrl = await subirLogoPresupuesto(logoFile);
      btn.textContent = 'Enviando...';
    }

    var nombreProducto = articuloSeleccionado ? articuloSeleccionado.nombre : 'artículo del catálogo';
    var detalles = [
      'Artículo: ' + nombreProducto,
      f.get('cantidad') ? 'Cantidad: ' + f.get('cantidad') : null,
      f.get('color') ? 'Color: ' + f.get('color') : null,
      f.get('zona_marcaje') ? 'Zona de marcaje: ' + f.get('zona_marcaje') : null,
      f.get('tecnica') ? 'Técnica: ' + f.get('tecnica') : null,
      f.get('otros_datos') ? 'Otros datos: ' + f.get('otros_datos') : null,
      logoUrl ? 'Logo: ' + logoUrl : null,
    ].filter(Boolean).join(' · ');

    var esEventos = articuloSeleccionado && esArticuloEventos(articuloSeleccionado);
    var r = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'cotizacion',
        data: {
          nombre: f.get('nombre'), email: f.get('email'), telefono: f.get('telefono'),
          servicio: esEventos ? 'Dilo Bonito' : 'Bendito Lab', mensaje: detalles,
          articulo_id: articuloSeleccionado ? articuloSeleccionado.id : undefined,
          cantidad: f.get('cantidad') || undefined,
          newsletter: f.get('newsletter') === 'on',
        }
      })
    });
    var d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Error al enviar');
    var estimacion = null;
    try {
      estimacion = await estimacionPresupuesto(
        articuloSeleccionado,
        parseInt(f.get('cantidad'), 10) || 0,
        f.get('tecnica') || null
      );
    } catch (errEstimacion) {
      // La solicitud ya está enviada: sin estimación, la fila se oculta.
    }
    form.style.display = 'none';
    mostrarConfirmacionPresupuesto({ numero: d.numero, estimacion: estimacion });
  } catch (err) {
    errEl.textContent = err.message + ' — o escríbenos directamente a contacto@benditolab.com';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'ENVIAR SOLICITUD→';
    enviandoPresupuesto = false;
  }
});

// ── Círculos de color (en vez del nombre en texto) ────────
// colores_resueltos viene ya calculado por /api/catalogo: cada color es
// { nombre, segmentos: [{hex, esEstampado}, ...] } — 2 segmentos para
// bicolores tipo "Celeste/Blanco" (se pintan partidos en diagonal), 1 para
// el resto. hex null (estampados o nombres sin match en la carta de
// colores) cae en el estilo .swatch-btn--sin-match.
// Los círculos de color funcionan como el "desplegable" de color: son
// seleccionables (rol de radio) y la selección se guarda en
// COLOR_SELECCIONADO para prefijar el mensaje al pedir presupuesto.
var COLOR_SELECCIONADO = null;
var TALLA_SELECCIONADA = null;

function renderColoresSwatches(coloresResueltos) {
  if (!coloresResueltos || !coloresResueltos.length) return '';

  var swatches = coloresResueltos.map(function(c) {
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

    var clase = 'swatch-btn' + (sinMatch ? ' swatch-btn--sin-match' : '') + (estampado ? ' swatch-btn--estampado' : '');
    return '<button type="button" class="' + clase + '" style="' + estiloExtra + '" title="' + escapeHtml(c.nombre) + '"' +
      ' role="radio" aria-checked="false" aria-label="' + escapeHtml(c.nombre) + '" data-color-nombre="' + escapeHtml(c.nombre) + '"></button>';
  }).join('');

  return '<div>' +
    '<div class="prod-field-label">Color</div>' +
    '<div class="swatch-row" id="md-colores-lista">' + swatches + '</div>' +
    '<p class="color-actual" id="color-actual" style="display:none;">Color: <b></b></p>' +
  '</div>';
}

function activarSelectorColores(articulo) {
  var lista = document.getElementById('md-colores-lista');
  if (!lista) return;
  var imgEl = document.getElementById('img-principal');
  var imgPorDefecto = imgEl ? imgEl.src : null;
  var imagenesPorColor = (articulo && articulo.imagenes_por_color) || {};
  var actual = document.getElementById('color-actual');

  lista.addEventListener('click', function(e){
    var swatch = e.target.closest('[data-color-nombre]');
    if (!swatch) return;
    var yaActivo = swatch.classList.contains('swatch-btn--activo');
    Array.prototype.forEach.call(lista.querySelectorAll('.swatch-btn'), function(s){
      s.classList.remove('swatch-btn--activo');
      s.setAttribute('aria-checked', 'false');
    });
    if (yaActivo) {
      COLOR_SELECCIONADO = null;
      if (imgEl && imgPorDefecto) imgEl.src = imgPorDefecto;
      if (actual) actual.style.display = 'none';
    } else {
      swatch.classList.add('swatch-btn--activo');
      swatch.setAttribute('aria-checked', 'true');
      COLOR_SELECCIONADO = swatch.dataset.colorNombre;
      if (imgEl && imagenesPorColor[COLOR_SELECCIONADO]) imgEl.src = imagenesPorColor[COLOR_SELECCIONADO];
      if (actual) { actual.querySelector('b').textContent = COLOR_SELECCIONADO; actual.style.display = 'block'; }
    }
  });
}

function renderTallaSelect(tallas) {
  if (!tallas || !tallas.length) return '';
  var options = '<option value="">Selecciona talla</option>' +
    tallas.map(function(t){ return '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>'; }).join('');
  return '<div class="md-talla"><label class="prod-field-label" for="md-talla-select">Talla</label>' +
    '<select id="md-talla-select">' + options + '</select></div>';
}

// ── Modal de detalle de producto ──────────────────────────
function actualizarUrlArticulo(articuloId) {
  var params = new URLSearchParams(location.search);
  if (params.get('articulo') === articuloId) return;
  if (articuloId) params.set('articulo', articuloId); else params.delete('articulo');
  var qs = params.toString();
  var url = location.pathname + (qs ? '?' + qs : '') + location.hash;
  history.pushState({ articulo: articuloId || null }, '', url);
}

// Construye la ficha de un artículo dentro de #md-contenido y engancha su
// interactividad (colores, talla, guía de tallas, calculadora, presupuesto).
// La usan tanto el modal de detalle del catálogo (abrirModalDetalle) como
// la página de producto independiente (catalogo-producto.js), que rellena
// #md-contenido directamente en la página en vez de dentro de un modal.
function renderFichaProducto(a) {
  var img = a.imagen_principal_url
    ? '<img id="img-principal" src="' + escapeHtml(a.imagen_principal_url) + '" alt="' + escapeHtml(a.nombre) + '" ' +
      'onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement(\'span\'),{textContent:\'Sin imagen\'}));">'
    : '<span>Sin imagen</span>';

  var atributosDetalle = [
    ['Material', a.material],
    ['Capacidad', a.capacidad],
    ['Formato', a.formato],
    ['Acabados', a.acabados],
  ].filter(function(par){ return !!par[1]; });

  var detallesHtml = atributosDetalle.map(function(par){
    return '<div><div class="prod-field-label">' + escapeHtml(par[0]) + '</div>' +
      '<p style="margin:0;font-size:14px;color:var(--deep);opacity:.8;">' + escapeHtml(par[1]) + '</p></div>';
  }).join('');

  var tecnicasChips = (a.tecnicas_personalizacion || []).map(function(t){ return '<span class="chip tecnica">' + escapeHtml(t) + '</span>'; }).join('');
  var zonasChips = (a.areas_marcaje || []).map(function(z){ return '<span class="chip">' + escapeHtml(z) + '</span>'; }).join('');
  // Tamaño máximo que admite este artículo para personalizar — para que el
  // cliente no pida un diseño más grande de lo que cabe. Prioriza el par
  // ancho/alto (cm) si está, si no cae al texto libre (p.ej. "10x15 cm").
  var medidaMaxima = (a.personalizacion_ancho_max_cm && a.personalizacion_alto_max_cm)
    ? a.personalizacion_ancho_max_cm + ' × ' + a.personalizacion_alto_max_cm + ' cm'
    : (a.superficie_max_personalizacion || null);
  var medidaMaximaHtml = medidaMaxima
    ? '<div><div class="prod-field-label">Medida máxima de personalización</div>' +
      '<p style="margin:0;font-size:14px;color:var(--deep);opacity:.8;">' + escapeHtml(medidaMaxima) + '</p></div>'
    : '';
  var personalizacionHtml =
    (tecnicasChips ? '<div><div class="prod-field-label">Técnicas disponibles</div><div class="chip-list">' + tecnicasChips + '</div></div>' : '') +
    (zonasChips ? '<div><div class="prod-field-label">Zona de marcaje</div><div class="chip-list">' + zonasChips + '</div></div>' : '') +
    medidaMaximaHtml;

  var hayPersonalizacion = !!(tecnicasChips || zonasChips || medidaMaxima);
  var hayDetalles = !!atributosDetalle.length;
  // Personalización empieza activa (más relevante para elegir técnica que
  // las medidas/material) — Detalles se muestra si se pulsa su pestaña.
  var tabsHtml = (hayDetalles || hayPersonalizacion)
    ? '<div class="prod-tabs" role="tablist">' +
        (hayDetalles ? '<button type="button" class="prod-tab" data-tab="detalles" aria-selected="false">Detalles</button>' : '') +
        (hayPersonalizacion ? '<button type="button" class="prod-tab" data-tab="personalizacion" aria-selected="true">Personalización</button>' : '') +
      '</div>' +
      (hayDetalles ? '<div class="prod-panel" data-panel="detalles" hidden>' + detallesHtml + '</div>' : '') +
      (hayPersonalizacion ? '<div class="prod-panel" data-panel="personalizacion">' + personalizacionHtml + '</div>' : '')
    : '';

  var coloresHtml = renderColoresSwatches(a.colores_resueltos);
  var tallaHtml = renderTallaSelect(a.tallas);
  var guiaTallasHtml = a.guia_tallas
    ? '<button type="button" class="btn-guia-tallas" id="btn-guia-tallas">📏 Guía de tallas</button>' : '';
  var disponibilidadHtml = (coloresHtml || tallaHtml)
    ? '<p style="margin:4px 0 0;font-size:12px;color:var(--deep);opacity:.65;">Tallas y colores sujetos a disponibilidad.</p>'
    : '';
  COLOR_SELECCIONADO = null;
  TALLA_SELECCIONADA = null;

  var desc = a.descripcion || a.descripcion_corta || '';

  document.getElementById('md-contenido').innerHTML =
    '<button class="btn-cerrar" id="btn-cerrar-detalle">✕</button>' +
    '<div class="prod-wrap">' +
      '<div class="prod-gallery"><div class="prod-img">' + img + '</div></div>' +
      '<div class="prod-info">' +
        (a.categoria ? '<div class="prod-eyebrow"><span>' + escapeHtml(a.categoria) + '</span>' + (a.subcategoria ? '<span class="dot"></span><span>' + escapeHtml(a.subcategoria) + '</span>' : '') + '</div>' : '') +
        '<h1 class="prod-titulo">' + escapeHtml(a.nombre) + '</h1>' +
        (desc ? '<p class="prod-desc">' + escapeHtml(desc) + '</p>' : '') +
        tabsHtml +
        coloresHtml +
        tallaHtml +
        disponibilidadHtml +
        guiaTallasHtml +
        '<div class="md-calc" id="md-calc"></div>' +
        '<div class="prod-ctas">' +
          '<button type="button" class="btn btn-primary" id="btn-presupuesto-desde-detalle">Pedir presupuesto</button>' +
        '</div>' +
        '<p class="mp-precio-aprox">Precio aproximado. El presupuesto final puede variar según diseño y detalles del pedido.</p>' +
      '</div>' +
    '</div>';

  document.getElementById('btn-cerrar-detalle').addEventListener('click', cerrarModalDetalle);
  var btnGuiaTallas = document.getElementById('btn-guia-tallas');
  if (btnGuiaTallas) {
    btnGuiaTallas.addEventListener('click', function(){ abrirModalTallas(a.nombre, a.guia_tallas); });
  }
  activarSelectorColores(a);
  var tallaSelect = document.getElementById('md-talla-select');
  if (tallaSelect) {
    tallaSelect.addEventListener('change', function(){ TALLA_SELECCIONADA = tallaSelect.value || null; });
  }
  document.querySelectorAll('#md-contenido .prod-tab').forEach(function(tab){
    tab.addEventListener('click', function(){
      document.querySelectorAll('#md-contenido .prod-tab').forEach(function(t){ t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
      document.querySelectorAll('#md-contenido .prod-panel').forEach(function(p){ p.hidden = p.dataset.panel !== tab.dataset.tab; });
    });
  });
  document.getElementById('btn-presupuesto-desde-detalle').addEventListener('click', function(){
    cerrarModalDetalle();
    abrirModalPresupuesto(a.id, { color: COLOR_SELECCIONADO, talla: TALLA_SELECCIONADA });
  });

  renderCalculadora(a);
}

function abrirModalDetalle(articuloId) {
  var a = ARTICULOS_MOSTRADOS.find(function(x){ return x.id === articuloId; });
  if (!a) return;
  actualizarUrlArticulo(articuloId);
  renderFichaProducto(a);
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

// "Personalización para eventos" (Dilo Bonito) no es un artículo físico:
// no tiene técnica/área que calcular, su precio depende del nº de
// invitados (packs) — usa una calculadora propia en vez de la de
// cantidad+técnica del resto del catálogo.
function esArticuloEventos(articulo) {
  return articulo.categoria === 'Servicios para eventos';
}

// Mismas 3 opciones que ArticuloEvento/COSTES_ARTICULO en calculator.ts
// (bendito-os) — el nombre visible es solo de presentación, el value es
// la clave real que espera calcularPrecioEvento.
var ARTICULOS_EVENTOS = [
  { value: 'neceser', etiqueta: 'Neceser' },
  { value: 'tote', etiqueta: 'Tote bag' },
  { value: 'camiseta', etiqueta: 'Camiseta' },
];

function renderCalculadoraEventos(articulo) {
  var cont = document.getElementById('md-calc');
  if (!cont) return;
  var opcionesArticulo = ARTICULOS_EVENTOS.map(function(a){
    return '<option value="' + escapeHtml(a.value) + '">' + escapeHtml(a.etiqueta) + '</option>';
  }).join('');
  cont.innerHTML =
    '<div class="md-calc-title">Calcula tu pack orientativo</div>' +
    '<div class="md-calc-row">' +
      '<label>Número de invitados<input type="number" id="calc-invitados" min="1" value="50"></label>' +
      '<label>Artículo a personalizar<select id="calc-articulo-evento">' + opcionesArticulo + '</select></label>' +
    '</div>' +
    '<button type="button" class="btn-calcular" id="btn-calcular">CALCULAR PRECIO→</button>' +
    '<div class="md-calc-resultado" id="calc-resultado" style="display:none;"></div>';

  document.getElementById('btn-calcular').addEventListener('click', function(){ ejecutarCalculoEvento(articulo.id); });
  ejecutarCalculoEvento(articulo.id);
}

async function ejecutarCalculoEvento(articuloId) {
  var btn = document.getElementById('btn-calcular');
  var resEl = document.getElementById('calc-resultado');
  var invitados = parseInt(document.getElementById('calc-invitados').value, 10) || 1;
  var articuloEl = document.getElementById('calc-articulo-evento');
  var articuloElegido = articuloEl ? articuloEl.value : null;

  btn.disabled = true; btn.textContent = 'Calculando...';
  resEl.style.display = 'none';

  try {
    var r = await fetch('/api/catalogo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'calcularPrecioEvento', articulo_id: articuloId, invitados: invitados, articulo: articuloElegido }),
    });
    var d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Error al calcular');

    var etiquetaArticulo = ARTICULOS_EVENTOS.filter(function(a){ return a.value === d.articulo; }).map(function(a){ return a.etiqueta; })[0];
    resEl.innerHTML =
      '<div class="md-calc-total">Pack ' + escapeHtml(d.pack.nombre) + ': ' + d.precio.toFixed(2) + '€ <span>(' + d.invitados + ' invitados' + (etiquetaArticulo ? ' · ' + escapeHtml(etiquetaArticulo) : '') + ')</span></div>' +
      '<div class="md-calc-aviso">' + escapeHtml(d.aviso) + '</div>';
    resEl.style.display = 'block';
  } catch (e) {
    resEl.innerHTML = '<div class="md-calc-error">' + escapeHtml(e.message) + '</div>';
    resEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'CALCULAR PRECIO→';
  }
}

async function renderCalculadora(articulo) {
  var cont = document.getElementById('md-calc');
  if (!cont) return;
  if (esArticuloEventos(articulo)) { renderCalculadoraEventos(articulo); return; }
  cont.innerHTML = '<p class="md-calc-loading">Cargando calculadora…</p>';

  var meta = await cargarMetaPersonalizacion();
  var todasTecnicas = meta.tecnicas || [];

  var tecnicasArticulo = (articulo.tecnicas_personalizacion || []).map(function(t){ return String(t).toLowerCase(); });
  var tecnicasAplicables = tecnicasArticulo.length
    ? todasTecnicas.filter(function(t){ return tecnicasArticulo.indexOf(String(t).toLowerCase()) !== -1; })
    : todasTecnicas;
  if (!tecnicasAplicables.length) tecnicasAplicables = todasTecnicas;

  // El precio "desde" del listado (sin personalizar) se calcula aparte, en
  // /api/catalogo (precio_desde) — pero todo presupuesto real que se haga
  // desde esta calculadora debe incluir ya la personalización: la técnica
  // ya no es opcional por defecto, se preselecciona la primera aplicable al
  // artículo. Solo los artículos marcados en el ERP con
  // permite_sin_personalizar (los que también se venden en blanco) ofrecen
  // "Sin personalizar" como opción — para el resto no existe. Antes, si no
  // había fichas de coste de tipo "tecnica" en el catálogo interno
  // (fichas_costes), aquí se vaciaba el contenedor entero y la calculadora
  // desaparecía sin más, aunque el precio base sí se pudiera calcular.
  //
  // Los "extras" (fichas_costes tipo "extra") son específicos de Dilo
  // Bonito (eventos) — no se muestran aquí, esto es el catálogo B2B/B2C de
  // producto: mostrar "Extras de eventos" en todos los artículos (un
  // bálsamo labial, p.ej.) no tiene sentido para el cliente.
  var opcionSinPersonalizar = articulo.permite_sin_personalizar ? '<option value="">Sin personalizar</option>' : '';
  var tecnicaHtml = tecnicasAplicables.length
    ? '<label>Técnica<select id="calc-tecnica">' + opcionSinPersonalizar +
        tecnicasAplicables.map(function(t){ return '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>'; }).join('') +
      '</select></label>'
    : '';

  var moq = articulo.moq || 5;
  cont.innerHTML =
    '<div class="md-calc-title">Calcula tu precio aproximado</div>' +
    '<div class="md-calc-row">' +
      '<label>Cantidad<input type="number" id="calc-cantidad" min="' + moq + '" value="' + Math.max(25, moq) + '"></label>' +
      tecnicaHtml +
    '</div>' +
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
  var extras = [];

  btn.disabled = true; btn.textContent = 'Calculando...';
  resEl.style.display = 'none';

  try {
    var r = await fetch('/api/catalogo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'calcularPrecio', articulo_id: articuloId, cantidad: cantidad, tecnica: tecnica, extras: extras })
    });
    var d = await r.json();
    
    // Manejar cantidad menor a MOQ: no es error, es invitación a contactar
    if (d.moq_no_alcanzado) {
      resEl.innerHTML =
        '<div style="padding: 12px; border-left: 3px solid #E2704A; background: #FBF4E9;">' +
        '<div style="font-weight: bold; font-size: 0.95rem; margin-bottom: 8px; color: #17233F;">' + escapeHtml(d.mensaje) + '</div>' +
        '<div style="font-size: 0.85rem; color: #666; margin-bottom: 12px;">Cantidad solicitada: ' + d.cantidad + ' uds</div>' +
        '<a href="/contacto" style="display: inline-block; padding: 10px 14px; background: #E2704A; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 0.9rem;">CONTACTAR→</a>' +
        '</div>';
      resEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'CALCULAR PRECIO→';
      return;
    }
    
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

function cerrarModalDetalle(actualizarUrl) {
  // En la página de producto independiente #modal-detalle no existe (la
  // ficha se renderiza directamente en la página, no en un modal) — sigue
  // siendo válido pulsar "Pedir presupuesto" ahí, así que esto debe ser un
  // no-op seguro en vez de lanzar.
  var modal = document.getElementById('modal-detalle');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
  if (actualizarUrl !== false) actualizarUrlArticulo(null);
}

var elModalDetalle = document.getElementById('modal-detalle');
if (elModalDetalle) {
  elModalDetalle.addEventListener('click', function(e){
    if (e.target === elModalDetalle) cerrarModalDetalle();
  });
}

// Mantiene la URL sincronizada con el modal: atrás cierra la ficha, adelante
// la vuelve a abrir. No se llama a actualizarUrlArticulo desde aquí (el
// cambio de URL ya lo disparó el propio navegador) para no generar una
// entrada de historial extra.
window.addEventListener('popstate', function(){
  var id = new URLSearchParams(location.search).get('articulo');
  if (id) abrirModalDetalle(id); else cerrarModalDetalle(false);
});
