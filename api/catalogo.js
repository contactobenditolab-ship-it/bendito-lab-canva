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
// Versión en lote (un artículo por fila) del mismo endpoint, para el "precio
// desde" del listado — evita una llamada HTTP + 1-3 queries a Supabase por
// cada artículo visible (ver calcularPreciosDesde más abajo).
const PRICING_API_BATCH_URL = PRICING_API_URL.replace(/\/calculate$/, '/calculate-batch');

// El precio del producto en sí ya viene de la API (arriba). Pero el precio de
// la TÉCNICA de personalización (DTF, láser, etc. — ver precioTecnicaDesdeFicha
// más abajo) nunca se migró a la API porque no es por artículo, así que sigue
// necesitando esta tabla de márgenes por defecto localmente.
const MARGEN_MINIMO = 0.45;
const TRAMOS_MARGEN_DEFECTO = [
  { cantidadMin: 1, margen: 0.7 },
  { cantidadMin: 10, margen: 0.68 },
  { cantidadMin: 20, margen: 0.65 },
  { cantidadMin: 25, margen: 0.62 },
  { cantidadMin: 50, margen: 0.58 },
  { cantidadMin: 100, margen: 0.54 },
  { cantidadMin: 200, margen: 0.5 },
  { cantidadMin: 300, margen: MARGEN_MINIMO },
];

/**
 * Llamar a API centralizada de bendito-os para calcular precio del producto.
 * Elimina duplicación de calcularCosteReal + redondearPsicologico + tramos.
 */
