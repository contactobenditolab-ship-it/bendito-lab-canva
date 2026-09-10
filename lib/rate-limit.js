// lib/rate-limit.js — Limitador por IP persistido en Supabase.
//
// Antes: contador en memoria (Map), que se reseteaba en cada cold start y
// no se compartía entre instancias/regiones — no protegía frente a abuso
// distribuido ni ráfagas repartidas entre varias invocaciones serverless.
//
// Ahora: reutiliza la misma tabla `rate_limit_hits` que ya usa Bendito OS
// (src/lib/rate-limit.ts), en el mismo proyecto Supabase. RLS en esa tabla
// no tiene ninguna política para roles autenticados/anónimos — solo el
// service role puede leer/escribir, así que SUPABASE_SERVICE_ROLE_KEY es
// obligatoria aquí (nunca debe exponerse al cliente).
//
// Requiere estas variables de entorno en el proyecto Vercel de este sitio
// (Settings → Environment Variables): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// — mismos valores que ya usa el proyecto bendito-os.
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

async function dentroDelLimite(clave, maxIntentos, ventanaMs) {
  const supabase = client();
  const desde = new Date(Date.now() - ventanaMs).toISOString();

  // Se inserta ANTES de contar (en vez de contar-y-luego-insertar): así el
  // propio intento siempre queda registrado y se cuenta a sí mismo, cerrando
  // la ventana de carrera en la que dos peticiones concurrentes leían el
  // mismo count por debajo del límite antes de que ninguna hubiera insertado
  // todavía. Sigue sin ser una transacción atómica de verdad (dos inserts
  // exactamente simultáneos pueden colarse ambos justo en el límite), pero
  // ya no hay una ventana de lectura-antes-de-escribir que un atacante pueda
  // explotar de forma repetible.
  const { error: insertError } = await supabase.from('rate_limit_hits').insert({ clave });
  if (insertError) {
    // Fail-open: un fallo de Supabase (caída, credenciales mal puestas) no
    // debe tumbar los formularios públicos del sitio; se registra para
    // detectarlo, pero se deja pasar la petición.
    console.error('rate-limit: fallo al insertar en Supabase, se permite la petición:', insertError.message);
    return true;
  }

  const { count, error } = await supabase
    .from('rate_limit_hits')
    .select('*', { count: 'exact', head: true })
    .eq('clave', clave)
    .gte('created_at', desde);

  if (error) {
    console.error('rate-limit: fallo al consultar Supabase, se permite la petición:', error.message);
    return true;
  }

  // Purga oportunista de registros viejos (>24h) para no acumular basura.
  await supabase
    .from('rate_limit_hits')
    .delete()
    .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return (count ?? 0) <= maxIntentos;
}

function ipDesdeRequest(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'desconocida';
}

module.exports = { dentroDelLimite, ipDesdeRequest };
