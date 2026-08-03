// GET  /api/catalogo                      — lista pública del catálogo (sin cambios)
// GET  /api/catalogo?meta=personalizacion  — técnicas y extras disponibles (nombres/precios
//                                             públicos, nunca coste/margen)
// POST /api/catalogo { accion:'calcularPrecio', articulo_id, cantidad, tecnica, extras }
//      — calculadora de precio aproximado para la tarjeta/modal de producto.
//        Usa EXACTAMENTE la misma fórmula que Bendito OS
//        (src/lib/catalogo/pricing.ts: calcularCosteReal + TRAMOS_MARGEN +
//        redondearPsicologico) para que el precio mostrado al cliente
//        coincida siempre con el que vería Silvia en el ERP. El coste real
//        y el % de margen NUNCA se devuelven al cliente, solo precios finales.
//
// Mismo proyecto Supabase que usa Bendito OS. Sin autenticación (de solo
// lectura salvo el cálculo, que no escribe nada).
const { createClient } = require('@supabase/supabase-js');

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

const CAMPOS_PUBLICOS = [
  'id', 'nombre', 'categoria', 'subcategoria', 'etiquetas',
  'descripcion', 'descripcion_corta',
  'material', 'colores', 'medidas', 'capacidad', 'formato', 'acabados',
  'tecnicas_personalizacion', 'guia_tallas',
  'imagen_principal_url',
].join(', ');

// ── Fórmula de precios (copia fiel de src/lib/catalogo/pricing.ts en bendito-os) ──
const MARGEN_MINIMO = 0.45;
const TRAMOS_MARGEN = [
  { cantidadMin: 1, margen: 0.7 },
  { cantidadMin: 10, margen: 0.68 },
  { cantidadMin: 20, margen: 0.65 },
  { cantidadMin: 25, margen: 0.62 },
  { cantidadMin: 50, margen: 0.58 },
  { cantidadMin: 100, margen: 0.54 },
  { cantidadMin: 200, margen: 0.5 },
  { cantidadMin: 300, margen: MARGEN_MINIMO },
];

function calcularCosteReal(a) {
  const subtotalFijo =
    (a.precio_coste || 0) + (a.pack_coste || 0) + (a.coste_envio || 0) +
    (a.coste_manipulacion || 0) + (a.coste_personalizacion || 0) +
    (a.coste_diseno || 0) + (a.coste_mano_obra || 0) + (a.coste_electricidad || 0);
  const pctTotal = (a.coste_mermas_pct || 0) + (a.coste_comisiones_pct || 0) + (a.costes_generales_pct || 0);
  const divisor = 1 - Math.min(pctTotal, 90) / 100;
  return {
    costeReal: subtotalFijo / divisor,
    costeRealSinEnvio: (subtotalFijo - (a.coste_envio || 0)) / divisor,
  };
}

function redondearPsicologico(precio) {
  if (precio <= 0) return 0;
  const entero = Math.floor(precio);
  const conDecimal = entero + 0.95;
  return conDecimal >= precio ? conDecimal : entero + 1 + 0.95;
}

function margenPorTramo(cantidad) {
  let margen = TRAMOS_MARGEN[0].margen;
  for (const t of TRAMOS_MARGEN) {
    if (cantidad >= t.cantidadMin) margen = t.margen;
  }
  return Math.max(margen, MARGEN_MINIMO);
}

// Precio unitario del producto en blanco (sin personalizar) para una cantidad dada.
function precioUnitarioProducto(articulo, cantidad) {
  const { costeReal, costeRealSinEnvio } = calcularCosteReal(articulo);
  if (articulo.margen_pct_b2b !== null && articulo.margen_pct_b2b !== undefined) {
    const margen = Math.min(Math.max(articulo.margen_pct_b2b, 0), 99) / 100;
    return redondearPsicologico(costeRealSinEnvio / (1 - margen));
  }
  const margen = margenPorTramo(cantidad);
  return redondearPsicologico(costeReal / (1 - margen));
}

// Precio unitario de una técnica de personalización según tramo de cantidad.
function precioUnitarioTecnica(tecnica, cantidad) {
  if (!tecnica || !Array.isArray(tecnica.tramos) || !tecnica.tramos.length) return 0;
  const tramos = tecnica.tramos.slice().sort((a, b) => (a.desde || 0) - (b.desde || 0));
  let elegido = tramos[0];
  for (const t of tramos) {
    if (cantidad >= (t.desde || 0)) elegido = t;
  }
  return Number(elegido.precio) || 0;
}

