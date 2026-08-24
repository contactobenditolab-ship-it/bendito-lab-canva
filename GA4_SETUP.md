# 📊 Google Analytics 4 Setup — bendito-lab-canva

## Instalación Rápida

### 1. Obtener ID de Medición GA4

1. Ve a [Google Analytics 4](https://analytics.google.com/)
2. Crea una nueva propiedad: **benditolab.com**
3. Copia el **ID de medición** (formato: `G-XXXXXXXXXX`)

### 2. Configurar en el Sitio

#### Opción A: HTML Inline (Recomendado para sitio estático)

Añade esto al `<head>` de `index.html` (después de `<meta charset>`):

```html
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX', {
    cookie_flags: 'SameSite=None;Secure',
    anonymize_ip: true
  });
</script>

<!-- Bendito Lab Tracking -->
<script src="/js/ga4-config.js"></script>
```

**Reemplaza `G-XXXXXXXXXX` con tu ID real en ambos lugares.**

#### Opción B: Usando ga4-config.js

Si prefieres mantener la configuración en archivo separado:

```html
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>

<!-- Bendito Lab Tracking -->
<script>
  const GA4_ID = "G-XXXXXXXXXX"; // Configura aquí
</script>
<script src="/js/ga4-config.js"></script>
```

### 3. Verificar Instalación

1. Abre DevTools (F12) → Console
2. Debería ver: `[GA4] gtag inicializado correctamente`
3. Visita [Google Analytics Real-Time](https://analytics.google.com/) → verás `Active users now`

---

## Tracking de Conversiones

### En Formularios

#### Cotización
```javascript
// Cuando usuario genera cotización
tracking.cotizacionGenerada(5, 250); // 5 artículos, ~250€
```

#### Contacto
```javascript
// Cuando usuario envía formulario
tracking.contactoEnviado("B2B", "Solicitud de presupuesto");
```

#### Dilo Bonito
```javascript
// Cuando usuario consulta evento
tracking.eventoConsulta("Congreso", 150); // 150 personas
```

### Integración en Canva Pages

En cada página de Canva que tenga formularios, añade:

```html
<!-- Al final del body o en bloque de script personalizado -->
<script>
document.querySelector('[data-form="cotizacion"]')?.addEventListener('submit', function() {
  tracking.cotizacionGenerada(this.dataset.articulos, this.dataset.valor);
});
</script>
```

---

## Eventos Disponibles

| Evento | Uso | Parámetros |
|--------|-----|-----------|
| `product_view` | Usuario ve producto | `product_id`, `product_name`, `value` |
| `cotizacion_generada` | Se genera cotización | `cantidad_articulos`, `valor_estimado` |
| `cotizacion_descargada` | Descarga PDF | `cotizacion_id` |
| `contacto_enviado` | Formulario contacto | `tema`, `asunto` |
| `colaborador_solicitud` | Solicitud de socio | `tipo` (distribuidor, etc) |
| `evento_consulta` | Consulta Dilo Bonito | `tipo_evento`, `numero_personas` |
| `evento_reserva` | Reserva de evento | `tipo_evento`, `numero_dias`, `precio_estimado` |
| `catalogo_filtro` | Usuario filtra catálogo | `filtro`, `valor` |
| `busqueda` | Usuario busca | `termino`, `numero_resultados` |

---

## Dashboard Recomendado

### 1. Crear Segmentos

**Tráfico Orgánico vs Paid:**
```
Source / Medium = google / organic
vs
Source / Medium = google / cpc
```

**Usuarios Convertidos:**
```
cotizacion_generada = true
OR
contacto_enviado = true
```

### 2. Crear Reports

**Conversions by Page:**
- Dimensión: `page_title`
- Métrica: `cotizacion_generada` (count)

**Traffic Funnel:**
```
Landing → Catálogo → Cotización → Contacto
```

---

## Privacidad (GDPR)

✅ Ya configurado en `ga4-config.js`:
- `anonymize_ip: true` — No envía IP completa
- `allow_google_signals: false` — Sin remarketing
- `allow_ad_personalization_signals: false` — Sin perfiles

### Aviso Legal

Añade a `privacy.html`:

> "Utilizamos Google Analytics 4 para entender cómo interactúan los usuarios con nuestro sitio. Los datos se anonimizan y no se utilizan para publicidad personalizada."

---

## Debugging

### Habilitar Debug Mode

```javascript
gtag('config', 'G-XXXXXXXXXX', {
  'debug_mode': true  // Solo en desarrollo
});
```

Luego en DevTools → Network → Busca `collect` requests

### Verificar Eventos

```javascript
// En console
window.dataLayer.slice(-5).forEach(e => console.log(e));
```

---

## Próximos Pasos

1. **Configurar eventos de conversión** en GA4 dashboard
2. **Crear alertas** para cambios en tasa de conversión
3. **Analizar** datos después de 2-4 semanas
4. **Optimizar** páginas basado en data (A/B tests)

---

## Recursos

- [GA4 Documentation](https://support.google.com/analytics)
- [Event reference](https://support.google.com/analytics/answer/9322688)
- [GDPR Compliance](https://support.google.com/analytics/answer/9019185)

---

**Última actualización**: 2026-08-24
**Status**: 🟢 Listo para implementar
