// lib/colores.js — Resuelve nombres de color del catálogo (texto libre tipo
// "AZUL LUZ DE LUNA 45" o "CELESTE/BLANCO 1001") contra la tabla de
// referencia catalogo_colores (carta oficial Roly), para poder pintar un
// cuadrado del color exacto en vez de solo el nombre.
const { createClient } = require('@supabase/supabase-js');

let cachedClient = null;
function client() {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas');
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

// Cache en memoria de la tabla completa: es pequeña (~150 filas) y cambia
// poco, así que se refresca cada 5 minutos en vez de consultarla en cada
// petición.
let mapaCache = null;
let mapaCacheAt = 0;
const MAPA_TTL_MS = 5 * 60 * 1000;

async function cargarMapaColores() {
  const ahora = Date.now();
  if (mapaCache && ahora - mapaCacheAt < MAPA_TTL_MS) return mapaCache;

  const { data, error } = await client().from('catalogo_colores').select('*');
  if (error) throw error;

  const mapa = new Map();
  (data || []).forEach((c) => mapa.set(c.nombre_normalizado, c));
  mapaCache = mapa;
  mapaCacheAt = ahora;
  return mapa;
}

// "AZUL LUZ DE LUNA 45" -> "AZUL LUZ DE LUNA" ; "ÁNGORA (CRUDO) 229" -> "ANGORA"
function normalizarNombreColor(nombre) {
  return String(nombre || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/\([^)]*\)/g, '') // quita paréntesis, p.ej. "(CRUDO)"
    .replace(/\s+\d+\s*$/, '') // quita el código Roly final
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Resuelve un array de nombres de color (tal cual vienen de
 * catalogo_articulos.colores) contra la tabla de referencia. Soporta
 * bicolores separados por "/" (p. ej. "CELESTE/BLANCO 1001"), devolviendo
 * un segmento por cada mitad para pintar un cuadrado partido.
 */
async function resolverColores(nombresColores) {
  const mapa = await cargarMapaColores();
  return (nombresColores || []).map((nombreOriginal) => {
    const partes = String(nombreOriginal).split('/');
    const segmentos = partes.map((parte) => {
      const clave = normalizarNombreColor(parte);
      const ref = mapa.get(clave);
      return {
        hex: ref ? ref.hex : null,
        esEstampado: ref ? ref.es_estampado : false,
      };
    });
    return { nombre: nombreOriginal, segmentos };
  });
}

module.exports = { resolverColores, normalizarNombreColor };
