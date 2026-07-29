// GET /api/catalogo — lista pública de artículos activos del catálogo de
// Bendito Lab (mismo proyecto Supabase que usa Bendito OS). Solo se
// seleccionan columnas seguras de mostrar a un visitante: nada de coste,
// proveedor, notas internas ni stock. Sin autenticación, de solo lectura.
// Usado por catalogo.html (grid completo, filtrable por categoría) y
// coleccion.html (sub-páginas filtradas por etiqueta — negocio, temporada,
// campaña...).
const { createClient } = require('@supabase/supabase-js');

let cachedClient = null;
function client() {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas');
  }
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

const CAMPOS_PUBLICOS = [
  'id', 'nombre', 'categoria', 'subcategoria', 'etiquetas',
  'descripcion', 'descripcion_corta',
  'material', 'colores', 'medidas', 'capacidad', 'formato', 'acabados',
  'tecnicas_personalizacion', 'guia_tallas',
  'imagen_principal_url',
].join(', ');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = client();
    const { data, error } = await supabase
      .from('catalogo_articulos')
      .select(CAMPOS_PUBLICOS)
      .eq('activo', true)
      .order('categoria', { ascending: true, nullsFirst: false })
      .order('nombre', { ascending: true });

    if (error) throw error;

    // Cacheable un rato corto: el catálogo no cambia cada minuto, pero
    // tampoco queremos que un cambio de activo/inactivo tarde en verse.
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.status(200).json({ articulos: data || [] });
  } catch (e) {
    console.error('Error listando catálogo público:', e.message);
    return res.status(500).json({ error: 'No se pudo cargar el catálogo' });
  }
};
