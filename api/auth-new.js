// POST /api/auth — login del panel admin (refactorizado con handleApiRoute)
// Body: { password }
// Response: { ok: true, token } o error

const crypto = require('crypto');
const { issueToken } = require('../lib/auth');
const { handleApiRoute, sendError } = require('./common');

module.exports = handleApiRoute(
  async (req, res) => {
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    if (!ADMIN_PASSWORD) {
      return sendError(res, 'ADMIN_PASSWORD not configured on server', 500);
    }

    // Parse body
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    // Validar password
    const password = body && body.password;
    if (typeof password !== 'string' || !password) {
      return sendError(res, 'Missing password', 400);
    }

    // Comparación segura (timing-safe)
    const a = Buffer.from(password);
    const b = Buffer.from(ADMIN_PASSWORD);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) {
      return res.status(401).json({ ok: false, error: 'Invalid password' });
    }

    // Emitir token
    try {
      const token = issueToken();
      return res.status(200).json({ ok: true, token });
    } catch (e) {
      return sendError(res, e.message, 500);
    }
  },
  {
    allowedMethods: ['POST'],
    requiresAuth: false,
    rateLimit: { maxRequests: 10, windowMs: 15 * 60 * 1000 }, // 10 intentos cada 15 min
    logging: true
  }
);
