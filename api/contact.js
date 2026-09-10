// POST /api/contact — procesa los leads de los formularios públicos.
// - "contacto": email directo por Resend a contacto@benditolab.com, más
//   confirmación al visitante enlazando la newsletter de eventos o de
//   empresas según lo que haya marcado en el formulario.
// - "colaborador": se reenvía al mismo endpoint público que usa el propio
//   formulario /unete de Bendito OS (portal.benditolab.com), que crea el
//   perfil de colaborador pendiente de activar en el panel y avisa por
//   email a colaboradores@benditolab.com. Así la solicitud queda guardada
//   en su apartado dentro de OS, no solo como un email suelto. Además se
//   envía una confirmación al colaborador con la newsletter de colaboradores.
// - "upload-logo": sube a Supabase Storage el logo que un cliente adjunta
//   al pedir presupuesto (para mandarle un mockup). Vive aquí, no en su
//   propio archivo /api, porque el plan Hobby de Vercel tiene un límite
//   de 12 Serverless Functions por deployment y ya estaba al límite —
//   ver "Vercel" en CLAUDE.md.
// Público (sin auth): lo llaman formularios de visitantes, no el admin.
const { dentroDelLimite, ipDesdeRequest } = require('../lib/rate-limit');
const { supabaseServiceClient } = require('../lib/common');

const BUCKET_LOGOS = 'sitio-imagenes';

const LOGO_MAX_BYTES = 4 * 1024 * 1024; // 4MB tras decodificar, igual que /api/upload-image
const LOGO_EXT_POR_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

async function subirLogoPresupuesto(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw new Error('Falta dataUrl');
  }
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('dataUrl inválida');
  const mime = match[1];
  const ext = LOGO_EXT_POR_MIME[mime];
  if (!ext) throw new Error('Tipo de imagen no soportado: ' + mime);

  const buf = Buffer.from(match[2], 'base64');
  if (!buf.length) throw new Error('Imagen vacía');
  if (buf.length > LOGO_MAX_BYTES) throw new Error('Imagen demasiado grande (máx 4MB)');

  const storagePath = 'logos-presupuesto/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  const cuerpo = new Blob([new Uint8Array(buf)], { type: mime });
  const supabase = supabaseServiceClient();
  const { error } = await supabase.storage.from(BUCKET_LOGOS).upload(storagePath, cuerpo, { contentType: mime, upsert: false });
  if (error) throw new Error('Error subiendo el logo: ' + error.message);
  const { data } = supabase.storage.from(BUCKET_LOGOS).getPublicUrl(storagePath);
  return data.publicUrl;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const OS_COLABORADOR_URL = 'https://portal.benditolab.com/api/public/colaborador-solicitud';
const OS_COTIZACION_URL = 'https://portal.benditolab.com/api/public/cotizacion';
const OS_CONTACTO_URL = 'https://portal.benditolab.com/api/public/contacto';

