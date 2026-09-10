# Production Monitoring — bendito-lab-canva

## Cómo funciona

`.github/workflows/health-check.yml` ejecuta `node scripts/monitor.js` cada
15 minutos (GitHub Actions cron) contra `https://www.benditolab.com`. El
script comprueba 4 endpoints públicos clave y, si alguno responde con un
status distinto al esperado o no responde (timeout/error de red), manda un
mensaje a un chat de Telegram y el job de GitHub Actions se marca como
fallido (para que también se vea en la pestaña "Actions" del repo).

| Check | Qué prueba | Status esperado |
|---|---|---|
| Catálogo (`GET /api/catalogo?limit=5`) | Conexión a Supabase, listado público | 200 |
| Contenido público (`GET /api/content`) | Lectura del contenido editado desde /admin | 200 |
| Producto (`GET /api/producto?id=<uuid inexistente>`) | Consulta a Supabase de extremo a extremo (un UUID real que no existe debe dar 404, no 500) | 404 |
| Contacto (`POST /api/contact` con `type` inválido) | La función procesa la petición sin disparar un email real cada vez que corre el monitor | 400 |

No usa medias de uptime/tiempo de respuesta sobre muchas peticiones (la
versión anterior de este documento describía umbrales de 99% de uptime que
no tenían sentido sobre solo 3-4 peticiones por ejecución) — cada ejecución
es un chequeo puntual de "¿responde cada endpoint lo que debería?".

## Configurar las alertas de Telegram (una sola vez)

1. **Crear el bot**: habla con [@BotFather](https://t.me/BotFather) en
   Telegram, manda `/newbot`, sigue las instrucciones y guarda el **token**
   que te da (algo como `123456789:AAF...`).
2. **Obtener el chat_id**:
   - Si quieres recibir los avisos en tu chat personal: mándale cualquier
     mensaje a tu bot recién creado.
   - Si prefieres un grupo: crea un grupo, añade el bot, y manda cualquier
     mensaje en el grupo.
   - Luego visita en el navegador:
     `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
     y busca el campo `"chat":{"id": ...}` en la respuesta — ese número
     (puede ser negativo si es un grupo) es tu `chat_id`.
3. **Añadir los secretos al repo**: en GitHub, ve a
   `Settings → Secrets and variables → Actions → New repository secret` y
   crea:
   - `TELEGRAM_BOT_TOKEN` = el token del paso 1
   - `TELEGRAM_CHAT_ID` = el id del paso 2

Sin estos dos secretos, el workflow sigue comprobando los endpoints y falla
visiblemente en la pestaña Actions si algo va mal, pero no manda ningún
mensaje a Telegram (el script avisa de esto por consola).

## Probarlo

- **Disparar el workflow manualmente**: pestaña "Actions" del repo en
  GitHub → "Health Check" → "Run workflow". Tarda unos segundos; si todo
  está bien no llega ningún mensaje a Telegram (por diseño, para no generar
  ruido cuando todo funciona).
- **Provocar una alerta de prueba**: cambia temporalmente `MONITOR_BASE_URL`
  a una URL que no exista y ejecuta el workflow — deberías recibir el aviso
  en Telegram en segundos.
- **Local**:
  ```bash
  TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... node scripts/monitor.js

  # Modo daemon (repite cada 5 minutos, para dejarlo corriendo en una
  # terminal mientras trabajas):
  TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... node scripts/monitor.js --daemon
  ```

## Troubleshooting

**El workflow falla pero no llega nada a Telegram**: revisa que los dos
secretos estén creados exactamente con esos nombres (`TELEGRAM_BOT_TOKEN`,
`TELEGRAM_CHAT_ID`) en `Settings → Secrets and variables → Actions` del
repo (no en un environment ni en otro repo).

**Falla "Catálogo" o "Contenido público" (esperaban 200)**: revisar
conectividad a Supabase (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` en
Vercel) y los logs de la función en el dashboard de Vercel.

**Falla "Producto" (esperaba 404 y no llegó)**: si devuelve 200, algo raro
pasa con la generación de slugs/UUIDs; si devuelve 500, hay un error real
consultando Supabase — revisar logs de Vercel.

**Falla "Contacto" (esperaba 400 y no llegó)**: si devuelve 500, revisar que
`RESEND_API_KEY` siga configurada y que la función no esté lanzando antes de
validar el `type`.

**El cron de GitHub Actions no se dispara nunca**: GitHub puede retrasar o
saltarse ejecuciones programadas en repos con poca actividad — no es un
fallo del sitio. Dispara el workflow manualmente para confirmar que la
lógica funciona; si tras varias horas sigue sin correr solo, revisa que el
workflow no esté deshabilitado (pestaña Actions → Health Check → "..." →
"Enable workflow").
