// POST /api/save-link (auth) — guarda la URL y/o visibilidad de un enlace
// editable del sitio (p.ej. una red social). Body JSON: { id, url?, hidden? }.
// `id` es el valor del atributo data-link-id="..." del elemento en la
// página pública. Solo se actualizan los campos presentes en el body.
const { requireAuth } = require('../lib/auth');
const { readContent, writeContent } = require('../lib/content-store');

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
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'Falta id' });
  }

  const patch = {};
  if (body.url !== undefined) {
    if (typeof body.url !== 'string' || !body.url.trim() || body.url.length > 500) {
      return res.status(400).json({ error: 'URL inválida' });
    }
    patch.url = body.url.trim();
  }
  if (body.hidden !== undefined) {
    patch.hidden = !!body.hidden;
  }
  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: 'Nada que guardar' });
  }

  const data = await readContent();
  data.links = data.links || {};
  data.links[id] = Object.assign({}, data.links[id] || {}, patch);
  data.updatedAt = new Date().toISOString();
  await writeContent(data);

  return res.status(200).json({ ok: true, id, link: data.links[id] });
};
