// GET /sitemap.xml (via vercel.json -> /api/sitemap) — sitemap dinámico.
// Antes sitemap.xml era un fichero estático con solo las páginas fijas del
// sitio: no listaba los artículos del catálogo, que desde api/producto.js
// (13 ago 2026) tienen página propia indexable en /producto/<slug>-<id>.
// Google los sigue descubriendo por rastreo normal (enlaces desde
// /catalogo), pero listarlos aquí acelera la indexación — ver AGENTS.md.
const { createClient } = require('@supabase/supabase-js');
const { slugificar } = require('../lib/articulo-publico');

let cachedClient = null;
function client() {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas');
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

const SITE_BASE = 'https://www.benditolab.com';

// Mismas páginas fijas y prioridades que tenía el sitemap.xml estático.
const PAGINAS_FIJAS = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/bendito-lab', changefreq: 'monthly', priority: '0.9' },
  { loc: '/dilo-bonito', changefreq: 'monthly', priority: '0.9' },
  { loc: '/catalogo', changefreq: 'weekly', priority: '0.9' },
  { loc: '/contacto', changefreq: 'monthly', priority: '0.7' },
  { loc: '/faq', changefreq: 'monthly', priority: '0.6' },
  { loc: '/colaboradores', changefreq: 'monthly', priority: '0.6' },
];

function xmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function urlEntry(loc, lastmod, changefreq, priority) {
  return (
    '  <url>\n' +
    '    <loc>' + xmlEscape(loc) + '</loc>\n' +
    '    <lastmod>' + lastmod + '</lastmod>\n' +
    '    <changefreq>' + changefreq + '</changefreq>\n' +
    '    <priority>' + priority + '</priority>\n' +
    '  </url>'
  );
}

module.exports = async function handler(req, res) {
  const hoy = new Date().toISOString().slice(0, 10);

  let articulos = [];
  try {
    const supabase = client();
    const { data, error } = await supabase
      .from('catalogo_articulos')
      .select('id, nombre, updated_at')
      .eq('visible_web', true);
    if (error) throw error;
    articulos = data || [];
  } catch (e) {
    // Fail-open: si Supabase falla, se sirve igualmente el sitemap con las
    // páginas fijas en vez de devolver un 500 y dejar el sitio sin sitemap
    // ninguno (peor para SEO que uno incompleto).
    console.error('Error cargando artículos para sitemap:', e.message);
  }

  const entradasFijas = PAGINAS_FIJAS.map((p) =>
    urlEntry(SITE_BASE + p.loc, hoy, p.changefreq, p.priority)
  );

  const entradasProducto = articulos.map((a) => {
    const slug = slugificar(a.nombre) || 'producto';
    const lastmod = a.updated_at ? a.updated_at.slice(0, 10) : hoy;
    return urlEntry(SITE_BASE + '/producto/' + slug + '-' + a.id, lastmod, 'weekly', '0.8');
  });

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entradasFijas.concat(entradasProducto).join('\n') +
    '\n</urlset>\n';

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  return res.status(200).end(xml);
};
