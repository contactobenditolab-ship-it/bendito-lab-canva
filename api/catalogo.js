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
const { CAMPOS_PUBLICOS, enriquecerArticulos } = require('../lib/articulo-publico');

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

// ── Fórmula de precios: CENTRALIZADA en bendito-os/api/catalog/pricing/calculate ──
// 20 Aug 2026: Migración P1 — bendito-os devuelve precioUnitario, margen, desglose
// Ver: INTEGRACION_CANVA.md en bendito-os para documentación completa
const PRICING_API_URL = process.env.BENDITO_OS_PRICING_API || 'https://app.benditolab.com/api/catalog/pricing/calculate';

/**
 * Llamar a API centralizada de bendito-os para calcular precio del producto.
 * Elimina duplicación de calcularCosteReal + redondearPsicologico + tramos.
 */
async function calcularPrecioDesdeAPI(articulo_id, cantidad, canal = 'b2c') {
  try {
    const response = await fetch(PRICING_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articulo_id, cantidad, canal }),
      timeout: 5000, // Fallback rápido si API no responde
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'API error desconocido');
    }

    // Retornar solo lo que necesitamos: precioUnitario ya redondeado
    return result.data;
  } catch (error) {
    console.error('[calcularPrecioDesdeAPI]', error.message);
    // Si falla, lanzar para que el handler maneje el error
    throw new Error(`No se pudo calcular precio desde API: ${error.message}`);
  }
}

// Los tramos de un grupo (catalogo_grupos_tramos.tramos, JSONB en Supabase)
// no tienen garantizada ninguna posición concreta — si se guardaron o se
// reserializaron fuera de orden, recorrerlos tal cual llegan aplicaría el
// margen equivocado (esta función y tramoActual en infoTramos asumen
// cantidadMin ascendente). Se ordena aquí, una sola vez, en vez de confiar
// en que cada llamador ya lo haga (el override B2C sí lo hacía, esto no).
function tramosOrdenados(tramos) {
  return [...tramos].sort((a, b) => a.cantidadMin - b.cantidadMin);
}

// Info de tramos por cantidad para mostrar al cliente (nunca el margen en
// sí, solo cantidades y precios ya calculados — ver cabecera del fichero).
// Si el artículo tiene margen_pct_b2b fijo (y no hay override de tramos),
// no hay tramos: precio plano.
// NOTA: Esta función AÚN llama precioUnitarioProducto para cada tramo,
// lo que sería ineficiente si fuese local. Pero ahora precisoUnitarioProducto
// llama la API, que cachea globalmente, así que está bien.
async function infoTramos(articulo, cantidad, articulo_id) {
  // Resolver tramos desde contexto fue removido — ahora todo va a través de API
  // Por ahora, devolver tabla vacía (el cliente solo ve precio actual)
  // TODO: Si queremos mostrar tabla de tramos, hay que hacerlo desde API también
  return { tiene_tramos: false, tabla: [] };
  // daría un "descuento" negativo. Se acota a 0 en vez de dejarlo pasar: la
  // UI solo pinta la línea de ahorro si es > 0, así que un valor negativo se
  // ocultaba en vez de avisar de la configuración anómala.
  const descuentoPct = precioSinDescuento > 0
    ? Math.max(0, Math.round((1 - precioActual / precioSinDescuento) * 100))
    : 0;
  return {
    tiene_tramos: true,
    tabla,
    cantidad_min_tramo_actual: tramoActual.cantidadMin,
    descuento_pct: descuentoPct,
  };
}

