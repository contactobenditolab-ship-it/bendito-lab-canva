// POST /api/contact — envía por email (Resend) los leads del formulario de
// contacto y del formulario de colaboradores. Antes reenviaba a un webhook
// de Make.com que ya no está conectado; ahora se envía directamente.
// Público (sin auth): lo llaman formularios de visitantes, no el admin.
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const DESTINO_POR_FORM = {
  contacto: {
    to: 'contacto@benditolab.com',
    asunto: (data) => `Nuevo contacto web: ${data.nombre}`,
    titulo: 'Nuevo mensaje de contacto',
  },
  colaborador: {
    to: 'colaboradores@benditolab.com',
    asunto: (data) => `Nueva solicitud de colaboración: ${data.nombre}`,
    titulo: 'Nueva solicitud de colaborador',
  },
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function esEmailValido(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY no configurada en el servidor' });
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
  const destino = DESTINO_POR_FORM[type];
  if (!destino) {
    return res.status(400).json({ error: 'Tipo de formulario desconocido' });
  }
  if (typeof data.nombre !== 'string' || !data.nombre.trim() || typeof data.email !== 'string' || !data.email.trim()) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const filas = Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`)
    .join('');

  const emailPayload = {
    from: 'Bendito Lab <no-reply@benditolab.com>',
    to: destino.to,
    subject: destino.asunto(data),
    html: `<h2>${destino.titulo}</h2>${filas}`,
  };
  if (esEmailValido(data.email)) {
    emailPayload.reply_to = data.email;
  }

  try {
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
      console.error('Resend error', r.status, detalle);
      throw new Error('Resend respondió ' + r.status + ': ' + detalle);
    }
  } catch (e) {
    console.error('Fallo al enviar email vía Resend:', e.message);
    return res.status(502).json({ error: 'No se pudo enviar. Escríbenos a contacto@benditolab.com' });
  }

  return res.status(200).json({ ok: true });
};
