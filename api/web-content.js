// GET /api/web-content?pagina=portada — contenido editado desde /admin para
// una página pública (textos guardados en Supabase, tabla contenido_web).
// Sin autenticación, de solo lectura — lo consume bl-content.js en cada página.
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

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const pagina = req.query.pagina;
  if (!pagina) return res.status(400).json({ error: 'Falta pagina' });

  try {
    const supabase = client();
    const { data, error } = await supabase
      .from('contenido_web').select('contenido').eq('pagina', pagina).maybeSingle();
    if (error) throw error;
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.status(200).json({ data: data ? data.contenido : {} });
  } catch (e) {
    console.error('Error /api/web-content:', e.message);
    return res.status(500).json({ error: 'No se pudo cargar el contenido' });
  }
};
