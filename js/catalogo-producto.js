
// js/catalogo-producto.js — Hidrata la ficha de producto servida por
// /api/producto (ver producto.js): el servidor ya renderiza una versión
// estática de la ficha en #md-contenido (para buscadores y vistas previas
// sin JS), y aquí se sustituye por la versión interactiva —colores, talla,
// calculadora de precio, botón de presupuesto— reutilizando exactamente
// las mismas funciones que ya usa el modal de detalle del catálogo
// (renderFichaProducto, en catalogo-comun.js).
//
// Los datos del artículo viajan en un <script type="application/json">, no
// en un <script> normal con window.__ARTICULO__=...: la CSP del sitio
// (script-src 'self' ..., sin 'unsafe-inline') bloquea cualquier <script>
// inline ejecutable, pero type="application/json" no cuenta como script
// ejecutable para la CSP, así que sí se sirve.
var elDatosArticulo = document.getElementById('datos-articulo');
var articuloActual = elDatosArticulo ? JSON.parse(elDatosArticulo.textContent) : null;
if (articuloActual) {
  ARTICULOS_MOSTRADOS = [articuloActual];
  renderFichaProducto(articuloActual);
}
