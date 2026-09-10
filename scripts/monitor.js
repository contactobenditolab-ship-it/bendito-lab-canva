#!/usr/bin/env node

/**
 * Production Monitoring — bendito-lab-canva
 * Comprueba que los endpoints públicos clave responden como se espera y,
 * si alguno falla, avisa por Telegram. Pensado para correr desde el
 * workflow .github/workflows/health-check.yml (cron), pero también sirve
 * en local: node scripts/monitor.js [--daemon]
 *
 * Variables de entorno:
 *   MONITOR_BASE_URL     — opcional, por defecto https://www.benditolab.com
 *   TELEGRAM_BOT_TOKEN   — token del bot (de @BotFather)
 *   TELEGRAM_CHAT_ID     — chat/canal al que avisar
 * Sin las dos de Telegram, el script sigue comprobando y falla el proceso
 * (exit code 1) si algo está mal, pero no manda ningún mensaje.
 */

const https = require('https');

const BASE_URL = process.env.MONITOR_BASE_URL || 'https://www.benditolab.com';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TIMEOUT_MS = 8000;
const DAEMON_INTERVAL_MS = 5 * 60 * 1000;

// Cada check declara qué status HTTP es el esperado — no siempre 200:
// - /api/producto con un UUID que no existe DEBE devolver 404 (eso prueba
//   que la consulta a Supabase funciona de extremo a extremo); tratarlo
//   como fallo (como hacía la versión anterior de este script) generaba
//   una falsa alarma en cada ejecución.
// - /api/contact con un `type` inválido DEBE devolver 400 (prueba que la
//   función procesa la petición sin disparar el envío de un email real
//   cada vez que corre el monitor).
const CHECKS = [
  { name: 'Catálogo', method: 'GET', path: '/api/catalogo?limit=5', expect: [200] },
  { name: 'Contenido público', method: 'GET', path: '/api/content', expect: [200] },
  { name: 'Producto (404 esperado)', method: 'GET', path: '/api/producto?id=00000000-0000-0000-0000-000000000000', expect: [404] },
  { name: 'Contacto (validación, sin enviar email)', method: 'POST', path: '/api/contact', body: { type: 'healthcheck' }, expect: [400] },
];

function request({ method, path, body }) {
  return new Promise((resolve) => {
    const start = Date.now();
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'User-Agent': 'bendito-lab-monitor/2.0' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(BASE_URL + path, { method, headers, timeout: TIMEOUT_MS }, (res) => {
      res.resume(); // descartamos el cuerpo: solo nos interesa el status y el tiempo
      res.on('end', () => resolve({ ok: true, status: res.statusCode, ms: Date.now() - start }));
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Timeout (' + TIMEOUT_MS + 'ms)', ms: Date.now() - start });
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message, ms: Date.now() - start }));
    if (payload) req.write(payload);
    req.end();
  });
}

function sendTelegramAlert(text) {
  return new Promise((resolve) => {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.warn('[monitor] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID no configurados — no se envía alerta.');
      return resolve();
    }
    const payload = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    const req = https.request(
      'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      },
      (res) => {
        res.resume();
        res.on('end', () => {
          if (res.statusCode >= 400) console.error('[monitor] Telegram respondió ' + res.statusCode);
          resolve();
        });
      }
    );
    req.on('error', (err) => {
      console.error('[monitor] Error enviando alerta a Telegram:', err.message);
      resolve();
    });
    req.write(payload);
    req.end();
  });
}

async function runHealthCheck() {
  console.log('\n[' + new Date().toISOString() + '] Comprobando ' + BASE_URL + ' ...\n');

  const results = [];
  for (const check of CHECKS) {
    const r = await request(check);
    const pass = r.ok && check.expect.includes(r.status);
    results.push(Object.assign({}, check, r, { pass }));
    const icon = pass ? '✓' : '✗';
    const detalle = r.ok ? r.status + ' (' + r.ms + 'ms)' : r.error;
    console.log(icon + ' ' + check.name + ': ' + detalle);
  }

  const fallidos = results.filter((r) => !r.pass);

  if (fallidos.length > 0) {
    const lineas = fallidos.map((r) => {
      const detalle = r.ok
        ? 'HTTP ' + r.status + ' (se esperaba ' + r.expect.join('/') + ')'
        : r.error;
      return '• <b>' + r.name + '</b>: ' + detalle;
    });
    const texto =
      '🚨 <b>Bendito Lab — problema detectado</b>\n' +
      BASE_URL +
      '\n\n' +
      lineas.join('\n') +
      '\n\n' +
      new Date().toISOString();
    console.log('\n' + texto.replace(/<\/?b>/g, ''));
    await sendTelegramAlert(texto);
    process.exitCode = 1;
  } else {
    console.log('\n✅ Todo operativo (' + results.length + '/' + results.length + ' checks OK)');
  }
  console.log('─────────────────────────────────────');
}

runHealthCheck();

if (process.argv.includes('--daemon')) {
  console.log('Modo daemon: comprobando cada ' + DAEMON_INTERVAL_MS / 1000 / 60 + ' minutos');
  setInterval(runHealthCheck, DAEMON_INTERVAL_MS);
}
