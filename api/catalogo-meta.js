// GET /api/catalogo-meta (auth) — categorías y etiquetas ya usadas en el
// catálogo de Bendito OS (Supabase), para que el admin pueda elegir sobre
// seguro al crear una colección en vez de escribir el tag a ciegas.
// Auth-gated (a diferencia de api/catalogo.js): es información de gestión
// interna, no hace falta exponerla a cualquier visitante.
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../lib/auth');

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

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireAuth(req, res)) return;

  try {
    const supabase = client();
    const { data, error } = await supabase
      .from('catalogo_articulos')
      .select('categoria, etiquetas')
      .eq('activo', true);

    if (error) throw error;

    const categorias = new Set();
    const etiquetas = new Set();
    (data || []).forEach(function (a) {
      if (a.categoria) categorias.add(a.categoria);
      (a.etiquetas || []).forEach(function (t) { if (t) etiquetas.add(t); });
    });

    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.status(200).json({
      categorias: [...categorias].sort(),
      etiquetas: [...etiquetas].sort(),
    });
  } catch (e) {
    console.error('Error listando meta del catálogo:', e.message);
    return res.status(500).json({ error: 'No se pudo cargar categorías/etiquetas' });
  }
};
