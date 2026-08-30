// POST /api/delete-image (auth) — quita la sustitución de un slot y borra el
// objeto asociado en Supabase Storage. La foto original estática (la del
// repo) vuelve a mostrarse. Body JSON: { path }.
const { requireAuth } = require('../lib/auth');
const { supabaseServiceClient, supabaseStorageDeleteByUrl } = require('../lib/common');

const BUCKET = 'sitio-imagenes';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireAuth(req, res)) return;

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const path = body && body.path;
  if (typeof path !== 'string' || !path) {
    return res.status(400).json({ error: 'Falta path' });
  }

  const supabase = supabaseServiceClient();
  const { data: existente } = await supabase.from('sitio_imagenes').select('url').eq('slot', path).maybeSingle();
  const url = existente ? existente.url : null;

  // Se borra la fila entera (no solo la url): la foto sustituida podía tener
  // su propio encuadre/zoom guardado, y si no se borra también aquí, al
  // restaurarse la foto original estática se le sigue aplicando ese
  // zoom/posición viejo y se ve recortada o descuadrada.
  const { error } = await supabase.from('sitio_imagenes').delete().eq('slot', path);
  if (error) return res.status(500).json({ error: 'Error borrando el hueco: ' + error.message });

  if (url) supabaseStorageDeleteByUrl(BUCKET, url).catch(() => {});
  return res.status(200).json({ ok: true });
};
