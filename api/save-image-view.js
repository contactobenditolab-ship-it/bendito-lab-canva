// POST /api/save-image-view (auth) — guarda el encuadre (zoom + posición) de
// una foto dentro de su hueco. Body JSON: { path, s, x, y }.
// s = escala (1 = tamaño base), x/y = desplazamiento en % del hueco.
const { requireAuth } = require('../lib/auth');
const { updateContent } = require('../lib/content-store');

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

  var savedView;
  await updateContent(function (data) {
    data.imageView = data.imageView || {};
    data.imageView[path] = { s: clampedS, x: clampedX, y: clampedY };
    savedView = data.imageView[path];
  });

  return res.status(200).json({ ok: true, view: savedView });
};
