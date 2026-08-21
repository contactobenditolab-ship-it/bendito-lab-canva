// lib/articulo-publico.js — Campos públicos del catálogo y el enriquecido
// común (colores resueltos contra la carta oficial, tallas, imagen por
// color) que necesitan tanto el listado (api/catalogo.js) como la ficha de
// un solo artículo (api/producto.js). Antes vivía duplicado en el listado;
// se extrae aquí para que ambos usen exactamente la misma lógica.
const { resolverColores } = require('./colores');

const CAMPOS_PUBLICOS = [
  'id', 'nombre', 'marca', 'categoria', 'subcategoria', 'etiquetas',
  'descripcion', 'descripcion_corta',
  'material', 'colores', 'medidas', 'capacidad', 'formato', 'acabados',
  'tecnicas_personalizacion', 'guia_tallas', 'areas_marcaje',
  'permite_sin_personalizar',
  'imagen_principal_url',
  'personalizacion_incluida', 'personalizacion_medidas',
  'superficie_max_personalizacion', 'personalizacion_ancho_max_cm', 'personalizacion_alto_max_cm',
].join(', ');

/**
 * A partir de filas base de catalogo_articulos (ya filtradas por
 * visible_web=true), añade colores_resueltos, tallas e imagenes_por_color.
 */
async function enriquecerArticulos(supabase, articulosBase) {
  const ids = (articulosBase || []).map((a) => a.id);
  const [{ data: variantesTalla }, { data: imagenesColor }] = await Promise.all([
    ids.length
      ? supabase.from('catalogo_variantes').select('articulo_id, valor').eq('tipo', 'talla').in('articulo_id', ids).order('orden')
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from('catalogo_imagenes').select('articulo_id, url, color').in('articulo_id', ids).not('color', 'is', null)
      : Promise.resolve({ data: [] }),
  ]);

  const tallasPorArticulo = new Map();
  (variantesTalla || []).forEach((v) => {
    if (!tallasPorArticulo.has(v.articulo_id)) tallasPorArticulo.set(v.articulo_id, []);
    tallasPorArticulo.get(v.articulo_id).push(v.valor);
  });
  const imagenesPorColorPorArticulo = new Map();
  (imagenesColor || []).forEach((img) => {
    if (!imagenesPorColorPorArticulo.has(img.articulo_id)) imagenesPorColorPorArticulo.set(img.articulo_id, {});
    imagenesPorColorPorArticulo.get(img.articulo_id)[img.color] = img.url;
  });

  return Promise.all(
    (articulosBase || []).map(async (a) => ({
      ...a,
      colores_resueltos: a.colores && a.colores.length ? await resolverColores(a.colores) : [],
      tallas: tallasPorArticulo.get(a.id) || [],
      imagenes_por_color: imagenesPorColorPorArticulo.get(a.id) || {},
    }))
  );
}

/** "Camiseta Esencial Roly" -> "camiseta-esencial-roly" */
function slugificar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

module.exports = { CAMPOS_PUBLICOS, enriquecerArticulos, slugificar };
