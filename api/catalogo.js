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

// ── Fórmula de precios (copia fiel de src/lib/catalogo/pricing.ts en bendito-os) ──
const MARGEN_MINIMO = 0.45;
// Tabla por defecto, solo si el artículo no tiene grupo de tramos asignado
// (ver catalogo_grupos_tramos / resolverTramos en pricing.ts).
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

// Coste de envío por unidad: override manual del artículo (coste_envio no
// nulo, incluido 0) o, si no hay, el coste de envío típico del proveedor
// repartido entre sus unidades típicas por pedido.
function resolverCosteEnvioUnitario(articulo, proveedor) {
  if (articulo.coste_envio !== null && articulo.coste_envio !== undefined) return articulo.coste_envio;
  if (proveedor && proveedor.unidades_tipicas_pedido > 0) {
    return proveedor.coste_envio / proveedor.unidades_tipicas_pedido;
  }
  return 0;
}

function calcularCosteReal(a, proveedor) {
  const costeEnvio = resolverCosteEnvioUnitario(a, proveedor);
  const subtotalFijo =
    (a.precio_coste || 0) + (a.pack_coste || 0) + costeEnvio +
    (a.coste_manipulacion || 0) + (a.coste_personalizacion || 0) +
    (a.coste_diseno || 0) + (a.coste_mano_obra || 0) + (a.coste_electricidad || 0);
  const pctTotal = (a.coste_mermas_pct || 0) + (a.coste_comisiones_pct || 0) + (a.costes_generales_pct || 0);
  const divisor = 1 - Math.min(pctTotal, 90) / 100;
  return {
    costeReal: subtotalFijo / divisor,
    costeRealSinEnvio: (subtotalFijo - costeEnvio) / divisor,
  };
}

