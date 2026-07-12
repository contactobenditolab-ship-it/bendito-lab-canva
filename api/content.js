// GET  /api/content            — mapa público { images: { slotPath: blobUrl }, updatedAt }
// POST /api/content (auth)     — { path, url } asigna/quita una entrada suelta (uso interno/manual)
const { readContent, writeContent } = require('../lib/content-store');
const { requireAuth } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const data = await readContent();
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.status(200).json(data);
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
    const data = await readContent();
    data.images = data.images || {};
    if (url) data.images[path] = url;
    else delete data.images[path];
    data.updatedAt = new Date().toISOString();
    await writeContent(data);
    return res.status(200).json({ ok: true, images: data.images });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
