// POST /api/delete-image (auth) — quita la sustitución de un slot y borra el
// blob asociado. La foto original estática (la del repo) vuelve a mostrarse.
// Body JSON: { path }.
const { del } = require('@vercel/blob');
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
  if (typeof path !== 'string' || !path) {
    return res.status(400).json({ error: 'Falta path' });
  }

  var url;
  await updateContent(function (data) {
    data.images = data.images || {};
    url = data.images[path];
    if (url) {
      delete data.images[path];
      // La foto sustituida podía tener su propio encuadre/zoom guardado;
      // si no se borra también aquí, al restaurarse la foto original
      // estática se le sigue aplicando ese zoom/posición viejo y se ve
      // recortada o descuadrada (mismo bug que se arregló en
      // upload-image.js para el caso de reemplazo).
      if (data.imageView && data.imageView[path]) delete data.imageView[path];
    }
  });
  if (url) del(url).catch(() => {});
  return res.status(200).json({ ok: true });
};