// Réplica de redondearPsicologico() en bendito-os (src/lib/catalogo/pricing.ts)
// — repo separado, sin código compartido, así que hay que portar el fix a
// mano. Precios < 10€: redondea al centavo sin ".95", si no tramos
// contiguos con precios brutos distintos (p.ej. 5.24€ y 5.38€) se veían
// como el mismo precio final (5.95€) — el bug real detectado 19 Aug 2026
// en /producto de Bálsamo Labial: 4 tramos seguidos a 4.95€.
function redondearPsicologico(precio) {
  if (precio <= 0) return 0;
  if (precio < 10) return Math.round(precio * 100) / 100;
  const entero = Math.floor(precio);
  const conDecimal = entero + 0.95;
  return conDecimal >= precio ? conDecimal : entero + 1 + 0.95;
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

// Precio unitario según el override manual de tramos B2C del artículo (si
// existe), buscando el tramo aplicable para la cantidad pedida.
function precioDesdeOverride(overrideTramos, cantidad, costeReal) {
  const ordenados = [...overrideTramos].sort((a, b) => a.cantidadMin - b.cantidadMin);
  let tramo = ordenados[0];
  for (const t of ordenados) {
    if (cantidad >= t.cantidadMin) tramo = t;
  }
  if (tramo.precioUnitario !== null && tramo.precioUnitario !== undefined) return tramo.precioUnitario;
  const margen = Math.min(Math.max(tramo.margenPct || 0, 0), 99) / 100;
  return redondearPsicologico(costeReal / (1 - margen));
}

// Precio unitario del producto en blanco (sin personalizar) para una cantidad dada.
function precioUnitarioProducto(articulo, cantidad, contexto) {
  const { costeReal, costeRealSinEnvio } = calcularCosteReal(articulo, contexto.proveedor);
  if (contexto.overrideB2c && contexto.overrideB2c.length) {
    return precioDesdeOverride(contexto.overrideB2c, cantidad, costeReal);
  }
  if (articulo.margen_pct_b2b !== null && articulo.margen_pct_b2b !== undefined) {
    const margen = Math.min(Math.max(articulo.margen_pct_b2b, 0), 99) / 100;
    return redondearPsicologico(costeRealSinEnvio / (1 - margen));
  }
  const tramos = contexto.tramos || TRAMOS_MARGEN_DEFECTO;
  const margen = margenPorTramo(cantidad, tramos);
  return redondearPsicologico(costeReal / (1 - margen));
}

// Info de tramos por cantidad para mostrar al cliente (nunca el margen en
// sí, solo cantidades y precios ya calculados — ver cabecera del fichero).
// Si el artículo tiene margen_pct_b2b fijo (y no hay override de tramos),
// no hay tramos: precio plano.
function infoTramos(articulo, cantidad, contexto) {
  const tieneOverride = contexto.overrideB2c && contexto.overrideB2c.length;
  if (!tieneOverride && articulo.margen_pct_b2b !== null && articulo.margen_pct_b2b !== undefined) {
    return { tiene_tramos: false, tabla: [] };
  }
  const tramos = tieneOverride
    ? tramosOrdenados(contexto.overrideB2c)
    : tramosOrdenados(contexto.tramos || TRAMOS_MARGEN_DEFECTO);
  const tabla = tramos.map((t) => ({
    cantidad_min: t.cantidadMin,
    precio_unitario: precioUnitarioProducto(articulo, t.cantidadMin, contexto),
  }));
  const precioSinDescuento = tabla[0].precio_unitario;
  const precioActual = precioUnitarioProducto(articulo, cantidad, contexto);
  const tramoActual = [...tramos].reverse().find((t) => cantidad >= t.cantidadMin) || tramos[0];
  // Con tramos configurados a mano (override B2C) el precio por unidad no
  // tiene por qué ser decreciente; si sale mayor que el de partida, esto
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
  'proveedor_id', 'grupo_tramos_id',
];

// "PVP desde" (precio a cantidad=1, tramo base) para cada artículo del
// listado público — permite ordenar por precio sin exponer coste/margen.
// Réplica en lote de la misma lógica que /api/catalogo POST calcularPrecio,
// para no hacer una consulta por artículo.
async function calcularPreciosDesde(supabase, ids) {
  if (!ids.length) return new Map();

  const [{ data: filasCoste, error: eCoste }, { data: overrides, error: eOverride }] = await Promise.all([
    supabase.from('catalogo_articulos').select(CAMPOS_COSTE_LISTADO.join(', ')).in('id', ids),
    supabase.from('catalogo_precios_override').select('articulo_id, tramos').eq('canal', 'b2c').in('articulo_id', ids),
  ]);
  if (eCoste) throw eCoste;
  if (eOverride) throw eOverride;

  const proveedorIds = [...new Set((filasCoste || []).map((a) => a.proveedor_id).filter(Boolean))];
  const grupoIds = [...new Set((filasCoste || []).map((a) => a.grupo_tramos_id).filter(Boolean))];

  const [{ data: proveedores, error: eProv }, { data: grupos, error: eGrupo }] = await Promise.all([
    proveedorIds.length
      ? supabase.from('catalogo_proveedores').select('id, coste_envio, unidades_tipicas_pedido').in('id', proveedorIds)
      : Promise.resolve({ data: [] }),
    grupoIds.length
      ? supabase.from('catalogo_grupos_tramos').select('id, tramos').in('id', grupoIds)
      : Promise.resolve({ data: [] }),
  ]);
  if (eProv) throw eProv;
  if (eGrupo) throw eGrupo;

  const proveedorPorId = new Map((proveedores || []).map((p) => [p.id, p]));
  const gruposPorId = new Map((grupos || []).map((g) => [g.id, g]));
  const overridePorArticulo = new Map((overrides || []).map((o) => [o.articulo_id, o.tramos || []]));

  const resultado = new Map();
  (filasCoste || []).forEach((articulo) => {
    const contexto = {
      proveedor: proveedorPorId.get(articulo.proveedor_id) || null,
      tramos: ((gruposPorId.get(articulo.grupo_tramos_id) || {}).tramos || []).length
        ? gruposPorId.get(articulo.grupo_tramos_id).tramos
        : TRAMOS_MARGEN_DEFECTO,
      overrideB2c: overridePorArticulo.get(articulo.id) || [],
    };
    resultado.set(articulo.id, precioUnitarioProducto(articulo, 1, contexto));
  });
  return resultado;
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

        const CAMPOS_COSTE = [
          'precio_coste', 'pack_coste', 'coste_envio', 'coste_manipulacion',
          'coste_personalizacion', 'coste_diseno', 'coste_mano_obra', 'coste_electricidad',
          'coste_mermas_pct', 'coste_comisiones_pct', 'costes_generales_pct', 'margen_pct_b2b',
          'proveedor_id', 'grupo_tramos_id',
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

        const contexto = {
          proveedor: proveedor || null,
          tramos: (grupo && grupo.tramos && grupo.tramos.length) ? grupo.tramos : TRAMOS_MARGEN_DEFECTO,
          overrideB2c: (overrideRows && overrideRows.tramos) || [],
        };

        const precioProducto = precioUnitarioProducto(articulo, cantidad, contexto);
        const tramos = infoTramos(articulo, cantidad, contexto);

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
