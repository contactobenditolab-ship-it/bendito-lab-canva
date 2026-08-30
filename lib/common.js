// api/common.js — Patrón genérico para todos los endpoints
// Centraliza: validación de método, auth, error handling, logging

const { createClient } = require('@supabase/supabase-js');

/** Supabase client (cached) */
let cachedClient;
function supabaseClient() {
  if (cachedClient) return cachedClient;
  cachedClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  return cachedClient;
}

/**
 * Cliente Supabase con service role key (salta RLS) — para las rutas del
 * admin que leen/escriben Storage directamente (content-store.js,
 * upload-image.js, delete-image.js, subida de logo en contact.js). Mismo
 * proyecto Supabase que ya usa api/db.js.
 */
let cachedServiceClient;
function supabaseServiceClient() {
  if (cachedServiceClient) return cachedServiceClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas');
  cachedServiceClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedServiceClient;
}

/**
 * Borra un objeto de Supabase Storage a partir de su URL pública (la que
 * devuelve getPublicUrl()), extrayendo el path relativo al bucket. No falla
 * si la URL no pertenece a ese bucket — simplemente no hace nada.
 */
async function supabaseStorageDeleteByUrl(bucket, url) {
  const marcador = '/' + bucket + '/';
  const idx = url.indexOf(marcador);
  if (idx === -1) return;
  const storagePath = url.slice(idx + marcador.length);
  await supabaseServiceClient().storage.from(bucket).remove([storagePath]);
}

/** Validar método HTTP */
function validateMethod(req, res, allowedMethods = ['GET', 'POST', 'PUT', 'DELETE']) {
  if (!allowedMethods.includes(req.method)) {
    return res.status(405).json({
      error: 'Method not allowed',
      allowed: allowedMethods
    });
  }
  return null;
}

/** Validar autenticación (token en header Authorization) */
function requireAuth(req, res) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  const expectedToken = process.env.ADMIN_TOKEN || process.env.BENDITO_API_SECRET;
  if (!token || token !== expectedToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

/** Rate limiting simple (en memoria; para producción usar Redis) */
const rateLimitStore = {}; // { ip: { count, resetAt } }

function checkRateLimit(req, res, maxRequests = 100, windowMs = 60000) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  
  if (!rateLimitStore[ip]) {
    rateLimitStore[ip] = { count: 0, resetAt: now + windowMs };
  }
  
  if (now > rateLimitStore[ip].resetAt) {
    rateLimitStore[ip] = { count: 0, resetAt: now + windowMs };
  }
  
  rateLimitStore[ip].count++;
  
  if (rateLimitStore[ip].count > maxRequests) {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((rateLimitStore[ip].resetAt - now) / 1000)
    });
    return false;
  }
  
  return true;
}

/** Wrapper genérico para endpoints */
function handleApiRoute(
  handler,
  {
    allowedMethods = ['GET', 'POST'],
    requiresAuth = false,
    rateLimit = null, // { maxRequests, windowMs }
    logging = true
  } = {}
) {
  return async (req, res) => {
    try {
      // Validar método
      const methodError = validateMethod(req, res, allowedMethods);
      if (methodError) return methodError;
      
      // Rate limiting
      if (rateLimit && !checkRateLimit(req, res, rateLimit.maxRequests, rateLimit.windowMs)) {
        return;
      }
      
      // Autenticación
      if (requiresAuth && !requireAuth(req, res)) {
        return;
      }
      
      // Log incoming request
      if (logging) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`, {
          ip: req.headers['x-forwarded-for'] || 'unknown',
          userAgent: req.headers['user-agent']?.substring(0, 50)
        });
      }
      
      // Ejecutar handler
      await handler(req, res, { supabaseClient });
      
    } catch (err) {
      console.error('API Error:', {
        endpoint: req.url,
        method: req.method,
        message: err.message,
        stack: err.stack
      });
      
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
      });
    }
  };
}

/** Formato de respuesta exitosa (JSON) */
function sendJSON(res, data, statusCode = 200) {
  res.status(statusCode).json({
    success: true,
    data
  });
}

/** Formato de respuesta con error */
function sendError(res, message, statusCode = 400, details = {}) {
  res.status(statusCode).json({
    success: false,
    error: message,
    ...details
  });
}

module.exports = {
  supabaseClient,
  supabaseServiceClient,
  supabaseStorageDeleteByUrl,
  validateMethod,
  requireAuth,
  checkRateLimit,
  handleApiRoute,
  sendJSON,
  sendError
};
