// POST /api/save-text (auth) — guarda el texto editado de un bloque de una
// página. Body JSON: { id, text }. `id` es el valor del atributo
// data-edit="..." del elemento en la página pública.
// Con { id, font } guarda en cambio la tipografía de ese bloque (un
// font-family de CSS; "" la quita y vuelve a la de la página).
const { requireAuth } = require('../lib/auth');
const { updateContent } = require('../lib/content-store');

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
  const text = body && body.text;
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'Falta id' });
  }
  if (body.font !== undefined) {
    const font = body.font;
    // Va directo a style.fontFamily: solo nombres, comillas y comas.
    if (typeof font !== 'string' || font.length > 200 || !/^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ _'",.-]*$/.test(font)) {
      return res.status(400).json({ error: 'Tipografía no válida' });
    }
    await updateContent(function (data) {
      data.textFonts = data.textFonts || {};
      if (font) data.textFonts[id] = font;
      else delete data.textFonts[id];
    });
    return res.status(200).json({ ok: true, id, font });
  }
  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'Falta text' });
  }
  if (text.length > 5000) {
    return res.status(400).json({ error: 'Texto demasiado largo' });
  }

  await updateContent(function (data) {
    data.texts = data.texts || {};
    data.texts[id] = text;
  });

  return res.status(200).json({ ok: true, id, text });
};
