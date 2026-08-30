// POST /api/save-image-view (auth) — guarda el encuadre (zoom + posición) de
// una foto dentro de su hueco. Body JSON: { path, s, x, y }.
// s = escala (1 = tamaño base), x/y = desplazamiento en % del hueco.
const { requireAuth } = require('../lib/auth');
const { supabaseServiceClient } = require('../lib/common');

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
  const s = Number(body && body.s);
  const x = Number(body && body.x);
  const y = Number(body && body.y);
  if (typeof path !== 'string' || !path) {
    return res.status(400).json({ error: 'Falta path' });
  }
  if (!Number.isFinite(s) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return res.status(400).json({ error: 'Encuadre inválido' });
  }
  const clampedS = Math.max(1, Math.min(3, s));
  const clampedX = Math.max(-60, Math.min(60, x));
  const clampedY = Math.max(-60, Math.min(60, y));

  // No se manda `url` en el upsert: si la fila ya existe (foto personalizada)
  // Postgrest solo actualiza las columnas indicadas y deja `url` tal cual; si
  // no existe (encuadre sobre la foto estática por defecto), se crea la fila
  // con url a null.
  const { error } = await supabaseServiceClient().from('sitio_imagenes').upsert({
    slot: path,
    zoom_s: clampedS,
    zoom_x: clampedX,
    zoom_y: clampedY,
    updated_at: new Date().toISOString(),
  });
  if (error) return res.status(500).json({ error: 'Error guardando el encuadre: ' + error.message });

  return res.status(200).json({ ok: true, view: { s: clampedS, x: clampedX, y: clampedY } });
};