async function calcularPrecioDesdeAPI(articulo_id, cantidad, canal = 'b2c') {
  // El fetch nativo de Node (a diferencia de node-fetch) no soporta la opción
  // `timeout` — se ignoraba en silencio, así que un bendito-os colgado dejaba
  // esta llamada esperando hasta el límite de la función de Vercel en vez de
  // los 5s previstos. AbortController sí funciona con fetch nativo.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(PRICING_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articulo_id, cantidad, canal }),
      signal: controller.signal,
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
    const motivo = error.name === 'AbortError' ? 'timeout (5s)' : error.message;
    console.error('[calcularPrecioDesdeAPI]', motivo);
    // Si falla, lanzar para que el handler maneje el error
    throw new Error(`No se pudo calcular precio desde API: ${motivo}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Igual que calcularPrecioDesdeAPI pero para varios artículos en una sola
 * llamada — usa /calculate-batch en bendito-os. Devuelve un Map(articulo_id
 * -> precioUnitario), con `null` para los que no se pudieron calcular (no
 * lanza por artículo individual: solo lanza si la llamada entera falla).
 */
async function calcularPreciosDesdeAPIBatch(items) {
  if (!items.length) return new Map();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(PRICING_API_BATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'API error desconocido');
    }
    const resultado = new Map();
    for (const item of result.data) {
      if (item.success) resultado.set(item.articulo_id, item.precioUnitario);
      else {
        console.warn(`[calcularPreciosDesdeAPIBatch] Error para artículo ${item.articulo_id}:`, item.error);
        resultado.set(item.articulo_id, null);
      }
    }
    return resultado;
  } catch (error) {
    const motivo = error.name === 'AbortError' ? 'timeout (8s)' : error.message;
    console.error('[calcularPreciosDesdeAPIBatch]', motivo);
    throw new Error(`No se pudo calcular precios en lote: ${motivo}`);
  } finally {
    clearTimeout(timeoutId);
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

// Réplica de PACKS/getPack() en bendito-os (src/lib/eventos/calculator.ts)
// — repo separado, sin código compartido. Es la única fuente de precio
// para "Personalización para eventos" (Dilo Bonito) en el catálogo
// público: no pasa por precioUnitarioProducto (coste/margen de artículo
// físico, no aplica aquí), solo por el número de invitados, igual que la
// calculadora de presupuestos interna.
const PACKS_EVENTOS = [
  { nombre: 'MINI', min: 0, max: 30, precio: 250 },
  { nombre: 'ESENCIAL', min: 31, max: 50, precio: 300 },
  { nombre: 'CLÁSICO', min: 51, max: 100, precio: 400 },
  { nombre: 'COMPLETO', min: 101, max: 150, precio: 500 },
  { nombre: 'A MEDIDA', min: 151, max: 9999, precio: 750 },
];
function getPackEvento(invitados) {
  return PACKS_EVENTOS.find((p) => invitados >= p.min && invitados <= p.max) || PACKS_EVENTOS[PACKS_EVENTOS.length - 1];
}

// Resto de la réplica de calcularPresupuestoEvento() en calculator.ts —
// cuando el cliente elige qué artículo personalizar, el precio del pack
// puede quedarse corto para esa cantidad de invitados (más coste de
// material cuanto más caro el artículo), así que se recalcula el mínimo
// igual que hace el motor interno y se aplica el que sea mayor de los dos.
// Sin comisión de colaborador (comPct=0) ni extras (horas/diseño/km/niños):
// eso son datos internos del presupuesto, no de esta calculadora pública.
const OCUPACION_EVENTOS = 0.8; // % de invitados que realmente recogen producto
const MARGEN_CONSUMIBLES_EVENTOS = 0.5; // 50% margen mínimo sobre consumibles
const COSTES_ARTICULO_EVENTOS = { neceser: 1.15, tote: 1.92, camiseta: 4.6 };
function getBeneficioMinimoEvento(invitados) {
  if (invitados <= 50) return 200;
  const tramos = Math.floor((invitados - 50) / 50);
  return 200 + tramos * 50;
}
function precioEventoConArticulo(pack, invitados, articulo) {
  const invitadosReales = Math.round(invitados * OCUPACION_EVENTOS);
  const coste = invitadosReales * COSTES_ARTICULO_EVENTOS[articulo];
  const precioMinPorMargen = Math.ceil(coste / (1 - MARGEN_CONSUMIBLES_EVENTOS));
  const precioMinPorBeneficio = Math.ceil(coste + getBeneficioMinimoEvento(invitados));
  const precioMinMaterial = Math.max(precioMinPorMargen, precioMinPorBeneficio);
  return Math.max(pack.precio, precioMinMaterial);
}

function margenPorTramo(cantidad, tramos) {
  const ordenados = tramosOrdenados(tramos);
  let margen = ordenados[0].margen;
  for (const t of ordenados) {
    if (cantidad >= t.cantidadMin) margen = t.margen;
  }
  return Math.max(margen, MARGEN_MINIMO);
}

// La tabla de tramos por cantidad (antes calculada aquí, en infoTramos) se
// migró a la API centralizada de bendito-os y todavía no expone ese
// desglose — ver el objeto `tramos` fijo en calcularPrecio más abajo.
// TODO: si se quiere volver a mostrar la tabla de tramos al cliente, hay
// que pedirla también a esa API.

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
// P2 (20 Aug 2026): Una sola llamada a /calculate-batch en vez de N llamadas
// en paralelo a /calculate — con 47 artículos, 47 peticiones HTTP a otro
// proyecto de Vercel (cada una con sus propias 1-3 queries a Supabase)
// saturaban las funciones serverless de bendito-os de golpe en cada carga
// del catálogo. Si el lote entero falla (bendito-os caído), se cae a la
// versión artículo-por-artículo como red de seguridad.
//
// Recibe los artículos ya cargados por el listado (necesitan traer `moq`,
// ver CAMPOS_PUBLICOS) en vez de volver a consultar catalogo_articulos por
// los mismos ids — era un viaje de ida y vuelta a Supabase entero (en
// Frankfurt, con las funciones en iad1) solo para releer una columna que
// ya se tenía.
async function calcularPreciosDesde(articulosBase) {
  if (!articulosBase.length) return new Map();

  try {
    const items = articulosBase.map((articulo) => ({
      articulo_id: articulo.id,
      cantidad: articulo.moq || 5,
      canal: 'b2c',
    }));

    try {
      return await calcularPreciosDesdeAPIBatch(items);
    } catch (e) {
      console.warn('[calcularPreciosDesde] Lote falló, cayendo a llamadas individuales:', e.message);
    }

    const resultado = new Map();
    await Promise.all(
      items.map(async (item) => {
        try {
          const precioData = await calcularPrecioDesdeAPI(item.articulo_id, item.cantidad, item.canal);
          resultado.set(item.articulo_id, precioData.precioUnitario);
        } catch (e) {
          console.warn(`[calcularPreciosDesde] Error para artículo ${item.articulo_id}:`, e.message);
          resultado.set(item.articulo_id, null);
        }
      })
    );

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
      const preciosDesde = await calcularPreciosDesde(articulosEnriquecidos);
      const articulos = articulosEnriquecidos.map((a) => {
        const precio = preciosDesde.get(a.id);
        // precio puede ser `null` (fallo al calcular ese artículo, ver
        // calcularPreciosDesde) — sin este chequeo, `Math.round(null * 100)`
        // coacciona `null` a 0 y la tarjeta mostraba "Desde 0.00€" en vez de
        // ocultar el precio como hace renderGridEn cuando es null.
        return { ...a, precio_desde: precio != null ? Math.round(precio * 100) / 100 : null };
      });

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
    if (body && body.accion === 'calcularPrecioEvento') {
      const invitados = Math.max(parseInt(body.invitados, 10) || 0, 0);
      const articulo = Object.prototype.hasOwnProperty.call(COSTES_ARTICULO_EVENTOS, body.articulo) ? body.articulo : null;
      const pack = getPackEvento(invitados);
      const precio = articulo ? precioEventoConArticulo(pack, invitados, articulo) : pack.precio;
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({
        ok: true,
        invitados,
        articulo,
        pack: { nombre: pack.nombre, min: pack.min, max: pack.max },
        precio,
        aviso: 'Precio orientativo según nº de invitados y artículo elegido. El presupuesto final puede variar según extras (horas, diseño, desplazamiento) y detalles del evento.',
      });
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
        if (fichaTecnica) { precioTecnica = precioTecnicaDesdeFicha(fichaTecnica, cantidad, TRAMOS_MARGEN_DEFECTO); tecnicaNombre = fichaTecnica.categoria; }

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
