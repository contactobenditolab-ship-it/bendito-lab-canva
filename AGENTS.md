# Flujo de PR y merge

Cuando hagas cambios de código en este repo (bug fixes, features, etc.):

1. Trabaja en una rama, commitea con mensajes descriptivos y haz push.
2. Abre el PR correspondiente.
3. Espera a que el check de Vercel/CI termine.
4. Si pasa en verde, mergea el PR tú mismo (squash) sin esperar confirmación explícita.

Excepciones — para en estas y pide confirmación antes de mergear:
- El build/CI falla.
- El PR es inusualmente grande o mezcla trabajo no relacionado con lo que se pidió (p. ej. arrastra muchos commits históricos sin fusionar).
- El cambio toca datos de producción de forma irreversible o afecta a dinero/facturación de forma que convenga que un humano lo revise primero.
- Cualquier cosa fuera de lo normal que amerite que un humano la vea antes de que sea permanente.

## Higiene de rama tras cada merge (obligatorio)

Este repo usa **squash merge**. Una vez que un PR se mergea, su rama de origen queda con historial "fantasma": commits cuyo contenido ya vive en `main` bajo un hash distinto. Si sigues trabajando sobre esa misma rama sin resetearla, un PR posterior puede volver a aplicar ese contenido ya fusionado, o —como pasó el 2026-08-11— un commit puede quedar "huérfano" en una rama que ya no apunta a ningún PR abierto y nunca llegar a `main`.

**Después de cada merge, antes de seguir trabajando:**

```
git fetch origin main
git checkout -B <tu-rama> origin/main
```

Si tenías commits aún no mergeados en esa rama, tráelos con `git cherry-pick <sha>` sobre la base limpia en vez de reconstruir la rama a mano. Verifica siempre con `git log --oneline main..<tu-rama>` que lo único "por delante" de `main` es trabajo genuinamente nuevo, nunca historial ya fusionado.

## Cambios quirúrgicos

Al tocar código compartido (funciones en `js/*-comun.js`, estilos globales, endpoints en `api/`), cambia solo lo que el encargo pide y evita tocar de paso otras partes del archivo o de sus consumidores. Si una función se usa en varias páginas, comprueba (`grep`/búsqueda de referencias) todos los usos antes de cambiar su firma o su comportamiento.

## Ser económico con los tokens

- No repitas una comprobación de estado (CI, deploy) más de lo necesario. Espacia los reintentos varios minutos, no segundos, y usa el detalle por pasos en vez de re-consultar el estado agregado en bucle cuando algo "parece atascado" — a veces solo va con retraso en la API, no está realmente parado.
- Antes de lanzar una investigación cara (subagentes, muchas llamadas de red), comprueba primero la hipótesis más barata (un `grep`, leer el archivo directamente).
- No relances un subagente para rehacer o releer trabajo que ya se hizo en la misma sesión.
