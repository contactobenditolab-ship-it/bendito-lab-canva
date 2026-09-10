// GET  /api/db?tabla=precios_bendito|precios_portal|calc_precios   (auth)
// POST /api/db  { accion, ... }                                    (auth)
//
// Backend Supabase para las tablas de precios del panel /admin (mismo
// proyecto Supabase que Bendito OS). Alcance limitado a lo que usa
// admin-1.js: precios_portal (lista) y calc_precios (documento único,
// calculadora interna B2B). Las técnicas/extras públicas del catálogo
// (api/catalogo.js) salen de fichas_costes, gestionadas en la app.
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../lib/auth');

let cachedClient = null;
function client() {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas');
  }
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const supabase = client();

  try {
    if (req.method === 'GET') {
      const tabla = req.query.tabla;

      if (tabla === 'precios_portal') {
        const { data, error } = await supabase
          .from('precios_portal').select('*').order('seccion').order('orden');
        if (error) throw error;
        return res.status(200).json({ data: data || [] });
      }

      if (tabla === 'calc_precios') {
        const { data, error } = await supabase
          .from('calc_precios').select('contenido').eq('id', 1).maybeSingle();
        if (error) throw error;
        return res.status(200).json({ data: data ? data.contenido : {} });
      }

      if (tabla === 'contenido_web') {
        const pagina = req.query.pagina;
        if (!pagina) return res.status(400).json({ error: 'Falta pagina' });
        const { data, error } = await supabase
          .from('contenido_web').select('contenido').eq('pagina', pagina).maybeSingle();
        if (error) throw error;
        return res.status(200).json({ data: data ? data.contenido : {} });
      }

      return res.status(400).json({ error: 'Tabla desconocida' });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const accion = body && body.accion;

      if (accion === 'guardarPrecio') {
        const d = body.datos;
        if (!d || !d.id) return res.status(400).json({ error: 'Falta id' });
        const { error } = await supabase.from('precios_portal').upsert({
          id: d.id, seccion: d.seccion, nombre: d.nombre, precio: String(d.precio),
          tipo: d.tipo || 'fijo', visible: d.visible !== false, orden: d.orden || 0,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      if (accion === 'eliminarPrecio') {
        const id = body.id;
        if (!id) return res.status(400).json({ error: 'Falta id' });
        const { error } = await supabase.from('precios_portal').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      if (accion === 'guardarContenidoWeb') {
        const { pagina, contenido } = body;
        if (!pagina) return res.status(400).json({ error: 'Falta pagina' });
        const { error } = await supabase.from('contenido_web').upsert({
          pagina, contenido: contenido || {}, updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      if (accion === 'guardarCalcPrecios') {
        const { error } = await supabase.from('calc_precios')
          .update({ contenido: body.datos, updated_at: new Date().toISOString() }).eq('id', 1);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Acción desconocida' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('Error /api/db:', e.message);
    return res.status(500).json({ error: 'Error de base de datos' });
  }
};
