// POST /api/contact — procesa los leads de los formularios públicos.
// - "contacto": email directo por Resend a contacto@benditolab.com.
// - "colaborador": se reenvía al mismo endpoint público que usa el propio
//   formulario /unete de Bendito OS (portal.benditolab.com), que crea el
//   perfil de colaborador pendiente de activar en el panel y avisa por
//   email a colaboradores@benditolab.com. Así la solicitud queda guardada
//   en su apartado dentro de OS, no solo como un email suelto.
// Público (sin auth): lo llaman formularios de visitantes, no el admin.
const { dentroDelLimite, ipDesdeRequest } = require('../lib/rate-limit');

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
    html: `<h2>Nuevo mensaje de contacto</h2>${filas}`,
  };
  if (esEmailValido(data.email)) {
    emailPayload.reply_to = data.email;
  }

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(emailPayload),
  });
  if (!r.ok) {
    const detalle = await r.text().catch(() => '');
    throw new Error('Resend respondió ' + r.status + ': ' + detalle);
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
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!dentroDelLimite('contact:' + ipDesdeRequest(req), 8, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes, inténtalo más tarde' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const type = body && body.type;
  const data = (body && body.data) || {};
  // Honeypot anti-spam: el campo "website" debe llegar vacío desde un humano.
  if (typeof body?.website === 'string' && body.website.trim()) {
    return res.status(200).json({ ok: true });
  }
  if (type !== 'contacto' && type !== 'colaborador' && type !== 'cotizacion') {
    return res.status(400).json({ error: 'Tipo de formulario desconocido' });
  }
  if (typeof data.nombre !== 'string' || !data.nombre.trim() || typeof data.email !== 'string' || !data.email.trim()) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }
  if (type === 'cotizacion' && (typeof data.telefono !== 'string' || !data.telefono.trim())) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    if (type === 'colaborador') {
      await enviarColaboradorAOS(data);
    } else if (type === 'cotizacion') {
      await enviarCotizacionAOS(data);
    } else {
      await enviarContactoEmail(data);
    }
  } catch (e) {
    console.error('Fallo al procesar el formulario "' + type + '":', e.message);
    return res.status(502).json({ error: 'No se pudo enviar. Escríbenos a contacto@benditolab.com' });
  }

  // Alta del prospecto en el CRM: no bloquea la respuesta al visitante si
  // falla (el email ya se ha enviado, que es lo crítico para él).
  if (type === 'contacto') {
    try {
      await enviarContactoAOS(data);
    } catch (e) {
      console.error('No se pudo crear el prospecto en Bendito OS:', e.message);
    }
  }

  return res.status(200).json({ ok: true });
};
