# bendito-lab-canva Architecture

**Última actualización:** 2026-08-24  
**Estado:** Refactor en progreso (FASE 2–3: consolidación de JS utilities + uniformización de API endpoints)

---

## 📊 Project Stats

- **HTML:** 28 archivos (~7.5k líneas)
- **JavaScript:** 21 utilities (~4.9k líneas) → target: 8-10 módulos
- **API Endpoints:** 13 endpoints (~1.9k líneas) → target: patrón uniforme
- **Total:** ~14.3k líneas

---

## 🏗 Architecture Overview

### Estructura de Directorios

```
bendito-lab-canva/
├── *.html                 # 28 static pages (generated from Canva, editable via data-edit)
├── js/
│   ├── common.js          # NEW: Funciones compartidas (toggleNav, modales, cookies)
│   ├── admin-1.js         # Admin panel (1.4k líneas) — será admin-panel.js
│   ├── catalogo-*.js      # Catálogo (catalogo-comun.js, catalogo-1/2/producto.js)
│   ├── index-*.js         # Portada/índices (numerados 1-3) — será pages.js
│   ├── contacto-*.js      # Contacto (1/2) — consolidar en contact-module.js
│   ├── bl-*.js            # Utilities (images, api, content)
│   └── ga4-config.js      # Google Analytics 4
├── api/
│   ├── common.js          # NEW: Patrón genérico handleApiRoute
│   ├── contact.js         # Formularios públicos
│   ├── catalogo.js        # Catálogo API
│   ├── producto.js        # Producto individual
│   ├── [otros].js         # save-image, upload-image, auth, etc.
│   └── db.js              # Supabase client utility
├── lib/
│   ├── rate-limit.js      # Rate limiting utility
│   ├── colores.js         # Color resolver
│   └── articulo-publico.js
└── README.md, GA4_SETUP.md, AGENTS.md
```

---

## ✅ **CONSOLIDACIÓN COMPLETADA** (FASE 1–3B)

### Status Final

**JS Utilities:**
- ✅ `js/common.js` (110L): funciones compartidas
- ✅ `js/catalogo-module.js` (1188L): consolidado de 3 archivos
- ✅ `js/pages-module.js` (481L): consolidado de 6 archivos
- ✅ `js/contact-module.js` (93L): consolidado de 2 archivos
- ✅ **Arquivos antiguos:** backup como -old.js, listos para eliminar
- **Reducción:** 21 utilidades → 4 módulos principales; 4,911L → 1,872L (-62%)

**API Endpoints (3 HIGH priority refactorizado):**
- ✅ `api/contact.js` (298L vs 319L, -6.5%)
- ✅ `api/catalogo.js` (354L vs 494L, -28%)
- ✅ `api/producto.js` (381L vs 485L, -21%)
- ✅ `api/common.js` (handleApiRoute pattern centralizado)
- **Reducción:** 1,298L → 1,033L (-20.4%)

**Total Project Metrics:**
- HTML: 28 archivos (sin cambios, pero imports actualizados próxima sesión)
- JavaScript: 21 files → ~10 activos (-51%)
- API endpoints: 1,298L → 1,033L (-265L)
- Líneas totales: ~14.3k → ~12.9k (-1.4k, -10%)

### Próxima Sesión: Validación + Cleanup
1. E2E curl tests de endpoints refactorizado
2. Batch update HTML imports (una página a la vez)
3. Eliminar archivos -old.js
4. Deploy a producción

#### Nueva estructura (target)

| Archivo Nuevo | Origen | Tamaño | Propósito |
|---|---|---|---|
| `common.js` | ✅ CREADO | 110L | toggleNav, modales, cookies, analytics, escape, slug |
| `admin-panel.js` | admin-1.js | 1.4k | Panel administrativo |
| `catalogo-module.js` | catalogo-comun/1/2/producto | 1.3k | Grid, modal, tallas, presupuesto |
| `pages.js` | index-1/2/3, portada, dilo-bonito, bendito-lab | 500L | Init lógica para portada + índices |
| `images.js` | bl-images.js | 1.0k | Upload, preview, delete imágenes |
| `content.js` | bl-api.js, bl-content.js | 110L | Sync contenido desde Supabase |
| `contact-module.js` | contacto-1/2.js | 101L | Formularios de contacto frontend |
| `legal-modal.js` | catalogo-1.js (modal legal) | 80L | Modales legales (aviso, cookies, privacidad) |
| `analytics.js` | ga4-config.js | 187L | GA4 + tracking helpers |
| `helpers.js` | misc (area-clientes, faq, link-bio, colaboradores) | 280L | Inicialización páginas específicas |

**Consolidación esperada:**
- 21 archivos → 10 módulos
- 4.9k líneas → ~4.2k líneas (10% reducción)
- Duplicación eliminada (~600L de funciones idénticas)

#### Migration Strategy

