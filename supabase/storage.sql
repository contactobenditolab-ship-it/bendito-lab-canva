-- Ejecuta esto en Supabase → SQL Editor (mismo proyecto que ya usan
-- bendito-os y generador-de-contenido — SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
-- ya configuradas en Vercel para este proyecto vía api/db.js).
--
-- Crea los dos buckets de Storage que sustituyen a Vercel Blob:
-- - sitio-imagenes: fotos de sustitución del sitio (api/upload-image.js) y
--   logos que un cliente adjunta al pedir presupuesto (api/contact.js,
--   type "upload-logo").
-- - sitio-contenido: el JSON con el mapa slot de imagen -> URL pública
--   (lib/content-store.js), antes un único blob de Vercel.
--
-- Se migró desde Vercel Blob porque el store de esa cuenta se quedó
-- suspendido (cupo de "Advanced Operations" agotado por las llamadas a
-- list() que hacía content-store.js en cada lectura/escritura) y empezó a
-- devolver 403 tanto en lecturas como en escrituras nuevas — para todos los
-- blobs de la cuenta, no solo los de este proyecto (también rompió las
-- imágenes de generador-de-contenido, que comparte cuenta de Vercel).
--
-- Todo el acceso de escritura pasa por las rutas /api (service role key,
-- que siempre salta RLS), así que no hacen falta policies de storage.objects
-- para los inserts/updates/deletes del admin — solo el flag public=true
-- para que las URLs devueltas por getPublicUrl() sean legibles sin auth.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sitio-imagenes', 'sitio-imagenes', true, 4194304, array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sitio-contenido', 'sitio-contenido', true, 1048576, array['application/json'])
on conflict (id) do nothing;
