// POST /api/upload-logo-presupuesto — sube a Vercel Blob el logo que un
// cliente adjunta al pedir presupuesto en el catálogo público, para poder
// mandarle un mockup con su diseño. Público (sin auth, lo llama cualquier
// visitante desde el modal de presupuesto) pero con rate limit por IP,
// igual que /api/contact.
const { put } = require('@vercel/blob');
const { dentroDelLimite, ipDesdeRequest } = require('../lib/rate-limit');

const MAX_BYTES = 4 * 1024 * 1024; // 4MB tras decodificar, mismo límite que /api/upload-image
const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await dentroDelLimite('upload-logo:' + ipDesdeRequest(req), 10, 15 * 60 * 1000))) {
    return res.status(429).json({ error: 'Demasiadas solicitudes, inténtalo más tarde' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const dataUrl = body && body.dataUrl;
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
    return res.status(400).json({ error: 'Imagen demasiado grande (máx 4MB)' });
  }

  const blobPath = 'logos-presupuesto/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;

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

  return res.status(200).json({ ok: true, url: result.url });
};
