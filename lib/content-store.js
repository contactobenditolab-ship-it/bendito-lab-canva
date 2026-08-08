// lib/content-store.js — Mapa slot de imagen -> URL pública en Vercel Blob,
// persistido como un único JSON en el propio Blob store.
const { put, list } = require('@vercel/blob');

const CONTENT_PATH = 'content/site-content.json';

async function findContentBlob() {
  const { blobs } = await list({ prefix: CONTENT_PATH, limit: 1 });
  return blobs && blobs[0] ? blobs[0] : null;
}

async function readContent() {
  const blob = await findContentBlob();
  if (!blob) return { images: {}, updatedAt: null };
  try {
    // El blob es público y se sirve a través de un CDN: aunque `cache:
    // 'no-store'` evita que ESTA función lo sirva desde su propia caché
    // local, no garantiza que el CDN por delante del blob no devuelva una
    // copia todavía no propagada de una escritura reciente. El query param
    // cambia la URL en cada lectura y evita que se sirva una respuesta
    // cacheada por esa URL exacta.
    const res = await fetch(blob.url + '?_r=' + Date.now(), { cache: 'no-store' });
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
  return put(CONTENT_PATH, body, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
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