const FISICOS = ['Finca', 'Restaurante', 'Hotel', 'Espacio de eventos'];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function esEmailValido(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function valorUtil(v) {
  return v && v !== '-' ? v : '';
}

// Antes la newsletter de colaboradores se excluía aquí a propósito: debía
// enviarse solo desde el formulario dedicado "Únete" (type === 'colaborador',
// ver enviarColaboradorConfirmacion). Pero ese formulario ya no existe en
// colaboradores.html (se perdió en una restauración anterior del archivo,
// ver PR #89 — la página no tiene ningún <form>), así que el único sitio
// real donde un visitante puede marcar "quiero ser colaborador" es el
// select tipo_contacto de este formulario general. Sin esta entrada, esos
// visitantes nunca recibían ninguna newsletter.
const NEWSLETTER_POR_TIPO = {
  eventos: { path: '/newsletter-eventos.html', etiqueta: 'eventos' },
  b2b: { path: '/newsletter-empresas.html', etiqueta: 'empresas' },
  colaboradores: { path: '/newsletter-colaboradores.html', etiqueta: 'colaboradores' },
};

const SITE_BASE = 'https://www.benditolab.com';

// Las páginas newsletter-*.html ya están maquetadas como un email HTML
// completo (tablas, estilos inline, condicionales MSO) — se usan también
// como página pública en el sitio para poder editarlas visualmente desde
// el admin. Para mandarlas como CUERPO del email (no solo enlazadas) se
// trae el HTML publicado y se convierten sus rutas relativas (images/...,
// articulo-*.html, faq.html) en absolutas, y se quitan los <script> (no
// funcionan dentro de un email y los clientes de correo los descartan de
// todas formas).
async function obtenerNewsletterHtml(pathname) {
  const r = await fetch(SITE_BASE + pathname);
  if (!r.ok) throw new Error('No se pudo cargar ' + pathname + ': ' + r.status);
  let html = await r.text();
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/(src|href)="(?!https?:|mailto:|tel:|#)([^"]+)"/gi, (m, attr, val) => `${attr}="${SITE_BASE}/${val}"`);
  return html;
}

async function enviarEmailResend(payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const detalle = await r.text().catch(() => '');
    throw new Error('Resend respondió ' + r.status + ': ' + detalle);
  }
}

async function enviarContactoEmail(data) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY no configurada en el servidor');
  }
  const filas = Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`)
    .join('');

  const emailPayload = {
    from: 'Bendito Lab <no-reply@benditolab.com>',
    to: 'contacto@benditolab.com',
    subject: `Nuevo contacto web: ${data.nombre}`,
    html: `<img src="${SITE_BASE}/icon-web-32.png" alt="" width="24" height="24" style="display:block;margin-bottom:8px;"><h2>Nuevo mensaje de contacto</h2>${filas}`,
  };
  if (esEmailValido(data.email)) {
    emailPayload.reply_to = data.email;
  }

  await enviarEmailResend(emailPayload);

  // Confirmación al visitante: además de avisar que hemos recibido su
  // mensaje, le enlazamos la newsletter que corresponde según haya
  // marcado "eventos" o "b2b" en el formulario. La opción "colaboradores"
  // no enlaza newsletter aquí: esa solo se envía desde el formulario
  // Únete (ver enviarColaboradorConfirmacion).
  if (esEmailValido(data.email)) {
    const newsletter = NEWSLETTER_POR_TIPO[data.tipo_contacto];
    if (newsletter) {
      const asuntoConfirmacion = 'Hemos recibido tu mensaje · Bendito Lab';
      try {
        const html = await obtenerNewsletterHtml(newsletter.path);
        await enviarEmailResend({ from: 'Bendito Lab <no-reply@benditolab.com>', to: data.email, subject: asuntoConfirmacion, html });
      } catch (e) {
        // Si falla la carga de la newsletter (sitio caído, etc.), se manda
        // igualmente un email de confirmación con enlace en vez de dejar al
        // visitante sin ninguna respuesta.
        console.error('No se pudo incrustar la newsletter de ' + newsletter.etiqueta + ', se envía con enlace:', e.message);
        await enviarEmailResend({
          from: 'Bendito Lab <no-reply@benditolab.com>',
          to: data.email,
          subject: asuntoConfirmacion,
          html: `<img src="${SITE_BASE}/icon-web-32.png" alt="" width="24" height="24" style="display:block;margin-bottom:8px;">
