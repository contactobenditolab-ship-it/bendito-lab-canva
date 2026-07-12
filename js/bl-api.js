// js/bl-api.js — Cliente compartido para APIs seguras de Bendito Lab
// v2: datos → /api/db (Supabase), Drive y web → /api/proxy (Apps Script)
(function (global) {
  const TOKEN_KEY = 'bl_session_token';

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
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

  // ── APPS SCRIPT (Drive, web content, carpetas, archivos) ─
  async function gsGet(scope, params) {
    const qs = new URLSearchParams(Object.assign({ scope: scope || 'app' }, params || {}));
    const r = await fetch('/api/proxy?' + qs.toString(), { headers: authHeaders() });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d;
  }

  async function gsPost(scope, body) {
    const r = await fetch('/api/proxy?scope=' + encodeURIComponent(scope || 'app'), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d;
  }

  // ── Helpers de datos (ahora → Supabase) ─────────────────
  // Tablas de datos puros
  const TABLAS_DB = new Set([
    'presupuestos','colaboradores','recordatorios',
    'gastos','articulos','catalogoCompras','produccion'
  ]);

  // Acciones que se quedan en Apps Script (Drive)
  const ACCIONES_GS = new Set([
    'crearCarpeta','subirArchivo','listarArchivos','subirFacturaGasto',
    'guardarContenidoWeb'
  ]);

  async function gsGetTabla(tabla) {
    if (TABLAS_DB.has(tabla)) {
      const d = await dbGet({ tabla });
      return d.data || [];
    }
    const d = await gsGet('app', { tabla });
    return d.data || [];
  }

  async function gsGuardar(tabla, datos) {
    if (TABLAS_DB.has(tabla)) {
      return dbPost({ accion: 'guardar', tabla, datos });
    }
    return gsPost('app', { accion: 'guardar', tabla, datos });
  }

  async function gsEliminar(tabla, id) {
    if (TABLAS_DB.has(tabla)) {
      return dbPost({ accion: 'eliminar', tabla, datos: { id } });
    }
    return gsPost('app', { accion: 'eliminar', tabla, datos: { id } });
  }

  // Router inteligente para gsPost — redirige según accion
  async function gsPostRouter(scope, body) {
    const accion = body && body.accion;

    // Drive y web siempre van a Apps Script
    if (ACCIONES_GS.has(accion)) {
      return gsPost(scope, body);
    }

    // Datos van a Supabase
    if (accion === 'guardar' && body.tabla && TABLAS_DB.has(body.tabla)) {
      return dbPost(body);
    }
    if (accion === 'eliminar' && body.tabla && TABLAS_DB.has(body.tabla)) {
      return dbPost(body);
    }
    if (accion === 'guardarArticulos') return dbPost(body);
    if (accion === 'guardarProduccion') return dbPost(body);
    if (accion === 'guardarPedidoProd') return dbPost(body);
    if (accion === 'guardarSuscripcionPush') return dbPost(body);
    if (accion === 'eliminarSuscripcionPush') return dbPost(body);
    if (accion === 'listarSuscripciones') return dbPost(body);

    // Fallback: Apps Script
    return gsPost(scope, body);
  }

  async function gsWeb(params) {
    return gsGet('web', params);
  }

  async function gsProd(params) {
    return gsGet('prod', params);
  }

  async function enviarEmail(to, subject, html, from) {
    const body = { to, subject, html };
    if (from) body.from = from;
    const r = await fetch('/api/send-email', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Error al enviar');
    return d;
  }

  async function enviarPush(subscriptions, payload) {
    const r = await fetch('/api/send-push', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ subscriptions, payload }),
    });
    return r.json();
  }

  async function notificarTelegram(message) {
    try {
      await fetch('/api/telegram-notify', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ message }),
      });
    } catch (e) {
      console.warn('Telegram no disponible:', e.message);
    }
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

  async function guardarColaboradorWeb(datos) {
    const r = await fetch('/api/public-gs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'guardar', tabla: 'colaboradores', datos }),
    });
    const d = await r.json();
    if (!d.ok && d.error) throw new Error(d.error);
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
    // Apps Script (Drive, web)
    gsGet,
    gsPost: gsPostRouter,   // ← router inteligente, misma firma que antes
    // Helpers (ahora enrutan solos)
    gsGetTabla,
    gsGuardar,
    gsEliminar,
    gsWeb,
    gsProd,
    // Comunicaciones
    enviarEmail,
    enviarPush,
    notificarTelegram,
    enviarContacto,
    guardarColaboradorWeb,
  };
})(window);

// ── GOOGLE CALENDAR ──────────────────────────────────────
// Añadido después del bloque principal para no romper el IIFE
(function() {
  // Obtener eventos de Google Calendar de un mes
  async function getCalendarEvents(mes) {
    const qs = mes ? '?mes=' + mes : '';
    const r = await fetch('/api/calendar' + qs, { headers: BL_API.authHeaders() });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d.data || [];
  }

  // Crear evento en Google Calendar
  async function createCalendarEvent(evento) {
    const r = await fetch('/api/calendar', {
      method: 'POST',
      headers: BL_API.authHeaders(),
      body: JSON.stringify({ accion: 'crear', evento }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d; // { ok, gcalId, htmlLink }
  }

  // Actualizar evento en Google Calendar
  async function updateCalendarEvent(gcalId, evento) {
    const r = await fetch('/api/calendar', {
      method: 'POST',
      headers: BL_API.authHeaders(),
      body: JSON.stringify({ accion: 'actualizar', gcalId, evento }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d;
  }

  // Eliminar evento en Google Calendar
  async function deleteCalendarEvent(gcalId) {
    const r = await fetch('/api/calendar', {
      method: 'POST',
      headers: BL_API.authHeaders(),
      body: JSON.stringify({ accion: 'eliminar', gcalId }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d;
  }

  // Crear evento desde un presupuesto
  async function syncPresupuestoToCalendar(p) {
    if (!p.fecha) return null;
    const evento = {
      id:        p.id,
      titulo:    p.cliente + (p.empresa ? ' · ' + p.empresa : ''),
      cliente:   p.cliente,
      empresa:   p.empresa || '',
      tipo:      p.tipocliente === 'evento' ? 'evento' : 'presupuesto',
      fecha:     p.fecha,
      invitados: p.invitados || '',
      importe:   p.importe || '',
      pack:      p.pack || '',
      notas:     p.notas || '',
    };
    // Si ya tiene gcalId en el presupuesto, actualizar; si no, crear
    if (p.gcalId) {
      return await updateCalendarEvent(p.gcalId, evento);
    } else {
      return await createCalendarEvent(evento);
    }
  }

  // Crear evento desde un recordatorio
  async function syncRecordatorioToCalendar(nota) {
    if (!nota.fecha) return null;
    const evento = {
      id:        'rec-' + nota.id,
      titulo:    nota.nota || nota.texto || 'Recordatorio',
      tipo:      'recordatorio',
      fecha:     nota.fecha,
      descripcion: nota.nota || nota.texto || '',
    };
    if (nota.gcalId) {
      return await updateCalendarEvent(nota.gcalId, evento);
    } else {
      return await createCalendarEvent(evento);
    }
  }

  // Exponer en BL_API
  Object.assign(window.BL_API, {
    getCalendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    syncPresupuestoToCalendar,
    syncRecordatorioToCalendar,
  });
})();
