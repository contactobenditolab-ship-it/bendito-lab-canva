// POST /api/save-color (auth) — guarda un color o un enlace editado en el
// editor visual. Body JSON para color: { id, value } (`value` es un color
// CSS). Body JSON para enlace: { id, url?, hidden? }. Se distingue por los
// campos presentes: `value` guarda en data.colors, `url`/`hidden` en
// data.links (mismo store, endpoint compartido para no pasar del límite de
// Serverless Functions del plan).
const { requireAuth } = require('../lib/auth');
const { readContent, writeContent } = require('../lib/content-store');

const COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^rgba?\([\d.,%\s]+\)$/;

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

  if (body.url !== undefined || body.hidden !== undefined) {
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
    const data = await readContent();
    data.links = data.links || {};
    data.links[id] = Object.assign({}, data.links[id] || {}, patch);
    data.updatedAt = new Date().toISOString();
    await writeContent(data);
    return res.status(200).json({ ok: true, id, link: data.links[id] });
  }

  const value = body && body.value;
  if (typeof value !== 'string' || !COLOR_RE.test(value.trim())) {
    return res.status(400).json({ error: 'Color inválido' });
  }

  const data = await readContent();
  data.colors = data.colors || {};
  data.colors[id] = value.trim();
  data.updatedAt = new Date().toISOString();
  await writeContent(data);

  return res.status(200).json({ ok: true, id, value: data.colors[id] });
};
