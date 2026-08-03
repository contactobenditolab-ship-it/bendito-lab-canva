// GET  /api/content            — mapa público { images: { slotPath: blobUrl }, updatedAt }
// POST /api/content (auth)     — { path, url } asigna/quita una entrada suelta (uso interno/manual)
const { readContent, writeContent } = require('../lib/content-store');
const { requireAuth } = require('../lib/auth');

const { createClient } = require('@supabase/supabase-js');
let cachedSupabase = null;
function supabaseClient() {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas');
  cachedSupabase = createClient(url, key, { auth: { persistSession: false } });
  return cachedSupabase;
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    // ?pagina=X — contenido de texto editado desde /admin (tabla contenido_web),
    // consumido por bl-content.js en las paginas publicas. Publico, solo lectura.
    if (req.query.pagina) {
      try {
        const supabase = supabaseClient();
        const { data, error } = await supabase
          .from('contenido_web').select('contenido').eq('pagina', req.query.pagina).maybeSingle();
        if (error) throw error;
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        return res.status(200).json({ data: data ? data.contenido : {} });
      } catch (e) {
        console.error('Error /api/content?pagina=:', e.message);
        return res.status(500).json({ error: 'No se pudo cargar el contenido' });
      }
    }
    const data = await readContent();
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    if (!requireAuth(req, res)) return;
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const path = body && body.path;
    const url = body && body.url;
    if (typeof path !== 'string' || !path) {
      return res.status(400).json({ error: 'Falta path' });
    }
    const data = await readContent();
    data.images = data.images || {};
    if (url) data.images[path] = url;
    else delete data.images[path];
    data.updatedAt = new Date().toISOString();
    await writeContent(data);
    return res.status(200).json({ ok: true, images: data.images });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
