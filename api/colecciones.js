// GET  /api/colecciones        — mapa público { slug: {titulo, subtitulo, heroImg, tag} }
// POST /api/colecciones (auth) — reemplaza el mapa completo. Body JSON: { colecciones }
//
// Gestionado desde admin.html (panel "Colecciones"), guardado en el mismo
// JSON de Vercel Blob que ya usan las imágenes/textos del sitio (ver
// lib/content-store.js). Lo consume coleccion.html (js/coleccion-2.js) para
// las sub-páginas del catálogo por negocio/temporada/campaña.
const { readContent, writeContent } = require('../lib/content-store');
const { requireAuth } = require('../lib/auth');

const SLUG_VALIDO = /^[a-z0-9-]+$/;

function coleccionValida(c) {
  return c && typeof c === 'object'
    && typeof c.titulo === 'string' && c.titulo.trim()
    && typeof c.tag === 'string' && c.tag.trim();
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const data = await readContent();
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.status(200).json({ colecciones: data.colecciones || {} });
  }

  if (req.method === 'POST') {
    if (!requireAuth(req, res)) return;

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const colecciones = body && body.colecciones;
    if (!colecciones || typeof colecciones !== 'object' || Array.isArray(colecciones)) {
      return res.status(400).json({ error: 'Falta colecciones (objeto)' });
    }

    for (const slug of Object.keys(colecciones)) {
      if (!SLUG_VALIDO.test(slug)) {
        return res.status(400).json({ error: 'Slug inválido: "' + slug + '" (solo minúsculas, números y guiones)' });
      }
      if (!coleccionValida(colecciones[slug])) {
        return res.status(400).json({ error: 'Faltan datos en la colección "' + slug + '" (título y etiqueta son obligatorios)' });
      }
    }

    const data = await readContent();
    data.colecciones = colecciones;
    data.updatedAt = new Date().toISOString();
    await writeContent(data);

    return res.status(200).json({ ok: true, colecciones });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