// Precio unitario de una técnica de personalización según tramo de cantidad.
// ── Precios derivados de fichas_costes (Bendito OS: /catalogo/fichas-tecnicas
// y /catalogo/fichas-extras) — una sola fuente de datos, sin duplicar en
// precios_bendito. Cada ficha trae varias líneas de coste (costes_variables);
// se usa el coste medio de esas líneas como coste real de la técnica/extra. ──
function costeTotalLinea(cv) {
  return (cv.coste_base || 0) + (cv.coste_personalizacion || 0);
}
function costeMedioFicha(ficha) {
  const vars = (ficha && ficha.costes_variables) || [];
  if (!vars.length) return 0;
  return vars.reduce((a, cv) => a + costeTotalLinea(cv), 0) / vars.length;
}
// Técnicas: SÍ llevan tramos por cantidad — se reutiliza el mismo calendario
// de márgenes (TRAMOS_MARGEN) que ya aplica al producto base, para que la
// técnica se abarate igual que el artículo al pedir más unidades.
function precioTecnicaDesdeFicha(ficha, cantidad, tramos) {
  const coste = costeMedioFicha(ficha);
  if (!coste) return 0;
  return coste / (1 - margenPorTramo(cantidad, tramos || TRAMOS_MARGEN_DEFECTO));
}
// Extras: precio fijo (no dependen de la cantidad, igual que antes), usando
// el margen propio de cada línea de coste de la ficha.
function pvpMedioFicha(ficha) {
  const vars = (ficha && ficha.costes_variables) || [];
  if (!vars.length) return 0;
  const suma = vars.reduce((a, cv) => {
    const coste = costeTotalLinea(cv);
    const margen = Math.min(Math.max(cv.margen_pct || 0, 0), 99) / 100;
    return a + (margen >= 1 ? coste : coste / (1 - margen));
  }, 0);
  return suma / vars.length;
}

const CAMPOS_COSTE_LISTADO = [
  'id', 'precio_coste', 'pack_coste', 'coste_envio', 'coste_manipulacion',
  'coste_personalizacion', 'coste_diseno', 'coste_mano_obra', 'coste_electricidad',
  'coste_mermas_pct', 'coste_comisiones_pct', 'costes_generales_pct', 'margen_pct_b2b',
  'proveedor_id', 'grupo_tramos_id', 'moq',
];

// "PVP desde" (precio a cantidad=1, tramo base) para cada artículo del
// listado público — permite ordenar por precio sin exponer coste/margen.
// P1 Migration (20 Aug 2026): Usa API centralizada en lugar de calcular localmente
async function calcularPreciosDesde(supabase, ids) {
  if (!ids.length) return new Map();

  try {
    const { data: filasCoste, error: eCoste } = await supabase
      .from('catalogo_articulos')
      .select('id, moq')
      .in('id', ids);
    if (eCoste) throw eCoste;

    const resultado = new Map();
    
    // Llamar API para cada artículo (cantidad = MOQ o 5)
    // TODO: Optimizar con batch endpoint si genera muchas requests
    for (const articulo of (filasCoste || [])) {
      const cantidad = articulo.moq || 5;
      try {
        const precioData = await calcularPrecioDesdeAPI(articulo.id, cantidad, 'b2c');
        resultado.set(articulo.id, precioData.precioUnitario);
      } catch (e) {
        console.warn(`[calcularPreciosDesde] Error para artículo ${articulo.id}:`, e.message);
        // Si falla una, seguir con las demás (fallback silencioso)
        resultado.set(articulo.id, null);
      }
    }
    
    return resultado;
  } catch (e) {
    console.error('[calcularPreciosDesde]', e.message);
    throw e;
  }
}

