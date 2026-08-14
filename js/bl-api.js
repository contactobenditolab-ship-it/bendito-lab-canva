// js/bl-api.js — Cliente compartido para APIs seguras de Bendito Lab
// v2: todos los datos van a /api/db (Supabase). No hay backend de Apps Script.
(function (global) {
  const TOKEN_KEY = 'bl_session_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function authHeaders(extra) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    return headers;
  }

  async function login(password) {
    const r = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const d = await r.json();
    if (d.ok && d.token) setToken(d.token);
    return d.ok === true;
  }

  // ── SUPABASE (datos) ─────────────────────────────────────
  async function dbGet(params) {
    const qs = new URLSearchParams(params || {});
    const r = await fetch('/api/db?' + qs.toString(), { headers: authHeaders() });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d;
  }

  async function dbPost(body) {
    const r = await fetch('/api/db', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d;
  }


  async function enviarContacto(type, data) {
    const r = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data, website: '' }),
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Error al enviar');
    return d;
  }

  global.BL_API = {
    TOKEN_KEY,
    getToken,
    setToken,
    authHeaders,
    login,
    // Supabase
    dbGet,
    dbPost,
    // Comunicaciones
    enviarContacto,
  };
})(window);
