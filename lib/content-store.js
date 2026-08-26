// lib/content-store.js — Mapa slot de imagen -> URL pública en Vercel Blob,
// persistido como un único JSON en el propio Blob store.
const { put, list } = require('@vercel/blob');

const CONTENT_PATH = 'content/site-content.json';

// `list()` cuenta como "Advanced Operation" en Vercel Blob (cupo mucho más
// bajo que las operaciones simples: put/get) — llamarlo en cada lectura y
// cada escritura del JSON de contenido, con cada acción del admin, es lo
// que agotó ese cupo (2.1k/2k) y suspendió el store. La URL de este blob es
// determinista (mismo pathname, addRandomSuffix:false), así que solo hace
// falta un list() para descubrirla la primera vez que arranca esta función;
// a partir de ahí se cachea en memoria del proceso y las lecturas/escrituras
// siguientes van directas por fetch()/put(), sin más list().
let cachedBlobUrl = null;

async function findContentBlobUrl() {
  if (cachedBlobUrl) return cachedBlobUrl;
  const { blobs } = await list({ prefix: CONTENT_PATH, limit: 1 });
  const found = blobs && blobs[0] ? blobs[0].url : null;
  if (found) cachedBlobUrl = found;
  return found;
}

async function readContent() {
  const url = await findContentBlobUrl();
  if (!url) return { images: {}, updatedAt: null };
  try {
    // El blob es público y se sirve a través de un CDN: aunque `cache:
    // 'no-store'` evita que ESTA función lo sirva desde su propia caché
    // local, no garantiza que el CDN por delante del blob no devuelva una
    // copia todavía no propagada de una escritura reciente. El query param
    // cambia la URL en cada lectura y evita que se sirva una respuesta
    // cacheada por esa URL exacta.
    const res = await fetch(url + '?_r=' + Date.now(), { cache: 'no-store' });
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
  const result = await put(CONTENT_PATH, body, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  cachedBlobUrl = result.url; // put() ya nos da la URL — no hace falta list() para la próxima lectura
  return result;
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
