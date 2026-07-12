// POST /api/contact — reenvía leads del formulario de contacto y del
// formulario de colaboradores al mismo webhook de Make.com que ya usa
// index.html para el formulario de cotización de la portada, así entran en
// el mismo automatismo/CRM que el equipo ya usa (no es un canal nuevo).
// Público (sin auth): lo llaman formularios de visitantes, no el admin.
const MAKE_WEBHOOK = 'https://hook.eu1.make.com/mq9p9vhujumqorqyoy72fgce79jhp2op';

const TIPO_POR_FORM = {
  contacto: 'contacto_web',
  colaborador: 'colaborador_solicitud',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
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
  const tipoFormulario = TIPO_POR_FORM[type];
  if (!tipoFormulario) {
    return res.status(400).json({ error: 'Tipo de formulario desconocido' });
  }
  if (typeof data.nombre !== 'string' || !data.nombre.trim() || typeof data.email !== 'string' || !data.email.trim()) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    const r = await fetch(MAKE_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo_formulario: tipoFormulario, ...data }),
    });
    if (!r.ok) throw new Error('Webhook respondió ' + r.status);
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo enviar. Escríbenos a contacto@benditolab.com' });
  }

  return res.status(200).json({ ok: true });
};
