// api/producto.js — Página individual de un artículo del catálogo público,
// con URL propia e indexable (/producto/<slug>-<id>, ver vercel.json),
// metadatos Open Graph/Twitter Card reales por producto (para que al
// compartir el enlace salga la foto y el nombre del artículo) y datos
// estructurados schema.org/Product para SEO. Antes cada artículo solo
// existía como un modal sobre /catalogo (?articulo=<id>): sin dirección ni
// contenido propios que un buscador o un scraper de vista previa pudiera
// leer sin ejecutar JS.
//
// El servidor renderiza una ficha estática básica dentro de #md-contenido
// (misma estructura visual que el modal de detalle del catálogo, para
// buscadores/vistas previas sin JS); catalogo-producto.js la sustituye por
// la versión interactiva reutilizando renderFichaProducto() de
// catalogo-comun.js una vez carga el JS — así no se duplica la lógica de
// colores/talla/calculadora/presupuesto, solo el HTML de la primera pintura.
const { createClient } = require('@supabase/supabase-js');
const { CAMPOS_PUBLICOS, enriquecerArticulos, slugificar } = require('../lib/articulo-publico');

let cachedClient = null;
function client() {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas');
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// JSON embebido en <script>: evita que un valor con "</script>" dentro
// (nombre o descripción del artículo) corte la etiqueta y rompa la página.
function jsonParaScript(valor) {
  return JSON.stringify(valor).replace(/</g, '\\u003c');
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Mismo criterio que parseTablaTallas() en js/catalogo-comun.js — si se
// cambia uno hay que cambiar el otro. Se duplica en vez de compartir
// módulo porque uno corre en el navegador como <script> plano (sin build
// step ni módulos ES) y este en Node.
function parseTablaTallas(texto) {
  if (!texto) return null;
  const lineas = String(texto).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lineas.length < 2) return null;

  const filas = lineas.map((l) => l.split(/\s+/).filter(Boolean));
  const conteo = {};
  filas.forEach((f) => { conteo[f.length] = (conteo[f.length] || 0) + 1; });
  let dataCols = Object.keys(conteo).reduce(
    (mejor, k) => (conteo[k] > (conteo[mejor] || 0) ? k : mejor),
    Object.keys(conteo)[0]
  );
  dataCols = parseInt(dataCols, 10);
  if (!dataCols || dataCols < 2) return null;

  function normalizarFila(tokens) {
    if (tokens.length === dataCols) return tokens;
    if (tokens.length < dataCols) return null;
    const resto = tokens.slice(1);
    const grupos = dataCols - 1;
    const base = Math.floor(resto.length / grupos);
    const extra = resto.length % grupos;
    const salida = [tokens[0]];
    let idx = 0;
    for (let g = 0; g < grupos; g++) {
      const tam = base + (g < extra ? 1 : 0);
      salida.push(resto.slice(idx, idx + tam).join(' '));
      idx += tam;
    }
    return salida;
  }

  const normalizadas = filas.map(normalizarFila).filter(Boolean);
  if (normalizadas.length < 2) return null;
  return { cabecera: normalizadas[0], filas: normalizadas.slice(1) };
}

function renderTablaTallasHtml(tabla) {
  return (
    '<div class="mt-tabla-scroll"><table class="mt-tabla"><thead><tr>' +
    tabla.cabecera.map((c) => '<th>' + escapeHtml(c) + '</th>').join('') +
    '</tr></thead><tbody>' +
    tabla.filas.map((f) => '<tr>' + f.map((c) => '<td>' + escapeHtml(c) + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div>'
  );
}

// CSS propio de la ficha de producto: mismas variables/clases .prod-*/.md-*
// y .mt-tabla que catalogo.html, para que se vea igual que el modal de
// detalle del catálogo. Las de .swatch-btn (tooltip, hover) y
// .mt-caja/#modal-tallas las inyecta catalogo-comun.js por JS al cargar,
// así que no hace falta repetirlas aquí.
const ESTILOS = `
:root{ --cream:#F4F1E6; --deep:#17233F; --white:#FBF4E9; --poppy:#E2704A; --sage:#9AB791; --captain:#2F8FEA; --rose:#E3A29C; --baby:#93ACA7; --sunshine:#E8C24A; }
*{box-sizing:border-box;}
body{margin:0;background:var(--cream);font-family:'Inter',sans-serif;color:var(--deep);overflow-x:hidden;}
a{color:inherit;text-decoration:none;}
h1,h2{font-family:'Helvetica World','Helvetica Neue',Helvetica,Arial,sans-serif;margin:0;}
.navlink:hover{opacity:.7;}
input,textarea{font-family:'Inter',sans-serif;}
input::placeholder,textarea::placeholder{color:#8A9099;}

.site-header{background:var(--poppy);padding:32px 5vw 22px;}
.header-tag{text-align:center;color:var(--white);font-weight:700;font-size:13px;letter-spacing:2.5px;text-transform:uppercase;opacity:.92;}
.header-logo{margin-top:14px;display:flex;justify-content:center;}
.header-logo img{height:170px;width:auto;display:block;}
.site-nav{display:flex;align-items:center;justify-content:center;gap:clamp(16px,3vw,36px);margin-top:24px;flex-wrap:wrap;}
.site-nav a{font-weight:700;font-size:13px;letter-spacing:.5px;color:var(--white);}
.site-nav a.pill{border:1px solid var(--white);padding:9px 18px;border-radius:22px;}
.nav-hamburger{display:none;}

.volver{display:inline-block;margin:32px 0 20px;font-weight:700;font-size:13px;color:var(--captain);}
.ficha-seccion{max-width:1100px;margin:0 auto;padding:0 5vw 60px;}

#modal-presupuesto{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100000;overflow-y:auto;padding:40px 16px;}
.mp-box{background:#fff;max-width:480px;margin:0 auto;border-radius:12px;padding:32px;position:relative;}
.mp-box .btn-cerrar{position:absolute;top:14px;right:16px;background:none;border:none;font-size:22px;cursor:pointer;color:#888;}
.mp-box h3{font-size:19px;margin:0 0 4px;}
.mp-box .mp-producto{font-size:13px;color:var(--baby);font-weight:700;margin:0 0 20px;}
.mp-box form{display:flex;flex-direction:column;gap:12px;}
.field{padding:12px 16px;border-radius:8px;border:1px solid #D9D3C0;background:#fff;font-size:14px;color:var(--deep);width:100%;}
textarea.field{resize:vertical;}
.mp-fila{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.mp-field-label{display:block;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--baby);margin:0 0 6px;}
.mp-precio-aprox{font-size:11px;color:var(--baby);line-height:1.4;margin:8px 0 0;}

.md-box{background:#fff;max-width:1180px;margin:0 auto;border-radius:12px;position:relative;overflow:hidden;}
.md-box .btn-cerrar{display:none;}

.prod-wrap{max-width:1180px;margin:0 auto;padding:40px 5vw;display:grid;grid-template-columns:1.05fr 1fr;gap:48px;}
.prod-gallery{position:sticky;top:16px;align-self:start;}
.prod-img{aspect-ratio:1/1;border-radius:14px;overflow:hidden;background:var(--baby);display:flex;align-items:center;justify-content:center;}
.prod-img img{width:100%;height:100%;object-fit:contain;display:block;}
.prod-img span{color:var(--white);font-size:13px;font-weight:700;}

.prod-eyebrow{display:flex;gap:8px;align-items:center;font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--baby);margin-bottom:10px;}
.prod-eyebrow .dot{width:4px;height:4px;border-radius:50%;background:var(--baby);}
.prod-titulo,h1.prod-titulo{font-size:26px;font-weight:800;letter-spacing:-.01em;margin:0;}
.prod-desc{margin-top:12px;font-size:14.5px;line-height:1.6;color:var(--deep);opacity:.85;}

.prod-tabs{display:flex;gap:24px;margin-top:24px;border-bottom:1px solid #E4DEC9;}
.prod-tab{background:none;border:none;cursor:pointer;padding:0 0 12px;font-size:13.5px;font-weight:700;color:var(--baby);border-bottom:2px solid transparent;margin-bottom:-1px;}
.prod-tab[aria-selected="true"]{color:var(--deep);border-color:var(--poppy);}
.prod-panel{padding-top:18px;display:flex;flex-direction:column;gap:16px;}
.prod-field-label{font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--baby);margin:0 0 8px;}
.chip-list{display:flex;flex-wrap:wrap;gap:8px;}
.chip{padding:6px 12px;border-radius:999px;border:1px solid #E4DEC9;font-size:12.5px;font-weight:600;background:#fff;color:var(--deep);}
.chip.tecnica{background:#F7F5EF;}

.swatch-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;}
.swatch-btn{width:32px;height:32px;border-radius:50%;cursor:pointer;border:2px solid #fff;box-shadow:0 0 0 1.5px #E4DEC9;position:relative;padding:0;}
.swatch-btn--sin-match{background:repeating-linear-gradient(45deg,#e0ddd6,#e0ddd6 4px,#f2f0ea 4px,#f2f0ea 8px);}
.swatch-btn--estampado{background:repeating-linear-gradient(45deg,#cfcac0,#cfcac0 3px,#efece5 3px,#efece5 6px);}
.swatch-btn--activo{box-shadow:0 0 0 2px var(--deep);}
.color-actual{font-size:13px;color:var(--deep);opacity:.8;margin:8px 0 0;}
.color-actual b{opacity:1;font-weight:700;}

.md-talla{margin:18px 0 0;}
.md-talla select{width:100%;padding:8px 10px;border-radius:6px;border:1px solid #E0DDD6;font-size:13px;}
.prod-ctas{margin-top:20px;}
.btn{padding:15px 20px;border-radius:11px;font-size:14.5px;font-weight:700;border:1.5px solid transparent;cursor:pointer;text-align:center;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;}
.btn-primary{background:var(--deep);color:var(--white);}
.mt-tabla-scroll{overflow-x:auto;margin-top:4px;}
.mt-tabla{width:100%;border-collapse:collapse;font-size:13px;}
.mt-tabla th,.mt-tabla td{padding:9px 12px;text-align:center;white-space:nowrap;}
.mt-tabla th{background:#17233F;color:#FBF4E9;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.3px;}
.mt-tabla th:first-child,.mt-tabla td:first-child{text-align:left;font-weight:700;}
.mt-tabla tbody tr:nth-child(even){background:rgba(143,163,194,.12);}
.mt-tabla td{border-bottom:1px solid rgba(23,35,63,.08);}
.md-calc-personalizacion{font-size:12px;color:var(--baby);margin-top:6px;line-height:1.4;}
.md-calc{background:#F7F5EF;border-radius:10px;padding:16px;margin:0 0 18px;}
.md-calc-title{font-weight:700;font-size:13px;margin:0 0 12px;}
.md-calc-loading{font-size:13px;color:var(--baby);margin:0;}
.md-calc-row{display:grid;grid-template-columns:1fr 1.4fr;gap:10px;margin-bottom:10px;}
.md-calc-row label{display:flex;flex-direction:column;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--baby);gap:4px;}
.md-calc-row input,.md-calc-row select{padding:8px 10px;border:1px solid #E0DDD6;border-radius:6px;font-size:14px;font-family:inherit;color:var(--deep);}
.md-calc-extras{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;}
.md-calc-extra{font-size:13px;display:flex;align-items:center;gap:6px;font-weight:400;text-transform:none;color:var(--deep);}
.btn-calcular{background:var(--deep);color:#fff;font-weight:700;font-size:12px;padding:11px 16px;border-radius:20px;border:none;cursor:pointer;width:100%;}
.md-calc-resultado{margin-top:12px;padding-top:12px;border-top:1px solid #E0DDD6;}
.md-calc-total{font-weight:800;font-size:18px;}
.md-calc-total span{font-weight:400;font-size:12px;color:var(--baby);}
.md-calc-linea{font-size:12px;color:var(--deep);opacity:.8;margin-top:4px;}
.md-calc-aviso{font-size:11px;color:var(--baby);margin-top:8px;line-height:1.4;}
.md-calc-error{font-size:13px;color:#C0392B;}
.md-calc-descuento{font-size:12px;font-weight:700;color:#2E7D32;margin-top:4px;}
.md-calc-tramos{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px;}
.md-calc-tramos th{text-align:left;font-weight:700;text-transform:uppercase;font-size:10px;color:var(--baby);padding:4px 6px;border-bottom:1px solid #E0DDD6;}
.md-calc-tramos td{padding:4px 6px;border-bottom:1px solid #EFEDE6;color:var(--deep);}
.md-calc-tramos tr.tramo-activo td{font-weight:700;background:#EFE9DC;}
.btn-presupuesto{background:var(--captain);color:var(--white);font-weight:700;font-size:12px;padding:11px 16px;border-radius:20px;border:none;cursor:pointer;text-align:center;}
@media(max-width:860px){
  .prod-wrap{grid-template-columns:1fr;gap:24px;padding:24px 5vw;}
  .prod-gallery{position:static;}
}
@media(max-width:900px){
  .site-nav{display:none;flex-direction:column;gap:18px;position:fixed;inset:0;background:var(--deep);z-index:1000;align-items:center;justify-content:center;}
  .site-nav a{font-size:20px;color:var(--white)!important;}
  .nav-hamburger{display:flex;flex-direction:column;gap:5px;background:none;border:none;cursor:pointer;padding:8px;position:absolute;top:28px;right:5vw;z-index:1001;}
  .nav-hamburger span{display:block;width:22px;height:2px;background:var(--white);}
  .site-header{position:relative;}
  body.nav-open .site-nav{display:flex;}
  body.nav-open{overflow:hidden;}
  .footer-bottom{flex-direction:column;text-align:center;}
  .footer-bottom-links{justify-content:center;}
}
footer{background:var(--rose);}
.footer-bottom{max-width:1200px;margin:0 auto;padding:28px 5vw;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;}
.footer-bottom-links{display:flex;align-items:center;gap:32px;flex-wrap:wrap;}
.footer-bottom-links img{height:26px;width:26px;display:block;}
.footer-bottom-links a{color:var(--white);font-weight:600;font-size:14px;}
.footer-copy{color:var(--white);font-size:13px;}
`;

// Cabecera y pie de página: mismo contenido que catalogo.html, con rutas
// absolutas (esta página vive en /producto/<slug>-<id>, no en la raíz).
const CABECERA = `
<header class="site-header">
  <div class="header-tag">Artículos personalizados para empresas y eventos</div>
  <div class="header-logo"><a href="/portada.html"><img src="/logo-bendito.png" alt="Bendito Lab"></a></div>
  <button class="nav-hamburger" aria-label="Menú"><span></span><span></span><span></span></button>
  <nav class="site-nav" id="site-nav">
    <a class="navlink" href="/portada.html">PORTADA→</a>
    <a class="navlink" href="/dilo-bonito.html">DILO BONITO→</a>
    <a class="navlink" href="/bendito-lab.html">BENDITO LAB→</a>
    <a class="navlink" href="/catalogo">CATÁLOGO→</a>
    <a class="navlink" href="/colaboradores">COLABORADORES→</a>
    <a class="navlink" href="/contacto">CONTACTO→</a>
    <a class="navlink pill" href="/area-clientes">ÁREA CLIENTE→</a>
  </nav>
</header>`;

const PIE = `
<footer>
  <div class="footer-bottom">
    <div class="footer-bottom-links">
      <img src="/images/eye-logo.svg" alt="" style="height:26px;width:26px;">
      <a href="/dilo-bonito.html">Dilo bonito</a>
      <a href="/bendito-lab.html">Bendito lab.</a>
      <a href="/colaboradores">Colaboradores</a>
      <a href="#" data-modal="aviso">Aviso legal</a>
      <a href="#" data-modal="privacidad">Política de privacidad</a>
      <a href="#" data-modal="cookies">Política de cookies</a>
      <a href="/faq.html">F.A.Q.</a>
    </div>
    <span class="footer-copy">© 2026 Bendito lab.</span>
  </div>
</footer>

<div id="modal-legal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100000;overflow-y:auto;padding:40px 16px;">
  <div style="background:#fff;max-width:760px;margin:0 auto;border-radius:12px;padding:40px;font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#222;position:relative;">
    <button id="btn-cerrar-modal" style="position:absolute;top:16px;right:20px;background:none;border:none;font-size:22px;cursor:pointer;color:#888;">✕</button>
    <div id="modal-contenido"></div>
  </div>
</div>

<div id="modal-presupuesto">
  <div class="mp-box">
    <button class="btn-cerrar" id="btn-cerrar-presupuesto">✕</button>
    <h3>Pedir presupuesto</h3>
    <p class="mp-producto" id="mp-producto-nombre"></p>
    <form id="presupuesto-form">
      <input class="field" name="nombre" type="text" placeholder="Nombre" required>
      <input class="field" name="email" type="email" placeholder="Email" required>
      <input class="field" name="telefono" type="tel" placeholder="Teléfono" required>
      <div class="mp-fila">
        <input class="field" name="cantidad" type="number" min="1" placeholder="Cantidad">
        <input class="field" name="color" type="text" placeholder="Color">
      </div>
      <select class="field" name="zona_marcaje" id="mp-zona-marcaje" style="display:none;">
        <option value="">Zona de marcaje</option>
      </select>
      <select class="field" name="tecnica" id="mp-tecnica" style="display:none;">
        <option value="">Técnica de personalización</option>
      </select>
      <label>
        <span class="mp-field-label">Logo para el mockup (opcional)</span>
        <input class="field" name="logo" id="mp-logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">
      </label>
      <textarea class="field" name="otros_datos" rows="3" placeholder="Otros datos: más artículos, fecha del pedido, detalles adicionales... (opcional)"></textarea>
      <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:12px;">
        <input type="checkbox" name="condiciones" required style="margin-top:3px;width:16px;height:16px;flex-shrink:0;">
        <span>Acepto que Bendito Lab guarde mis datos para gestionar esta solicitud. Consulta la <a href="#" data-modal="privacidad" style="text-decoration:underline;">política de privacidad</a>.</span>
      </label>
      <button type="submit" class="btn-presupuesto">ENVIAR SOLICITUD→</button>
      <p id="presupuesto-error" style="display:none;color:#B3261E;font-size:13px;margin:0;"></p>
    </form>
    <div id="presupuesto-success" style="display:none;text-align:center;padding:20px 0;">
      <div style="font-size:34px;margin-bottom:10px;">✓</div>
      <h3 style="margin:0 0 6px;">Hemos recibido tu mensaje</h3>
      <p style="font-size:13px;">En breve te haremos llegar tu presupuesto, esperamos que te encante. Si tienes cualquier duda o quieres incluir algo más no dudes en contactarnos.</p>
    </div>
  </div>
</div>

<div id="cookie-banner" style="display:none;position:fixed;bottom:0;left:0;right:0;background:#17233F;color:#fff;padding:16px 24px;z-index:99999;font-family:Arial,sans-serif;font-size:13px;box-shadow:0 -2px 12px rgba(0,0,0,0.3);align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
  <span style="flex:1;min-width:200px;">
    🍪 Usamos cookies propias y de Google Analytics para mejorar tu experiencia.
    <a href="#" data-modal="privacidad" style="color:#E8C24A;text-decoration:underline;">Privacidad</a> ·
    <a href="#" data-modal="cookies" style="color:#E8C24A;text-decoration:underline;">Cookies</a>
  </span>
  <div style="display:flex;gap:8px;flex-shrink:0;">
    <button id="btn-rechazar-cookies" style="background:transparent;border:1px solid #E8C24A;color:#E8C24A;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;">Rechazar</button>
    <button id="btn-aceptar-cookies" style="background:#E8C24A;border:none;color:#17233F;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Aceptar</button>
  </div>
</div>`;

function paginaNoEncontrada() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Producto no encontrado · Bendito Lab</title>
<meta name="robots" content="noindex, nofollow">
<style>${ESTILOS}</style>
</head>
<body>
${CABECERA}
<section class="ficha-seccion" style="text-align:center;">
  <h1 style="margin:60px 0 16px;">Producto no encontrado</h1>
  <p style="margin:0 0 24px;">Puede que ya no esté disponible o que el enlace esté mal escrito.</p>
  <a class="volver" href="/catalogo">← Volver al catálogo</a>
</section>
${PIE}
<script src="/js/catalogo-1.js"></script>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  const idParam = String(req.query.id || '');
  const match = idParam.match(UUID_RE);
  if (!match) {
    res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(paginaNoEncontrada());
  }
  const id = match[0];

  try {
    const supabase = client();
    const { data: base, error } = await supabase
      .from('catalogo_articulos')
      .select(CAMPOS_PUBLICOS)
      .eq('id', id)
      .eq('visible_web', true)
      .maybeSingle();
    if (error) throw error;

    if (!base) {
      res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(paginaNoEncontrada());
    }

    const [a] = await enriquecerArticulos(supabase, [base]);

    const slug = slugificar(a.nombre) || 'producto';
    const url = `https://www.benditolab.com/producto/${slug}-${a.id}`;
    const titulo = `${a.nombre} · Bendito Lab`;
    const descripcionBase =
      a.descripcion_corta ||
      a.descripcion ||
      `${a.nombre}, personalizable para empresas y eventos. Pide presupuesto sin compromiso.`;
    const descripcion = descripcionBase.length > 160 ? descripcionBase.slice(0, 157) + '...' : descripcionBase;
    const imagen = a.imagen_principal_url || 'https://www.benditolab.com/logo-bendito.png';

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: a.nombre,
      description: descripcionBase,
      image: a.imagen_principal_url ? [a.imagen_principal_url] : undefined,
      category: a.categoria || undefined,
      brand: a.marca ? { '@type': 'Brand', name: a.marca } : undefined,
    };

    const atributos = [
      ['Material', a.material],
      ['Medidas', a.medidas],
      ['Capacidad', a.capacidad],
      ['Formato', a.formato],
      ['Acabados', a.acabados],
      [
        'Personalización',
        a.tecnicas_personalizacion && a.tecnicas_personalizacion.length
          ? a.tecnicas_personalizacion.join(', ')
          : null,
      ],
    ].filter(([, valor]) => !!valor);

    const guiaEsImagen = /^https?:\/\/.+\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(a.guia_tallas || '');
    const tablaTallas = !guiaEsImagen ? parseTablaTallas(a.guia_tallas) : null;
    const guiaTallasHtml = !a.guia_tallas
      ? ''
      : guiaEsImagen
      ? `<div class="md-talla"><span class="prod-field-label">Guía de tallas</span><img src="${escapeHtml(a.guia_tallas)}" alt="Guía de tallas" style="max-width:100%;border-radius:8px;"></div>`
      : tablaTallas
      ? `<div class="md-talla"><span class="prod-field-label">Guía de tallas</span>${renderTablaTallasHtml(tablaTallas)}</div>`
      : `<div class="md-talla"><span class="prod-field-label">Guía de tallas</span><p class="prod-desc">${escapeHtml(a.guia_tallas).replace(/\n/g, '<br>')}</p></div>`;

    // Ficha estática básica para buscadores/vistas previas sin JS —
    // catalogo-producto.js la sustituye por la versión interactiva
    // (renderFichaProducto, con pestañas y calculadora) en cuanto carga.
    const contenidoFicha = `
      <div class="prod-wrap">
        <div class="prod-gallery"><div class="prod-img"><img src="${escapeHtml(imagen)}" alt="${escapeHtml(a.nombre)}"></div></div>
        <div class="prod-info">
          ${a.categoria ? `<div class="prod-eyebrow"><span>${escapeHtml(a.categoria)}</span>${a.subcategoria ? `<span class="dot"></span><span>${escapeHtml(a.subcategoria)}</span>` : ''}</div>` : ''}
          <h1 class="prod-titulo">${escapeHtml(a.nombre)}</h1>
          ${descripcionBase ? `<p class="prod-desc">${escapeHtml(descripcionBase)}</p>` : ''}
          ${a.colores && a.colores.length ? `<p class="prod-desc"><strong>Colores disponibles:</strong> ${escapeHtml(a.colores.join(', '))}</p>` : ''}
          ${a.tallas && a.tallas.length ? `<p class="prod-desc"><strong>Tallas disponibles:</strong> ${escapeHtml(a.tallas.join(', '))}</p>` : ''}
          ${guiaTallasHtml}
          ${atributos.length ? atributos.map(([l, v]) => `<div><div class="prod-field-label">${escapeHtml(l)}</div><p style="margin:0;font-size:14px;color:var(--deep);opacity:.8;">${escapeHtml(v)}</p></div>`).join('') : ''}
          <div class="md-calc" id="md-calc"></div>
          <div class="prod-ctas"><button type="button" class="btn btn-primary" id="btn-presupuesto-desde-detalle">Pedir presupuesto</button></div>
          <p class="mp-precio-aprox">Precio aproximado. El presupuesto final puede variar según diseño y detalles del pedido.</p>
        </div>
      </div>`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(titulo)}</title>
<meta name="description" content="${escapeHtml(descripcion)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${escapeHtml(titulo)}">
<meta property="og:description" content="${escapeHtml(descripcion)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${escapeHtml(imagen)}">
<meta property="og:type" content="product">
<meta property="og:locale" content="es_ES">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(titulo)}">
<meta name="twitter:description" content="${escapeHtml(descripcion)}">
<meta name="twitter:image" content="${escapeHtml(imagen)}">
<script type="application/ld+json">${jsonParaScript(jsonLd)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>${ESTILOS}</style>
<link rel="icon" type="image/svg+xml" href="/images/eye-logo.svg">
<link rel="apple-touch-icon" href="/icon-web-180.png">
<link rel="icon" type="image/png" sizes="32x32" href="/icon-web-32.png">
<link rel="manifest" href="/manifest.json">
<script src="/js/bl-api.js" defer></script>
</head>
<body>
${CABECERA}
<section class="ficha-seccion">
  <a class="volver" href="/catalogo">← Volver al catálogo</a>
  <div class="md-box" id="md-contenido">${contenidoFicha}</div>
</section>
${PIE}
<script type="application/json" id="datos-articulo">${jsonParaScript(a)}</script>
<script src="/js/catalogo-1.js"></script>
<script src="/js/catalogo-comun.js"></script>
<script src="/js/catalogo-producto.js"></script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.status(200).end(html);
  } catch (e) {
    console.error('Error generando página de producto:', e.message);
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<!DOCTYPE html><html><body>No se pudo cargar el producto. Inténtalo de nuevo.</body></html>');
  }
};