<h2>¡Gracias por escribirnos, ${escapeHtml(data.nombre)}!</h2>
<p>Hemos recibido tu consulta y te responderemos en menos de 24 horas.</p>
<p>Mientras tanto, échale un vistazo a nuestra newsletter de ${escapeHtml(newsletter.etiqueta)}:</p>
<p><a href="${SITE_BASE}${newsletter.path}">${SITE_BASE}${newsletter.path}</a></p>`,
        });
      }
    }
  }
}

async function enviarColaboradorConfirmacion(data) {
  if (!RESEND_API_KEY || !esEmailValido(data.email)) return;
  const asuntoConfirmacion = '¡Gracias por querer colaborar con nosotros! · Bendito Lab';
  try {
    const html = await obtenerNewsletterHtml('/newsletter-colaboradores.html');
    await enviarEmailResend({ from: 'Bendito Lab <no-reply@benditolab.com>', to: data.email, subject: asuntoConfirmacion, html });
  } catch (e) {
    console.error('No se pudo incrustar la newsletter de colaboradores, se envía con enlace:', e.message);
    await enviarEmailResend({
      from: 'Bendito Lab <no-reply@benditolab.com>',
      to: data.email,
      subject: asuntoConfirmacion,
      html: `<img src="${SITE_BASE}/icon-web-verde-32.png" alt="" width="24" height="24" style="display:block;margin-bottom:8px;">
