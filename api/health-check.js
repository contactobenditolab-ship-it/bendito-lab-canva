/**
 * Vercel Cron Job: Health Check
 * Ejecutar: cada 5 minutos vía Vercel's cron (requiere Pro plan)
 * Alternativa: llamar manualmente o con GitHub Actions
 * 
 * Endpoint: GET /api/health-check
 */

const https = require("https");

const ENDPOINTS = [
  { name: "Catálogo", method: "GET", path: "/api/catalogo?limit=5" },
  { name: "Producto", method: "GET", path: "/api/producto?id=sample" },
  { name: "Contacto", method: "POST", path: "/api/contact" },
];

function request(url, options, body = null) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          responseTime: Date.now() - startTime,
          ok: res.statusCode >= 200 && res.statusCode < 400,
        });
      });
    });

    req.on("error", () => {
      reject({
        error: true,
        responseTime: Date.now() - startTime,
      });
    });

    req.setTimeout(5000, () => req.destroy());
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function healthCheck(req, res) {
  // CORS for manual testing
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  // Cron auth
  const cronSecret = req.headers["x-vercel-cron"];
  if (!cronSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const results = [];
  let failed = 0;

  for (const endpoint of ENDPOINTS) {
    try {
      const response = await request(
        `https://www.benditolab.com${endpoint.path}`,
        {
          method: endpoint.method,
          headers: { "Content-Type": "application/json" },
        },
        endpoint.method === "POST" ? { type: "health-check" } : null
      );

      results.push({
        endpoint: endpoint.name,
        status: response.statusCode,
        responseTime: response.responseTime,
        ok: response.ok,
      });

      if (!response.ok) failed++;
    } catch (err) {
      results.push({
        endpoint: endpoint.name,
        error: "Timeout or connection error",
        ok: false,
      });
      failed++;
    }
  }

  const uptime = ((results.length - failed) / results.length * 100).toFixed(2);
  const avgResponseTime = results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length;

  res.status(200).json({
    timestamp: new Date().toISOString(),
    uptime: `${uptime}%`,
    avgResponseTime: `${avgResponseTime.toFixed(0)}ms`,
    endpoints: results,
    status: failed === 0 ? "healthy" : "degraded",
  });
}

module.exports = healthCheck;

// Vercel cron configuration (vercel.json):
// "crons": [
//   {
//     "path": "/api/health-check",
//     "schedule": "*/5 * * * *"
//   }
// ]