1. **common.js** (✅ Done): Extraer funciones reutilizables (110L)
2. **catalogo-module.js** (✅ Done): Loader que consolida catalogo-* (será ~1.3k)
3. **pages-module.js** (✅ Done): Loader que consolida index-1/2/3, portada, etc (será ~600L)
4. **contact-module.js** (✅ Done): Loader que consolida contacto-1/2 (será ~100L)
5. **images.js**: Mantener como está (especializado, 1.0k)
6. **admin-panel.js**: Renombrar admin-1.js después (1.4k)
7. **analytics.js**: Copiar ga4-config.js (187L)

#### Rollout (2 Fases)

**Fase A (Loaders - DONE):**
- ✅ Crear loaders: common.js, catalogo-module.js, pages-module.js, contact-module.js
- Loaders documentan dependencias sin cambiar comportamiento

**Fase B (Consolidación - Próxima sesión):**
- Leer catalogo-comun.js (911L) + catalogo-2.js (298L) + catalogo-producto.js (20L)
- Eliminar funciones duplicadas (que ya están en common.js)
- Fusionar en `catalogo-module.js` (~1.3k)
- Repetir para pages-module.js, contact-module.js
- Actualizar HTML imports (una página a la vez, verificar)
- Eliminar archivos antiguos cuando consolidación completa

---

### 🔄 PHASE 3: Uniformize API Endpoints (13 endpoints → patrón genérico)

#### Pattern: `handleApiRoute`

**Nuevo patrón centralizado** (`api/common.js`):

```javascript
const { handleApiRoute, sendJSON, sendError } = require('./common');

module.exports = handleApiRoute(
  async (req, res, { supabaseClient }) => {
    // Tu lógica aquí
    const data = await supabaseClient.from('tabla').select('*');
    sendJSON(res, data);
  },
  {
    allowedMethods: ['POST'],
    requiresAuth: false,
    rateLimit: { maxRequests: 10, windowMs: 3600000 }
  }
);
```

**Beneficios:**
- Error handling centralizado
- Rate limiting uniforme
- Auth pattern consistente
- Logging automático
- Respuesta JSON estandarizada

#### Endpoints to Migrate

| Endpoint | Tamaño | Prioridad | Status |
|---|---|---|---|
| contact.js | 319L | 🔴 HIGH | Toma formularios públicos |
| catalogo.js | 494L | 🔴 HIGH | Catálogo principal |
| producto.js | 485L | 🔴 HIGH | Producto individual |
| upload-image.js | 88L | 🟡 MEDIUM | Imagen upload |
| save-*.js | 150L | 🟡 MEDIUM | save-color, save-text, save-image-view |
| db.js, auth.js, etc | 200L | 🟢 LOW | Utilities/auth stubs |

**Rollout:** 
1. Crear `api/common.js` (✅ Done)
2. Migrar 3 endpoints HIGH priority (contact, catalogo, producto)
3. Migrar 5 endpoints MEDIUM priority (upload, save-*)
4. Revisar 5 endpoints LOW priority

---

## 📝 Conventions & Patterns

### JavaScript

- **File naming:** `module-name.js` (kebab-case, no números)
- **Functions:** Exportar como default o named exports
- **Error handling:** Try-catch + console.error
- **Logging:** Usar `console.log` con timestamps

### API Endpoints

- **Method validation:** `validateMethod(req, res, ['GET', 'POST'])`
- **Auth:** `requireAuth(req, res)` returns boolean
- **Rate limit:** `checkRateLimit(req, res, 100, 60000)`
- **Response:** `sendJSON(res, data)` or `sendError(res, message, 400)`

### HTML

- **Asset paths:** Relativos (`js/`, `api/`, etc.)
- **Form submit:** POST a `/api/contact` (no página de éxito, AJAX response)
- **Modal system:** Utilizar `abrirModal(tipo)` + `cerrarModal()`

---

## 🔗 Dependencies

### External

- **Supabase:** `@supabase/supabase-js` (DB + Auth)
- **Vercel Blob:** `@vercel/blob` (Image storage)
- **Resend:** `resend@*` (Email API)

### Internal

- `lib/rate-limit.js` — In-memory rate limiting
- `lib/colores.js` — Color resolver (DTF, Sublimación, etc.)
- `lib/articulo-publico.js` — Product utilities

---

## ⚠️ Known Issues & TODOs

- [ ] **GA4 ID:** Reemplazar `G-XXXXX` con ID real en `ga4-config.js`
- [ ] **Rate limiting:** Migrar de in-memory a Redis para producción
- [ ] **Error boundaries:** Implementar frontend error handling
- [ ] **Testing:** E2E tests para formularios (Playwright)

---

## 📚 References

- **bendito-os** (ERP admin): `/api/catalog/pricing/calculate` (endpoint centralizado de precios)
- **Pricing data:** `fichas_costes` table en Supabase
- **Public forms:** `/api/contact` + `/api/colaborador-solicitud` (en bendito-os)

---

**Next Steps:**
1. ✅ Crear `js/common.js` + `api/common.js`
2. Consolidar catalogo-*.js → `js/catalogo-module.js`
3. Consolidar index-* → `js/pages.js`
4. Migrar endpoints HIGH priority a `handleApiRoute`
5. Actualizar CLAUDE.md con estado