<h2>¡Gracias por tu solicitud, ${escapeHtml(data.nombre)}!</h2>
<p>Hemos recibido tu solicitud para unirte al programa de colaboradores de Bendito Lab. Estamos revisando tu perfil y te contactaremos en breve.</p>
<p>Mientras tanto, aquí te contamos cómo funciona la colaboración:</p>
<p><a href="${SITE_BASE}/newsletter-colaboradores.html">${SITE_BASE}/newsletter-colaboradores.html</a></p>`,
    });
  }
}

async function enviarColaboradorAOS(data) {
  const esFisico = FISICOS.includes(data.tipo);
  const notas = (esFisico ? [
    data.aforo && `Aforo: ${data.aforo}`,
    data.zona_stand && `Stand: ${data.zona_stand}`,
    valorUtil(data.medidas) && `Medidas: ${data.medidas}`,
    data.corriente && `Corriente: ${data.corriente}`,
    data.acceso && `Acceso: ${data.acceso}`,
    data.aparcamiento && `Parking: ${data.aparcamiento}`,
  ] : [
    data.eventos_anio && `Eventos/año: ${data.eventos_anio}`,
    data.forma_recomendacion && `Recomendación: ${data.forma_recomendacion}`,
    data.lista_proveedores && `Proveedores: ${data.lista_proveedores}`,
  ]).concat(valorUtil(data.observaciones))
    .filter(Boolean)
    .join(' | ');

  const payload = {
    nombre: data.nombre,
    email: data.email,
    espacio: data.espacio,
    telefono: data.telefono,
    tipo: data.tipo,
    zona: esFisico ? data.direccion : data.zona_trabajo,
    instagram: valorUtil(data.instagram) || undefined,
    web: valorUtil(data.web) || valorUtil(data.portfolio) || undefined,
    notas: notas || undefined,
  };

  const r = await fetch(OS_COLABORADOR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const detalle = await r.text().catch(() => '');
    throw new Error('Bendito OS respondió ' + r.status + ': ' + detalle);
  }
}

async function enviarContactoAOS(data) {
  const payload = {
    nombre: data.nombre,
    email: data.email,
    telefono: valorUtil(data.telefono) || undefined,
    contactoPreferido: valorUtil(data.contacto_preferido) || undefined,
    tipoContacto: valorUtil(data.tipo_contacto) || undefined,
    asunto: valorUtil(data.asunto) || undefined,
    mensaje: valorUtil(data.mensaje) || undefined,
  };

  const r = await fetch(OS_CONTACTO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const detalle = await r.text().catch(() => '');
    throw new Error('Bendito OS respondió ' + r.status + ': ' + detalle);
  }
}

async function enviarCotizacionAOS(data) {
  const payload = {
    nombre: data.nombre,
    telefono: data.telefono,
    email: data.email,
    servicio: valorUtil(data.servicio) || undefined,
    mensaje: valorUtil(data.mensaje) || undefined,
    articulo_id: valorUtil(data.articulo_id) || undefined,
    cantidad: data.cantidad ? Number(data.cantidad) : undefined,
  };

  const r = await fetch(OS_COTIZACION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const detalle = await r.text().catch(() => '');
    throw new Error('Bendito OS respondió ' + r.status + ': ' + detalle);
  }
  // { ok, numero, estimacion } — usado por el catálogo para la pantalla de
  // confirmación (número de referencia + precio estimado).
  return r.json().catch(() => ({}));
}


// Refactorizado con handleApiRoute
// NOTA: se responde con res.json({ok,...}) directo en vez de sendJSON/
// sendError (que envuelven en {success,data}/{success,error}) porque TODOS
// los clientes de este endpoint (contacto-2.js, contact-module.js,
// pages-module.js, index-1.js, catalogo-comun.js/catalogo-module.js para
// upload-logo) leen d.ok/d.error directamente — con sendJSON, d.ok siempre
// era undefined y el formulario mostraba "Error al enviar" incluso cuando
// el email se enviaba correctamente.
const { handleApiRoute } = require('../lib/common');

module.exports = handleApiRoute(
  async (req, res) => {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const type = body && body.type;
    if (!type || !['contacto', 'colaborador', 'cotizacion', 'upload-logo'].includes(type)) {
      return res.status(400).json({ ok: false, error: 'Invalid type' });
    }

    // "upload-logo" no es un lead: responde directo en el formato {ok,url}
    // que ya esperan los clientes (subirLogoPresupuesto en catalogo-comun.js
    // y catalogo-module.js), no el {success,data} de sendJSON.
    if (type === 'upload-logo') {
      try {
        const url = await subirLogoPresupuesto(body.dataUrl);
        return res.status(200).json({ ok: true, url });
      } catch (e) {
        return res.status(400).json({ ok: false, error: e.message });
      }
    }

    // Todos los formularios (contacto-2.js/contact-module.js, catalogo-comun.js
    // /catalogo-module.js) envían los campos del lead anidados en "data",
    // no sueltos en el body — body.type/website van fuera. Antes se pasaba
    // "body" entero a enviarContactoEmail/enviarColaboradorAOS/etc., así que
    // todos los campos (nombre, email, ...) salían undefined: el aviso a
    // contacto@benditolab.com llegaba como "Nuevo contacto web: undefined",
    // el email de confirmación al visitante nunca se enviaba (email inválido)
    // y la sincronización con Bendito OS también recibía datos vacíos.
    const data = body && body.data && typeof body.data === 'object' ? body.data : body;

    let resultadoCotizacion = null;
    try {
      if (type === 'colaborador') {
        await enviarColaboradorAOS(data);
      } else if (type === 'cotizacion') {
        resultadoCotizacion = await enviarCotizacionAOS(data);
      } else {
        await enviarContactoEmail(data);
      }
    } catch (e) {
      console.error('Error processing form:', e.message);
      return res.status(502).json({ ok: false, error: 'Failed to send. Email: contacto@benditolab.com' });
    }

    // Non-blocking: CRM sync
    if (type === 'contacto') {
      try {
        await enviarContactoAOS(data);
      } catch (e) {
        console.error('CRM sync failed:', e.message);
      }
    }

    // Non-blocking: confirmation
    if (type === 'colaborador') {
      try {
        await enviarColaboradorConfirmacion(data);
      } catch (e) {
        console.error('Confirmation email failed:', e.message);
      }
    }

    res.status(200).json({
      ok: true,
      numero: resultadoCotizacion?.numero || undefined,
      estimacion: resultadoCotizacion?.estimacion || undefined
    });
  },
  {
    allowedMethods: ['POST'],
    requiresAuth: false,
    rateLimit: { maxRequests: 8, windowMs: 15 * 60 * 1000 },
    logging: true
  }
);