module.exports = async function handler(req, res) {
  const supabase = client();

  if (req.method === 'GET') {
    // Metadatos públicos para la calculadora: nombres de técnicas y extras
    // con sus precios (estos SÍ son públicos, ya son precios de venta).
    if (req.query.meta === 'personalizacion') {
      try {
        const [{ data: tecnicasData, error: e1 }, { data: extrasData, error: e2 }] = await Promise.all([
          supabase.from('fichas_costes').select('categoria').eq('tipo', 'tecnica').order('orden'),
          supabase.from('fichas_costes').select('categoria, costes_variables').eq('tipo', 'extra').order('orden'),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;
        const tecnicas = (tecnicasData || []).map((f) => f.categoria).filter(Boolean);
        const extras = (extrasData || [])
          .filter((f) => f.categoria)
          .map((f) => ({ nombre: f.categoria, precio: Math.round(pvpMedioFicha(f) * 100) / 100 }));
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

      const articulosEnriquecidos = await enriquecerArticulos(supabase, data || []);
      const preciosDesde = await calcularPreciosDesde(supabase, articulosEnriquecidos.map((a) => a.id));
      const articulos = articulosEnriquecidos.map((a) => ({
        ...a,
        precio_desde: preciosDesde.has(a.id) ? Math.round(preciosDesde.get(a.id) * 100) / 100 : null,
      }));

      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.status(200).json({ articulos });
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
        
        // Validar MOQ antes de realizar queries
        // Si el cliente pide menos que MOQ, devolver error sin hacer nada más
        // (MOQ se valida después de traer el artículo, ver más abajo)

        const CAMPOS_COSTE = [
          'precio_coste', 'pack_coste', 'coste_envio', 'coste_manipulacion',
          'coste_personalizacion', 'coste_diseno', 'coste_mano_obra', 'coste_electricidad',
          'coste_mermas_pct', 'coste_comisiones_pct', 'costes_generales_pct', 'margen_pct_b2b',
          'proveedor_id', 'grupo_tramos_id', 'moq',
        ].join(', ');

        const [{ data: articulo, error: e1 }, { data: fichaTecnica }, { data: fichasExtra }] = await Promise.all([
          supabase.from('catalogo_articulos').select(CAMPOS_COSTE).eq('id', articuloId).eq('visible_web', true).single(),
          nombreTecnica
            ? supabase.from('fichas_costes').select('categoria, costes_variables').eq('tipo', 'tecnica').eq('categoria', nombreTecnica).maybeSingle()
            : Promise.resolve({ data: null }),
          extrasElegidos.length
            ? supabase.from('fichas_costes').select('categoria, costes_variables').eq('tipo', 'extra')
            : Promise.resolve({ data: [] }),
        ]);
        if (e1 || !articulo) return res.status(404).json({ error: 'Artículo no encontrado' });

        // Validar MOQ (cantidad mínima de pedido): default 5 si no está definido
        const moq = articulo.moq || 5;
        if (cantidad < moq) {
          return res.status(200).json({
            ok: false,
            moq_no_alcanzado: true,
            moq,
            cantidad,
            mensaje: `Para pedidos menores de ${moq} unidades, por favor contacta con nosotros.`,
          });
        }

        const [{ data: proveedor }, { data: grupo }, { data: overrideRows }] = await Promise.all([
          articulo.proveedor_id
            ? supabase.from('catalogo_proveedores').select('coste_envio, unidades_tipicas_pedido').eq('id', articulo.proveedor_id).maybeSingle()
            : Promise.resolve({ data: null }),
          articulo.grupo_tramos_id
            ? supabase.from('catalogo_grupos_tramos').select('tramos').eq('id', articulo.grupo_tramos_id).maybeSingle()
            : Promise.resolve({ data: null }),
          // El sitio público vende a particulares/empresas como cliente final: se
          // usa el override del canal B2C (ver catalogo_precios_override).
          supabase.from('catalogo_precios_override').select('tramos').eq('articulo_id', articuloId).eq('canal', 'b2c').maybeSingle(),
        ]);

        // Llamar a API centralizada para calcular precio (P1 migration, 20 Aug 2026)
        const precioData = await calcularPrecioDesdeAPI(articuloId, cantidad, 'b2c');
        const precioProducto = precioData.precioUnitario;
        const tramos = { tiene_tramos: false, tabla: [] }; // TODO: implementar tabla de tramos desde API

        let precioTecnica = 0;
        let tecnicaNombre = null;
        if (fichaTecnica) { precioTecnica = precioTecnicaDesdeFicha(fichaTecnica, cantidad, contexto.tramos); tecnicaNombre = fichaTecnica.categoria; }

        const extrasDisponibles = fichasExtra || [];
        let extrasTotal = 0;
        const extrasAplicados = [];
        extrasElegidos.forEach((nombreExtra) => {
          const f = extrasDisponibles.find((x) => (x.categoria || '').toLowerCase() === String(nombreExtra).toLowerCase());
          if (f) {
            const precio = Math.round(pvpMedioFicha(f) * 100) / 100;
            extrasTotal += precio;
            extrasAplicados.push({ nombre: f.categoria, precio });
          }
        });

        const precioUnitario = Math.round((precioProducto + precioTecnica) * 100) / 100;
        const subtotal = Math.round(precioUnitario * cantidad * 100) / 100;
        const total = Math.round((subtotal + extrasTotal) * 100) / 100;

        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({
          ok: true,
          cantidad,
          precio_producto_unitario: precioProducto,
          tramos,
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
