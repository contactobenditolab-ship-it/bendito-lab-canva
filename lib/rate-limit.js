// lib/rate-limit.js — Limitador en memoria por IP para funciones serverless.
// Aviso: se resetea en cada arranque en frío y no se comparte entre regiones,
// así que no es una protección total contra abuso distribuido, pero corta
// ráfagas de un mismo origen (scripts, doble envío, etc.) sin depender de
// una base de datos externa.
const intentos = new Map();

function limpiar(ahora) {
  for (const [clave, lista] of intentos) {
    const vigentes = lista.filter((t) => ahora - t < 15 * 60 * 1000);
    if (vigentes.length) intentos.set(clave, vigentes);
    else intentos.delete(clave);
  }
}

function dentroDelLimite(clave, maxIntentos, ventanaMs) {
  const ahora = Date.now();
  if (intentos.size > 5000) limpiar(ahora);
  const lista = (intentos.get(clave) || []).filter((t) => ahora - t < ventanaMs);
  if (lista.length >= maxIntentos) {
    intentos.set(clave, lista);
    return false;
  }
  lista.push(ahora);
  intentos.set(clave, lista);
  return true;
}

function ipDesdeRequest(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'desconocida';
}

module.exports = { dentroDelLimite, ipDesdeRequest };
