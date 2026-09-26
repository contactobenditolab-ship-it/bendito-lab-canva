// lib/newsletter-html.js — HTML de una newsletter-*.html listo para mandar
// como cuerpo de email: sin <script>, con los cambios del editor visual ya
// aplicados (fotos, textos, colores…, ver aplicar-contenido.js) y con las
// rutas relativas convertidas en absolutas.
//
// Lo usan las confirmaciones automáticas (api/contact.js) y Bendito OS, que
// lo pide por GET /api/content?newsletter=<nombre> para los envíos masivos.
const { leerContenidoSitio } = require('./content-store');
const { aplicarContenido } = require('./aplicar-contenido');

const SITE_BASE = 'https://www.benditolab.com';

// Las páginas newsletter-*.html ya están maquetadas como un email HTML
// completo (tablas, estilos inline, condicionales MSO) — se usan también
// como página pública en el sitio para poder editarlas visualmente desde
// el editor. Se trae el HTML publicado (no el del bundle de la función, que
// no lo incluye).
async function obtenerNewsletterHtml(pathname) {
  const r = await fetch(SITE_BASE + pathname);
  if (!r.ok) throw new Error('No se pudo cargar ' + pathname + ': ' + r.status);
  let html = await r.text();
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  // Los cambios del editor visual (fotos, textos, colores…) los aplica
  // bl-images.js en el navegador, que en un email no se ejecuta: sin esto el
  // cliente recibía las fotos y textos de ejemplo del HTML. Si falla la
  // lectura, se manda igual la versión original antes que no mandar nada.
  try {
    html = aplicarContenido(html, await leerContenidoSitio());
  } catch (e) {
    console.error('No se pudo aplicar el contenido del editor a ' + pathname + ':', e.message);
  }
  html = html.replace(/(src|href)="(?!https?:|mailto:|tel:|#)([^"]+)"/gi, (m, attr, val) => `${attr}="${SITE_BASE}/${val}"`);
  return html;
}

module.exports = { obtenerNewsletterHtml, SITE_BASE };
