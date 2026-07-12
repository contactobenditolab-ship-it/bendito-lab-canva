// POST /api/save-color (auth) — guarda un color (fondo o texto) elegido en
// el editor. Body JSON: { id, value }. `value` es un color CSS (#rrggbb).
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
  const value = body && body.value;
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'Falta id' });
  }
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
