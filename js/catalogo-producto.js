
// js/catalogo-producto.js — Hidrata la ficha de producto servida por
// /api/producto (ver producto.js): el servidor ya renderiza una versión
// estática de la ficha en #md-contenido (para buscadores y vistas previas
// sin JS), y aquí se sustituye por la versión interactiva —colores, talla,
// calculadora de precio, botón de presupuesto— reutilizando exactamente
// las mismas funciones que ya usa el modal de detalle del catálogo
// (renderFichaProducto, en catalogo-comun.js).
if (window.__ARTICULO__) {
  ARTICULOS_MOSTRADOS = [window.__ARTICULO__];
  renderFichaProducto(window.__ARTICULO__);
}
