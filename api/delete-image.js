// POST /api/delete-image (auth) — quita la sustitución de un slot y borra el
// blob asociado. La foto original estática (la del repo) vuelve a mostrarse.
// Body JSON: { path }.
const { del } = require('@vercel/blob');
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
  const path = body && body.path;
  if (typeof path !== 'string' || !path) {
    return res.status(400).json({ error: 'Falta path' });
  }

  const data = await readContent();
  data.images = data.images || {};
  const url = data.images[path];
  if (url) {
    delete data.images[path];
    data.updatedAt = new Date().toISOString();
    await writeContent(data);
    del(url).catch(() => {});
  }
  return res.status(200).json({ ok: true });
};
