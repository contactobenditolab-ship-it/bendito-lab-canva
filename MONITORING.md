# Production Monitoring — bendito-lab-canva

## Overview

Después del refactor de endpoints (FASE 2B–3B), se incluyen herramientas de monitoring para verificar que los endpoints refactorizado siguen funcionando correctamente en producción.

## Health Check Local

```bash
# One-time check
node scripts/monitor.js

# Continuous daemon (every 5 minutes)
node scripts/monitor.js --daemon
```

### Output Esperado

```
✓ Catálogo: 200 (145ms)
✓ Producto: 200 (128ms)
✓ Contacto: 200 (234ms)

─────────────────────────────────────
Uptime: 100.00% (threshold: 99%)
Avg Response Time: 169ms (threshold: 2000ms)
Error Rate: 0% (threshold: 10%)

✅ All systems operational
─────────────────────────────────────
```

## Vercel Cron Job (Automático)

Endpoint: `GET /api/health-check`

**Configuración recomendada (vercel.json):**
```json
{
  "crons": [
    {
      "path": "/api/health-check",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Requiere: **Vercel Pro plan**

**Response format:**
```json
{
  "timestamp": "2026-08-24T15:30:00Z",
  "uptime": "100%",
  "avgResponseTime": "169ms",
  "status": "healthy",
  "endpoints": [
    {
      "endpoint": "Catálogo",
      "status": 200,
      "responseTime": 145,
      "ok": true
    }
  ]
}
```

## Thresholds

| Métrica | Threshold | Alerta |
|---------|-----------|--------|
| **Uptime** | 99% | < 99% ⚠️ |
| **Response Time** | 2000ms | > 2000ms ⚠️ |
| **Error Rate** | 10% | > 10% ⚠️ |

## Endpoints Monitoreados

1. **GET /api/catalogo** (lista de artículos)
   - Verifica: Supabase connectivity, query performance
   - Timeout: 5s

2. **GET /api/producto** (artículo individual)
   - Verifica: Product lookup, single record fetch
   - Timeout: 5s

3. **POST /api/contact** (formulario de contacto)
   - Verifica: Request parsing, validation, error handling
   - Timeout: 5s

## GitHub Actions (Alternativa a Vercel Cron)

Si no tienes Vercel Pro, crear workflow en `.github/workflows/health-check.yml`:

```yaml
name: Health Check

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: node scripts/monitor.js
```

## Monitoreo Manual

Ejecutar health check manualmente en cualquier momento:

```bash
# Local
node scripts/monitor.js

# Remote (vía curl)
curl https://www.benditolab.com/api/health-check \
  -H "x-vercel-cron: $(date +%s)"
```

## Alerts & Escalation

Si se detecta un problema:

1. **Log**: Error registrado en `scripts/monitor.js` output
2. **Slack/Email**: Integración recomendada (TODO)
3. **Fallback**: Monitoreo manual vía curl + GitHub Actions

## Performance Baseline

Métricas esperadas después del refactor:

| Endpoint | Response Time | Success Rate |
|----------|---------------|--------------|
| Catálogo | 100–200ms | 99.9% |
| Producto | 80–150ms | 99.9% |
| Contacto | 150–300ms | 99% |

## Troubleshooting

**Timeout:**
- Verificar conectividad a Supabase
- Revisar logs en Vercel

**High Error Rate:**
- Verificar API rate limiting
- Revisar cambios recientes en endpoints

**Slow Response:**
- Verificar índices de BD en Supabase
- Revisar carga de Vercel
