// lib/baja.js — Enlace para darse de baja de los emails de Bendito Lab.
//
// La baja la gestiona Bendito OS (página /newsletter-baja, tabla
// newsletter_bajas): quien se da de baja deja de recibir newsletters. El
// enlace lleva un HMAC del email para que nadie pueda dar de baja a otra
// persona sabiendo solo su dirección. La clave (NEWSLETTER_BAJA_SECRET) es
// la misma en los dos proyectos de Vercel: si cambia en uno, hay que
// cambiarla también en el otro. Mismo cálculo que generarTokenBaja en
// bendito-os/src/lib/newsletter/token-baja.ts.
const { createHmac } = require('crypto');

const BAJA_BASE = 'https://portal.benditolab.com/newsletter-baja';
const BAJA_MAILTO = 'mailto:contacto@benditolab.com?subject=' + encodeURIComponent('Baja de los emails de Bendito Lab');

function tokenBaja(email, secreto) {
  return createHmac('sha256', secreto).update(String(email).trim().toLowerCase()).digest('hex').slice(0, 32);
}

/**
 * URL de baja para ese email. Sin clave configurada (o sin email) devuelve
 * un mailto para pedirla a mano: un enlace que no hace nada es peor.
 */
function urlBaja(email, secreto = process.env.NEWSLETTER_BAJA_SECRET) {
  const limpio = String(email || '').trim().toLowerCase();
  if (!secreto || !limpio) return BAJA_MAILTO;
  return BAJA_BASE + '?e=' + encodeURIComponent(limpio) + '&t=' + tokenBaja(limpio, secreto);
}

/** Pone la URL de baja en los enlaces "Darse de baja" que apuntan a "#". */
function ponerEnlaceBaja(html, url) {
  const seguro = String(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return html.replace(
    /(<a\b[^>]*\bhref=")#("[^>]*>\s*(?:darse|darme|darte) de baja\s*<\/a>)/gi,
    (m, antes, despues) => antes + seguro + despues
  );
}

module.exports = { urlBaja, ponerEnlaceBaja, tokenBaja, BAJA_MAILTO };
