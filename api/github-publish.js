// POST /api/github-publish (auth) — proxy servidor para publicar cambios del
// panel de admin en el repositorio de GitHub. Antes el panel llamaba a la API
// de GitHub directamente desde el navegador con un Personal Access Token
// pegado por el admin y guardado en sessionStorage — cualquier XSS, extensión
// maliciosa o sesión compartida podía robar un token con permiso de escritura
// sobre el código fuente. Ahora el token vive solo en el servidor
// (GITHUB_TOKEN) y el navegador solo puede pedir "leer" o "escribir" un
// archivo dentro de la lista blanca de abajo.
const { requireAuth } = require('../lib/auth');

const REPO = 'contactobenditolab-ship-it/bendito-lab-canva';

// Rutas que el panel de admin tiene permitido leer/escribir. Cualquier otra
// ruta del repo (código de la app, workflows de CI, etc.) queda fuera de
// alcance de este endpoint aunque el admin esté autenticado.
const ALLOWED_FILES = new Set([
  'dilo-bonito.html',
  'index.html',
  'portada.html',
  'bendito-lab.html',
  'colaboradores.html',
  'unete.html',
]);

function pathPermitido(path) {
  if (typeof path !== 'string' || !path) return false;
  if (ALLOWED_FILES.has(path)) return true;
  // Imágenes de banners subidas desde el editor: images/banner-<timestamp>.<ext>
  return /^images\/banner-\d+\.[a-z0-9]{2,5}$/i.test(path);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireAuth(req, res)) return;

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'GITHUB_TOKEN no configurado en el servidor' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { op, path } = body || {};
  if (!pathPermitido(path)) {
    return res.status(400).json({ error: 'Ruta no permitida' });
  }

  const ghHeaders = {
    Authorization: 'token ' + token,
    'User-Agent': 'BenditoAdmin',
  };

  try {
    if (op === 'get') {
      const r = await fetch('https://api.github.com/repos/' + REPO + '/contents/' + path, { headers: ghHeaders });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data.message || 'Error leyendo de GitHub' });
      return res.status(200).json({ content: data.content, sha: data.sha });
    }

    if (op === 'put') {
      const { content, message, sha } = body;
      if (typeof content !== 'string' || !content) {
        return res.status(400).json({ error: 'Falta content' });
      }
      const put = await fetch('https://api.github.com/repos/' + REPO + '/contents/' + path, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders),
        body: JSON.stringify({
          message: typeof message === 'string' && message ? message : 'Admin: actualizar ' + path,
          content,
          sha: typeof sha === 'string' ? sha : undefined,
        }),
      });
      const data = await put.json();
      if (!put.ok) return res.status(put.status).json({ error: data.message || 'Error escribiendo en GitHub' });
      return res.status(200).json({ ok: true, sha: data.content && data.content.sha });
    }

    return res.status(400).json({ error: 'op debe ser "get" o "put"' });
  } catch (err) {
    return res.status(502).json({ error: 'No se pudo contactar con GitHub: ' + err.message });
  }
};
