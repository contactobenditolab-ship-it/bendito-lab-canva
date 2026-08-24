# FASE 3: Uniformizar API Endpoints (13 endpoints → patrón handleApiRoute)

**Objetivo:** Refactorizar todos los 13 endpoints para usar el patrón genérico `handleApiRoute` de `api/common.js`.

**Estado:** Ejemplo completado en `api/auth-new.js`

---

## Pattern Overview

### Antes (actual)

```javascript
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await dentroDelLimite(...))) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  if (!requireAuth(req, res)) return;
  // ... tu lógica
  try {
    // tu código
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
```

### Después (nuevo patrón)

```javascript
const { handleApiRoute, sendJSON, sendError } = require('./common');

module.exports = handleApiRoute(
  async (req, res, { supabaseClient }) => {
    // Tu lógica aquí — sin validación de método, sin try-catch (ya maneja)
    const data = await supabaseClient.from('tabla').select('*');
    sendJSON(res, data);
  },
  {
    allowedMethods: ['GET', 'POST'],
    requiresAuth: false,
    rateLimit: { maxRequests: 100, windowMs: 60000 },
    logging: true
  }
);
```

**Beneficios:**
- ✅ Error handling centralizado
- ✅ Rate limiting uniforme
- ✅ Logging automático
- ✅ Auth pattern consistente
- ✅ Response JSON estandarizada
- ✅ Reducción de código (~30-40% por endpoint)

---

## Endpoints to Migrate

### 🔴 HIGH PRIORITY (consume muchas líneas, usan muchos clientes)

#### 1. `contact.js` (319L)
**Tipos de request:** 
- POST `/api/contact?type=contacto` → email directo
- POST `/api/contact?type=colaborador` → reenviar a bendito-os
- POST `/api/contact?type=cotizacion` → cálculo

**Refactor:** 
- Extraer lógica de email/colaborador/cotizacion en funciones
- Usar `handleApiRoute` con `allowedMethods: ['POST']`, `requiresAuth: false`
- Rate limiting: 10 requests/hour (por tipo)

```javascript
module.exports = handleApiRoute(
  async (req, res, { supabaseClient }) => {
    const type = req.query.type;
    if (type === 'contacto') {
      await enviarContactoEmail(req.body);
    } else if (type === 'colaborador') {
      await enviarColaboradorAOS(req.body);
    } else {
      return sendError(res, 'Unknown type', 400);
    }
    sendJSON(res, { ok: true });
  },
  {
    allowedMethods: ['POST'],
    requiresAuth: false,
    rateLimit: { maxRequests: 10, windowMs: 3600000 }
  }
);
```

#### 2. `catalogo.js` (494L)
**Tipos de request:**
- GET `/api/catalogo` → lista artículos (con filtros)

**Refactor:**
- Centralizar query builder
- Usar `handleApiRoute` con `allowedMethods: ['GET']`

```javascript
module.exports = handleApiRoute(
  async (req, res, { supabaseClient }) => {
    const { categoria, subcategoria, busqueda } = req.query;
    let query = supabaseClient.from('catalogo_articulos').select('*');
    if (categoria) query = query.eq('categoria', categoria);
    if (subcategoria) query = query.eq('subcategoria', subcategoria);
    if (busqueda) query = query.ilike('nombre', `%${busqueda}%`);
    const { data, error } = await query;
    if (error) throw error;
    sendJSON(res, data);
  },
  {
    allowedMethods: ['GET'],
    requiresAuth: false,
    rateLimit: { maxRequests: 100, windowMs: 60000 }
  }
);
```

#### 3. `producto.js` (485L)
**Tipos de request:**
- GET `/api/producto/:id` → ficha de un producto

**Refactor:**
- Extraer lógica de render a función
- Usar `handleApiRoute` con `allowedMethods: ['GET']`

```javascript
module.exports = handleApiRoute(
  async (req, res, { supabaseClient }) => {
    const { id } = req.query;
    if (!id) return sendError(res, 'Missing id', 400);
    const { data, error } = await supabaseClient
      .from('catalogo_articulos')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    sendJSON(res, data);
  },
  {
    allowedMethods: ['GET'],
    requiresAuth: false
  }
);
```

### 🟡 MEDIUM PRIORITY (10-100L, operaciones de archivo/DB)

#### 4. `upload-image.js` (88L)
#### 5. `save-color.js` (64L)
#### 6. `save-text.js` (36L)
#### 7. `save-image-view.js` (40L)
#### 8. `delete-image.js` (40L)

**Refactor común:**
- Validar auth: `requiresAuth: true`
- Validar tipo MIME/size
- Rate limiting: 50 requests/min

### 🟢 LOW PRIORITY (20-50L, utilities)

#### 9. `auth.js` (42L) — ✅ EJEMPLO HECHO en `auth-new.js`
#### 10. `db.js` (111L)
#### 11. `github-publish.js` (89L)
#### 12. `content.js` (62L)
#### 13. `auth.js` (42L)

---

## Migration Checklist

### Session 1 (DONE)
- [x] Crear `api/common.js` con `handleApiRoute`, `sendJSON`, `sendError`
- [x] Crear ejemplo refactorizado: `api/auth-new.js`
- [x] Documentar plan en PHASE3-API-REFACTOR.md

### Session 2 (Next)
- [ ] Refactorizar contact.js (HIGH, 319L)
- [ ] Refactorizar catalogo.js (HIGH, 494L)
- [ ] Refactorizar producto.js (HIGH, 485L)
- [ ] Verificar en Vercel deployment
- [ ] Commit + push

### Session 3
- [ ] Refactorizar endpoints MEDIUM (upload, save-*, delete)
- [ ] Refactorizar endpoints LOW (db, github-publish, content)
- [ ] Eliminar archivos viejos
- [ ] Actualizar ARCHITECTURE.md con status final

### Session 4
- [ ] E2E testing de endpoints migrados
- [ ] Monitoreo en Sentry
- [ ] Optimizar rate limiting (migrar a Redis si necesario)

---

## Testing Strategy

**Antes de migrar un endpoint:**
1. Crear test curl/Postman para caso base
2. Refactorizar usando `handleApiRoute`
3. Ejecutar test — debe pasar igual
4. Verificar en Vercel staging
5. Merge a main

**Ejemplo (auth.js):**
```bash
# Test antiguo
curl -X POST http://localhost:3000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"password":"H13701aah03"}'

# Resultado esperado en ambos (antes/después):
# { "ok": true, "token": "..." }
```

---

## Expected Results

| Métrica | Antes | Después | Delta |
|---------|-------|---------|-------|
| Líneas de código | ~1,870 | ~1,400 | -530L (-28%) |
| Duplicación (error handling) | 13x | 1x | -12x |
| Complejidad ciclomática | Media | Baja | -40% |
| Mantenibilidad | Difícil | Fácil | ⬆️ |

---

## References

- `api/common.js`: Patrón centralizado
- `api/auth-new.js`: Ejemplo refactorizado
- ARCHITECTURE.md: Overview general
- CLAUDE.md: Context para futuras sesiones
