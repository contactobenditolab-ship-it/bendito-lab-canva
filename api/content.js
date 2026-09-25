// GET  /api/content            — mapa público { images: { slotPath: url }, imageView: {...}, colors, texts, links, updatedAt }
// POST /api/content (auth)     — { path, url } asigna/quita una entrada suelta (uso interno/manual)
const { leerImagenes, leerContenidoSitio } = require('../lib/content-store');
const { requireAuth } = require('../lib/auth');
const { supabaseServiceClient: supabaseClient } = require('../lib/common');

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
    const contenido = await leerContenidoSitio();
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.status(200).json(contenido);
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
    if (url) {
      const { error } = await supabaseClient().from('sitio_imagenes').upsert({
        slot: path, url, zoom_s: null, zoom_x: null, zoom_y: null, updated_at: new Date().toISOString(),
      });
      if (error) return res.status(500).json({ error: error.message });
    } else {
      const { error } = await supabaseClient().from('sitio_imagenes').delete().eq('slot', path);
      if (error) return res.status(500).json({ error: error.message });
    }
    const { images } = await leerImagenes();
    return res.status(200).json({ ok: true, images: images });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
