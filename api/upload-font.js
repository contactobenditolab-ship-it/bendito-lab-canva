// POST /api/upload-font (auth) — tipografías propias subidas desde el editor
// visual. Se guardan en el bucket sitio-fuentes y se registran en
// site-content.json (data.fonts); js/bl-images.js les crea el @font-face en
// cada página.
//   Subir:  { name, filename, dataUrl }   (woff2, woff, ttf u otf; máx 3MB)
//   Borrar: { name, remove: true }
// Qué texto usa qué fuente se guarda aparte, con /api/save-text { id, font }.
const { requireAuth } = require('../lib/auth');
const { updateContent } = require('../lib/content-store');
const { supabaseServiceClient, supabaseStorageDeleteByUrl } = require('../lib/common');

const BUCKET = 'sitio-fuentes';
// 3MB en binario son ~4MB en base64: por debajo del límite de 4.5MB de body de Vercel.
const MAX_BYTES = 3 * 1024 * 1024;
const MIME_BY_EXT = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' };
const FORMAT_BY_EXT = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };

// El nombre acaba dentro de CSS (font-family y @font-face), así que solo se
// admiten caracteres que no puedan romper la regla.
const NAME_RE = /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ _-]{1,60}$/;

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
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!NAME_RE.test(name)) {
    return res.status(400).json({ error: 'Nombre no válido (letras, números, espacios, - y _; máx 60)' });
  }

  if (body.remove) {
    let removedUrl = null;
    const data = await updateContent(function (d) {
      const fonts = Array.isArray(d.fonts) ? d.fonts : [];
      const f = fonts.find(function (x) { return x.name === name; });
      if (f) removedUrl = f.url;
      d.fonts = fonts.filter(function (x) { return x.name !== name; });
    });
    if (removedUrl) supabaseStorageDeleteByUrl(BUCKET, removedUrl).catch(function () {});
    return res.status(200).json({ ok: true, fonts: data.fonts });
  }

  const filename = typeof body.filename === 'string' ? body.filename : '';
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (!MIME_BY_EXT[ext]) {
    return res.status(400).json({ error: 'Formato no soportado: usa .woff2, .woff, .ttf u .otf' });
  }
  const match = /^data:[^;,]*;base64,(.+)$/.exec(body.dataUrl || '');
  if (!match) return res.status(400).json({ error: 'Falta el archivo' });
  const buf = Buffer.from(match[1], 'base64');
  if (!buf.length) return res.status(400).json({ error: 'Archivo vacío' });
  if (buf.length > MAX_BYTES) return res.status(400).json({ error: 'Archivo demasiado grande (máx 3MB). Prueba a subirla en .woff2' });

  const supabase = supabaseServiceClient();
  const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-');
  const storagePath = slug + '-' + Date.now() + '.' + ext;
  // Igual que en upload-image.js: el Buffer va dentro de un Blob para que
  // storage-js no lo trate como texto y corrompa los bytes >= 0x80.
  const cuerpo = new Blob([new Uint8Array(buf)], { type: MIME_BY_EXT[ext] });
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, cuerpo, {
    contentType: MIME_BY_EXT[ext],
    upsert: false,
  });
  if (error) return res.status(500).json({ error: 'Error subiendo la fuente: ' + error.message });
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  let prevUrl = null;
  const data = await updateContent(function (d) {
    const fonts = Array.isArray(d.fonts) ? d.fonts : [];
    const prev = fonts.find(function (x) { return x.name === name; });
    if (prev) prevUrl = prev.url;
    d.fonts = fonts
      .filter(function (x) { return x.name !== name; })
      .concat([{ name: name, url: publicUrl, format: FORMAT_BY_EXT[ext] }]);
  });
  // Subir otra vez con el mismo nombre sustituye el archivo anterior.
  if (prevUrl && prevUrl !== publicUrl) supabaseStorageDeleteByUrl(BUCKET, prevUrl).catch(function () {});

  return res.status(200).json({ ok: true, fonts: data.fonts });
};
