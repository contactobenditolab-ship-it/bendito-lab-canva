// POST /api/upload-image (auth) — sube una imagen a Supabase Storage (bucket
// sitio-imagenes) y actualiza el mapa de contenido para el slot indicado.
// Body JSON: { path, dataUrl }. `path` es el id del slot (p.ej.
// "images/hero.jpg", el mismo valor que ya usa admin.html en IMG_GROUPS).
// `dataUrl` es un data: URL base64 ya redimensionado en el cliente (ver
// resizeImageToDataUrl en admin.html).
const { requireAuth } = require('../lib/auth');
const { updateContent } = require('../lib/content-store');
const { supabaseServiceClient, supabaseStorageDeleteByUrl } = require('../lib/common');

const BUCKET = 'sitio-imagenes';

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
  const storagePath = 'images/' + safeSlot + '-' + Date.now() + '.' + ext;

  // El Buffer se envuelve en un Blob: si se manda tal cual, storage-js lo
  // trata como cuerpo crudo de texto en algunos runtimes serverless y cada
  // byte >= 0x80 se corrompe (mismo bug ya visto y resuelto en bendito-os).
  const cuerpo = new Blob([new Uint8Array(buf)], { type: mime });
  const supabase = supabaseServiceClient();
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, cuerpo, { contentType: mime, upsert: false });
  if (uploadError) {
    return res.status(500).json({ error: 'Error subiendo la imagen: ' + uploadError.message });
  }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  var prevUrl;
  await updateContent(function (data) {
    data.images = data.images || {};
    prevUrl = data.images[path];
    data.images[path] = publicUrl;
    // La foto nueva no tiene por qué encajar con el zoom/posición guardado
    // para la foto anterior en este mismo hueco, así que se resetea aquí
    // mismo: si esto se hiciera en una segunda petición a /api/save-image-view
    // (como antes), su propio readContent()/writeContent() podía leer una
    // copia todavía no propagada del content.json (el objeto es público y
    // pasa por CDN) y sobrescribir esta imagen recién subida con la versión
    // vieja.
    if (data.imageView && data.imageView[path]) delete data.imageView[path];
  });

  if (prevUrl && prevUrl !== publicUrl) {
    supabaseStorageDeleteByUrl(BUCKET, prevUrl).catch(() => {});
  }

  return res.status(200).json({ ok: true, url: publicUrl, path });
};
