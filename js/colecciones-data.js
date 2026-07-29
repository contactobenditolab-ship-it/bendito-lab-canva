
// js/colecciones-data.js — Config de las colecciones/sub-páginas del
// catálogo (por tipo de negocio, temporada, campaña...). Cada entrada usa
// el campo "etiquetas" que ya existe en la ficha de artículo de Bendito OS
// (Catálogo → editar artículo → Etiquetas, separadas por comas): basta con
// añadir esa palabra a los artículos que quieras que aparezcan aquí, sin
// tocar código ni base de datos.
//
// Para lanzar una colección nueva, añade una entrada más a este objeto
// (la clave es el slug que va en la URL /coleccion.html?c=slug) y haz commit
// — no hace falta ningún cambio en coleccion.html ni en coleccion-2.js.
var COLECCIONES = {
  verano: {
    titulo: 'Catálogo de Verano',
    subtitulo: 'Artículos pensados para eventos al aire libre, terrazas y campañas de temporada. Pide presupuesto sin compromiso.',
    heroImg: 'images/hero.jpg',
    // Etiqueta que deben tener los artículos en Bendito OS para aparecer
    // aquí (no distingue mayúsculas/minúsculas).
    tag: 'verano',
  },
  // Ejemplos de cómo seguiría creciendo esto — duplica una entrada y
  // cambia el slug/título/imagen/tag:
  // hosteleria: {
  //   titulo: 'Para Hostelería',
  //   subtitulo: 'Uniformes, menaje y merchandising para bares, restaurantes y hoteles.',
  //   heroImg: 'images/db-seating.jpg',
  //   tag: 'hosteleria',
  // },
  // navidad: {
  //   titulo: 'Campaña de Navidad',
  //   subtitulo: 'Regalos de empresa y packs corporativos para estas fiestas.',
  //   heroImg: 'images/merch.jpg',
  //   tag: 'navidad',
  // },
};
