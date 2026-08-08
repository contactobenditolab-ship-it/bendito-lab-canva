// POST /api/save-text (auth) — guarda el texto editado de un bloque de una
// página. Body JSON: { id, text }. `id` es el valor del atributo
// data-edit="..." del elemento en la página pública.
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
  const id = body && body.id;
  const text = body && body.text;
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'Falta id' });
  }
  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'Falta text' });
  }
  if (text.length > 5000) {
    return res.status(400).json({ error: 'Texto demasiado largo' });
  }

  await updateContent(function (data) {
    data.texts = data.texts || {};
    data.texts[id] = text;
  });

  return res.status(200).json({ ok: true, id, text });
};
