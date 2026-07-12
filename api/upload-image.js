// POST /api/upload-image (auth) — sube una imagen a Vercel Blob y actualiza el
// mapa de contenido para el slot indicado. Body JSON: { path, dataUrl }.
// `path` es el id del slot (p.ej. "images/hero.jpg", el mismo valor que ya
// usa admin.html en IMG_GROUPS). `dataUrl` es un data: URL base64 ya
// redimensionado en el cliente (ver resizeImageToDataUrl en admin.html).
const { put, del } = require('@vercel/blob');
const { requireAuth } = require('../lib/auth');
const { readContent, writeContent } = require('../lib/content-store');

const MAX_BYTES = 4 * 1024 * 1024; // 4MB tras decodificar — deja margen bajo el límite de 4.5MB de body de Vercel
const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

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
  const dataUrl = body && body.dataUrl;
  if (typeof path !== 'string' || !path) {
    return res.status(400).json({ error: 'Falta path (slot de imagen)' });
  }
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return res.status(400).json({ error: 'Falta dataUrl' });
  }

  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return res.status(400).json({ error: 'dataUrl inválida' });
  const mime = match[1];
  const ext = EXT_BY_MIME[mime];
  if (!ext) return res.status(400).json({ error: 'Tipo de imagen no soportado: ' + mime });

  let buf;
  try {
    buf = Buffer.from(match[2], 'base64');
  } catch {
    return res.status(400).json({ error: 'No se pudo decodificar la imagen' });
  }
  if (!buf.length) return res.status(400).json({ error: 'Imagen vacía' });
  if (buf.length > MAX_BYTES) {
    return res.status(400).json({ error: 'Imagen demasiado grande (máx 4MB tras compresión)' });
  }

  const safeSlot = path.replace(/[^a-zA-Z0-9/_-]/g, '-').replace(/^\/+/, '');
  const blobPath = 'images/' + safeSlot + '-' + Date.now() + '.' + ext;

  let result;
  try {
    result = await put(blobPath, buf, {
      access: 'public',
      contentType: mime,
      addRandomSuffix: false,
    });
  } catch (e) {
    return res.status(500).json({ error: 'Error subiendo a Blob: ' + e.message });
  }

  const data = await readContent();
  data.images = data.images || {};
  const prevUrl = data.images[path];
  data.images[path] = result.url;
  data.updatedAt = new Date().toISOString();
  await writeContent(data);

  if (prevUrl && prevUrl !== result.url) {
    del(prevUrl).catch(() => {});
  }

  return res.status(200).json({ ok: true, url: result.url, path });
};