module.exports = async function handler(req, res) {
  const supabase = client();

  if (req.method === 'GET') {
    // Metadatos públicos para la calculadora: nombres de técnicas y extras
    // con sus precios (estos SÍ son públicos, ya son precios de venta).
    if (req.query.meta === 'personalizacion') {
      try {
        const { data, error } = await supabase
          .from('precios_bendito').select('tecnicas, extras').eq('id', 1).single();
        if (error) throw error;
        const tecnicas = (data && data.tecnicas || []).map((t) => t.nombre).filter(Boolean);
        const extras = (data && data.extras && data.extras.items) || [];
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        return res.status(200).json({ tecnicas, extras });
      } catch (e) {
        console.error('Error /api/catalogo?meta=:', e.message);
        return res.status(500).json({ error: 'No se pudo cargar la personalización' });
      }
    }

    try {
      const { data, error } = await supabase
        .from('catalogo_articulos')
        .select(CAMPOS_PUBLICOS)
        .eq('visible_web', true)
        .order('categoria', { ascending: true, nullsFirst: false })
        .order('nombre', { ascending: true });
      if (error) throw error;
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.status(200).json({ articulos: data || [] });
    } catch (e) {
      console.error('Error listando catálogo público:', e.message);
      return res.status(500).json({ error: 'No se pudo cargar el catálogo' });
    }
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    if (body && body.accion === 'calcularPrecio') {
      try {
        const articuloId = body.articulo_id;
        const cantidad = Math.max(parseInt(body.cantidad, 10) || 1, 1);
        const nombreTecnica = body.tecnica || null;
        const extrasElegidos = Array.isArray(body.extras) ? body.extras : [];

        if (!articuloId) return res.status(400).json({ error: 'Falta articulo_id' });

        const CAMPOS_COSTE = [
          'precio_coste', 'pack_coste', 'coste_envio', 'coste_manipulacion',
          'coste_personalizacion', 'coste_diseno', 'coste_mano_obra', 'coste_electricidad',
          'coste_mermas_pct', 'coste_comisiones_pct', 'costes_generales_pct', 'margen_pct_b2b',
        ].join(', ');

        const [{ data: articulo, error: e1 }, { data: precios, error: e2 }] = await Promise.all([
          supabase.from('catalogo_articulos').select(CAMPOS_COSTE).eq('id', articuloId).eq('visible_web', true).single(),
          supabase.from('precios_bendito').select('tecnicas, extras').eq('id', 1).single(),
        ]);
        if (e1 || !articulo) return res.status(404).json({ error: 'Artículo no encontrado' });
        if (e2) throw e2;

        const precioProducto = precioUnitarioProducto(articulo, cantidad);

        let precioTecnica = 0;
        let tecnicaNombre = null;
        if (nombreTecnica) {
          const tecnicas = (precios && precios.tecnicas) || [];
          const t = tecnicas.find((x) => (x.nombre || '').toLowerCase() === String(nombreTecnica).toLowerCase());
          if (t) { precioTecnica = precioUnitarioTecnica(t, cantidad); tecnicaNombre = t.nombre; }
        }

        const extrasDisponibles = (precios && precios.extras && precios.extras.items) || [];
        let extrasTotal = 0;
        const extrasAplicados = [];
        extrasElegidos.forEach((nombreExtra) => {
          const ex = extrasDisponibles.find((x) => (x.nombre || '').toLowerCase() === String(nombreExtra).toLowerCase());
          if (ex) { extrasTotal += Number(ex.precio) || 0; extrasAplicados.push({ nombre: ex.nombre, precio: Number(ex.precio) || 0 }); }
        });

        const precioUnitario = Math.round((precioProducto + precioTecnica) * 100) / 100;
        const subtotal = Math.round(precioUnitario * cantidad * 100) / 100;
        const total = Math.round((subtotal + extrasTotal) * 100) / 100;

        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({
          ok: true,
          cantidad,
          precio_producto_unitario: precioProducto,
          tecnica: tecnicaNombre,
          precio_tecnica_unitario: precioTecnica,
          precio_unitario: precioUnitario,
          subtotal,
          extras: extrasAplicados,
          extras_total: Math.round(extrasTotal * 100) / 100,
          total,
          aviso: 'Precio aproximado. El presupuesto final puede variar según diseño y detalles del pedido.',
        });
      } catch (e) {
        console.error('Error /api/catalogo calcularPrecio:', e.message);
        return res.status(500).json({ error: 'No se pudo calcular el precio' });
      }
    }
    return res.status(400).json({ error: 'Acción desconocida' });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
