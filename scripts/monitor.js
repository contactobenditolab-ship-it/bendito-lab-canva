#!/usr/bin/env node

/**
 * Production Monitoring — bendito-lab-canva
 * Verifica salud de endpoints refactorizado en producción
 * Ejecutar: node scripts/monitor.js [--email] [--slack]
 */

const https = require("https");
const http = require("http");

const PRODUCTION_URL = "https://www.benditolab.com";
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

const ENDPOINTS = [
  { name: "Catálogo", method: "GET", path: "/api/catalogo?limit=5", timeout: 5000 },
  { name: "Producto", method: "GET", path: "/api/producto?id=test", timeout: 5000 },
  { name: "Contacto", method: "POST", path: "/api/contact", timeout: 5000, body: { type: "test" } },
];

const THRESHOLDS = {
  responseTime: 2000, // ms
  errorRate: 0.1, // 10%
  uptime: 0.99, // 99%
};

let stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalResponseTime: 0,
  maxResponseTime: 0,
  errors: [],
};

function request(url, options, body = null) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const protocol = url.startsWith("https") ? https : http;

    const req = protocol.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const responseTime = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          responseTime,
          body: data,
        });
      });
    });

    req.on("error", (err) => {
      const responseTime = Date.now() - startTime;
      reject({
        error: err.message,
        responseTime,
      });
    });

    req.setTimeout(options.timeout || 5000, () => {
      req.destroy();
      reject({
        error: "Timeout",
        responseTime: Date.now() - startTime,
      });
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function checkEndpoint(endpoint) {
  const url = `${PRODUCTION_URL}${endpoint.path}`;
  const options = {
    method: endpoint.method,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "bendito-lab-monitor/1.0",
    },
    timeout: endpoint.timeout || 5000,
  };

  try {
    const response = await request(url, options, endpoint.body);
    stats.totalRequests++;
    stats.successfulRequests++;
    stats.totalResponseTime += response.responseTime;
    stats.maxResponseTime = Math.max(stats.maxResponseTime, response.responseTime);

    const status = response.statusCode >= 200 && response.statusCode < 300 ? "✓" : "⚠";
    console.log(
      `${status} ${endpoint.name}: ${response.statusCode} (${response.responseTime}ms)`
    );

    if (response.statusCode >= 400) {
      stats.failedRequests++;
      stats.errors.push({
        endpoint: endpoint.name,
        code: response.statusCode,
        time: new Date().toISOString(),
      });
    }
  } catch (err) {
    stats.totalRequests++;
    stats.failedRequests++;
    stats.errors.push({
      endpoint: endpoint.name,
      error: err.error,
      time: new Date().toISOString(),
    });
    console.log(`✗ ${endpoint.name}: ${err.error}`);
  }
}

async function runHealthCheck() {
  console.log(`\n[${new Date().toISOString()}] Running health check...\n`);

  for (const endpoint of ENDPOINTS) {
    await checkEndpoint(endpoint);
  }

  // Calculate metrics
  const errorRate = stats.totalRequests > 0 ? stats.failedRequests / stats.totalRequests : 0;
  const avgResponseTime = stats.totalRequests > 0 ? stats.totalResponseTime / stats.successfulRequests : 0;
  const uptime = stats.totalRequests > 0 ? stats.successfulRequests / stats.totalRequests : 0;

  console.log("\n─────────────────────────────────────");
  console.log(`Uptime: ${(uptime * 100).toFixed(2)}% (threshold: ${THRESHOLDS.uptime * 100}%)`);
  console.log(`Avg Response Time: ${avgResponseTime.toFixed(0)}ms (threshold: ${THRESHOLDS.responseTime}ms)`);
  console.log(`Error Rate: ${(errorRate * 100).toFixed(2)}% (threshold: ${THRESHOLDS.errorRate * 100}%)`);

  if (stats.errors.length > 0) {
    console.log(`\nRecent Errors (${stats.errors.length}):`);
    stats.errors.slice(-5).forEach((err) => {
      console.log(`  - ${err.endpoint}: ${err.error || `HTTP ${err.code}`} (${err.time})`);
    });
  }

  // Check thresholds
  const alerts = [];
  if (uptime < THRESHOLDS.uptime) {
    alerts.push(`ALERT: Uptime ${(uptime * 100).toFixed(2)}% below threshold ${THRESHOLDS.uptime * 100}%`);
  }
  if (avgResponseTime > THRESHOLDS.responseTime) {
    alerts.push(`ALERT: Avg response time ${avgResponseTime.toFixed(0)}ms exceeds threshold ${THRESHOLDS.responseTime}ms`);
  }
  if (errorRate > THRESHOLDS.errorRate) {
    alerts.push(`ALERT: Error rate ${(errorRate * 100).toFixed(2)}% exceeds threshold ${THRESHOLDS.errorRate * 100}%`);
  }

  if (alerts.length > 0) {
    console.log("\n🚨 ALERTS:");
    alerts.forEach((alert) => console.log(`   ${alert}`));
  } else {
    console.log("\n✅ All systems operational");
  }

  console.log("─────────────────────────────────────\n");
}

// Run on start
runHealthCheck();

// Run periodically
if (process.argv.includes("--daemon")) {
  console.log(`Starting daemon mode (every ${HEALTH_CHECK_INTERVAL / 1000 / 60} minutes)`);
  setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL);
}
