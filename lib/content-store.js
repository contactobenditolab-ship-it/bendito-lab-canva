// lib/content-store.js — Mapa slot de imagen -> URL pública, persistido
// como un único JSON en Supabase Storage (bucket sitio-contenido).
//
// Antes se guardaba en Vercel Blob (put()/list()). Se migró porque list()
// cuenta como "Advanced Operation" en Vercel Blob (cupo mucho más bajo que
// las operaciones simples put/get) y llamarlo en cada lectura y cada
// escritura del JSON de contenido, con cada acción del admin, agotó ese
// cupo (2.1k/2k) y suspendió el store — no solo para este JSON, sino para
// TODOS los blobs de la cuenta (también rompió, por ejemplo, las imágenes
// de generador-de-contenido, que comparte cuenta de Vercel). La ruta en
// Storage es determinista (mismo path siempre), así que getPublicUrl() no
// necesita red ni caché propia.
const { supabaseServiceClient } = require('./common');

const BUCKET = 'sitio-contenido';
const CONTENT_PATH = 'site-content.json';

function publicUrl() {
  const { data } = supabaseServiceClient().storage.from(BUCKET).getPublicUrl(CONTENT_PATH);
  return data.publicUrl;
}

async function readContent() {
  try {
    // El objeto es público y se sirve a través de un CDN: el query param
    // cambia la URL en cada lectura y evita que se sirva una respuesta
    // cacheada por esa URL exacta tras una escritura reciente.
    const res = await fetch(publicUrl() + '?_r=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return { images: {}, updatedAt: null };
    const data = await res.json();
    if (!data || typeof data !== 'object') return { images: {}, updatedAt: null };
    data.images = data.images || {};
    return data;
  } catch {
    return { images: {}, updatedAt: null };
  }
}

async function writeContent(data) {
  const body = JSON.stringify(data, null, 2);
  const cuerpo = new Blob([body], { type: 'application/json' });
  const { error } = await supabaseServiceClient().storage.from(BUCKET).upload(CONTENT_PATH, cuerpo, {
    contentType: 'application/json',
    upsert: true,
  });
  if (error) throw new Error('Error guardando el contenido: ' + error.message);
  return { url: publicUrl() };
}

// updateContent(mutate) — lectura-modificación-escritura con reintento
// optimista. Cada endpoint de guardado (texto, color, imagen...) hace su
// propio readContent()/writeContent() sobre el MISMO JSON; si dos guardados
// de campos distintos se solapan, el que escribe último puede pisar por
// completo el trabajo del primero (su lectura no vio todavía la escritura
// ajena). Aquí, tras escribir, se vuelve a leer: si el `updatedAt` leído
// coincide con el que acabamos de escribir, nuestra escritura es la más
// reciente y no hubo pisada. Si no coincide, alguien escribió después (o el
// CDN aún no propagó la nuestra) y se reintenta aplicando la misma mutación
// sobre los datos más frescos. No es una transacción real (no hay
// compare-and-swap atómico en Blob), pero cierra la ventana de carrera en
// la práctica para el caso normal de ediciones sueltas y no simultáneas.
async function updateContent(mutate) {
  const MAX_ATTEMPTS = 4;
  let lastData = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const data = await readContent();
    await mutate(data);
    data.updatedAt = new Date().toISOString() + '-' + Math.random().toString(36).slice(2, 8);
    await writeContent(data);
    lastData = data;
    if (attempt === MAX_ATTEMPTS) break;
    const after = await readContent();
    if (after.updatedAt === data.updatedAt) break; // nuestra escritura es la más reciente
    // Alguien escribió después (o el CDN todavía no propagó la nuestra):
    // reintenta con datos frescos.
  }
  return lastData;
}

module.exports = { readContent, writeContent, updateContent, CONTENT_PATH };
