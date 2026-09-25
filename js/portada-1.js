
// ── CARRUSEL (crossfade, 4 slides) ──
(function(){
  var wrap = document.getElementById('hero-carrusel');
  var slides = wrap.querySelectorAll('.hero-slide');
  var dotsEl = document.getElementById('hero-dots');
  var n = slides.length, cur = 0;
  for (var i = 0; i < n; i++) {
    var d = document.createElement('span');
    if (i === 0) d.className = 'on';
    dotsEl.appendChild(d);
  }
  var dots = dotsEl.querySelectorAll('span');
  setInterval(function(){
    slides[cur].classList.remove('on');
    dots[cur].classList.remove('on');
    cur = (cur + 1) % n;
    slides[cur].classList.add('on');
    dots[cur].classList.add('on');
  }, 3500);
})();

// ── NAV MOBILE ──
function toggleNav(){
  document.body.classList.toggle('nav-open');
}
document.querySelectorAll('.site-nav a').forEach(function(a){
  a.addEventListener('click', function(){ document.body.classList.remove('nav-open'); });
});

// ── MODAL LEGAL (privacidad) ──
var textoAviso = `<h2 style="color:#17233F;margin-top:0">Aviso legal</h2>
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), te informamos de quién está detrás de esta web.</p>
<ul>
<li><strong>Titular:</strong> Silvia G. M.</li>
<li><strong>NIF:</strong> 05931103-R</li>
<li><strong>Domicilio:</strong> Calle Independencia 65, 13200 Manzanares (Ciudad Real)</li>
<li><strong>Email:</strong> <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a></li>
<li><strong>Teléfono / WhatsApp:</strong> +34 647 44 43 08</li>
<li><strong>Actividad:</strong> personalización de artículos y merchandising para empresas (Bendito Lab) y personalización en directo para eventos (Dilo Bonito).</li>
</ul>
<h3>Uso de la web</h3>
<p>Al navegar por benditolab.com aceptas usarla de forma lícita. La información del catálogo es orientativa: los precios "desde" no son una oferta vinculante, el precio final va siempre en el presupuesto que te enviamos.</p>
<h3>Propiedad intelectual</h3>
<p>Los textos, fotografías, logotipos y diseños de esta web son de la titular o de terceros que han autorizado su uso. No se pueden copiar ni reutilizar sin permiso por escrito. Los logotipos de clientes que aparecen en fotos de trabajos se muestran con su autorización y siguen siendo de sus dueños.</p>
<h3>Responsabilidad</h3>
<p>Intentamos que todo lo publicado sea correcto y esté al día, pero no respondemos de errores puntuales ni de los contenidos de webs externas a las que enlazamos (redes sociales, WhatsApp, etc.).</p>
<h3>Legislación y jurisdicción</h3>
<p>Se aplica la legislación española. Si eres consumidor, cualquier conflicto se resolverá en los juzgados de tu domicilio. En el resto de casos, en los juzgados de Manzanares (Ciudad Real).</p>
<p style="font-size:12px;color:#888;">Última actualización: septiembre de 2026</p>`;

var textoCookies = `<h2 style="color:#17233F;margin-top:0">Política de cookies</h2>
<p>Una cookie es un pequeño archivo que la web guarda en tu navegador. Aquí te contamos cuáles usamos, conforme al artículo 22.2 de la LSSI-CE. Las técnicas son necesarias para que la web funcione. Las analíticas solo se activan si pulsas "Aceptar" en el aviso.</p>

<h3>Qué usamos</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
<tr style="background:#f5f5f5;">
<th style="padding:8px;border:1px solid #ddd;text-align:left;">Nombre</th>
<th style="padding:8px;border:1px solid #ddd;text-align:left;">De quién</th>
<th style="padding:8px;border:1px solid #ddd;text-align:left;">Para qué</th>
<th style="padding:8px;border:1px solid #ddd;text-align:left;">Duración</th>
</tr>
<tr>
<td style="padding:8px;border:1px solid #ddd;">bl_cookie_consent</td>
<td style="padding:8px;border:1px solid #ddd;">Propia · técnica</td>
<td style="padding:8px;border:1px solid #ddd;">Recordar si aceptaste o rechazaste las cookies</td>
<td style="padding:8px;border:1px solid #ddd;">Hasta que la borres</td>
</tr>
<tr>
<td style="padding:8px;border:1px solid #ddd;">bl_content_cache_v1</td>
<td style="padding:8px;border:1px solid #ddd;">Propia · técnica</td>
<td style="padding:8px;border:1px solid #ddd;">Cargar más rápido las imágenes y textos de la web</td>
<td style="padding:8px;border:1px solid #ddd;">Hasta que la borres</td>
</tr>
<tr>
<td style="padding:8px;border:1px solid #ddd;">bl_session_token</td>
<td style="padding:8px;border:1px solid #ddd;">Propia · técnica</td>
<td style="padding:8px;border:1px solid #ddd;">Mantener tu sesión abierta en el área de cliente</td>
<td style="padding:8px;border:1px solid #ddd;">Hasta que cierres sesión o caduque</td>
</tr>
<tr>
<td style="padding:8px;border:1px solid #ddd;">_ga</td>
<td style="padding:8px;border:1px solid #ddd;">Google · analítica</td>
<td style="padding:8px;border:1px solid #ddd;">Distinguir visitantes para contar visitas</td>
<td style="padding:8px;border:1px solid #ddd;">2 años</td>
</tr>
<tr>
<td style="padding:8px;border:1px solid #ddd;">_ga_QHM1133FL4</td>
<td style="padding:8px;border:1px solid #ddd;">Google · analítica</td>
<td style="padding:8px;border:1px solid #ddd;">Guardar el estado de la sesión de Google Analytics</td>
<td style="padding:8px;border:1px solid #ddd;">2 años</td>
</tr>
</table>
<p style="font-size:12px;color:#666;margin-top:8px;">Las tres primeras se guardan en el almacenamiento local del navegador, que funciona como una cookie técnica.</p>

<h3>Cambiar de opinión</h3>
<p>Puedes cambiar tu elección cuando quieras. Al pulsar el botón se borra tu preferencia y vuelve a salir el aviso.</p>
<p><button onclick="localStorage.removeItem('bl_cookie_consent');location.reload();" style="background:#17233F;color:#fff;border:none;padding:10px 18px;border-radius:6px;cursor:pointer;font-size:13px;">Cambiar mi elección de cookies</button></p>
<p>También puedes borrarlas desde tu navegador (Chrome, Firefox, Safari o Edge, en el apartado de privacidad) o desactivar Google Analytics con su complemento oficial: <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener">tools.google.com/dlpage/gaoptout</a>.</p>

<p style="font-size:12px;color:#888;">Última actualización: septiembre de 2026</p>`;

var textoPrivacidad = `<h2 style="color:#17233F;margin-top:0">Política de privacidad</h2>
<p>Esta política explica qué datos personales recogemos en benditolab.com y en el área de cliente, para qué los usamos y qué derechos tienes. Se rige por el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).</p>

<h3>Quién es la responsable</h3>
<p>Silvia G. M. · NIF 05931103-R · Calle Independencia 65, 13200 Manzanares (Ciudad Real) · <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a></p>

<h3>Qué datos recogemos y para qué</h3>
<p><strong>Formulario de contacto.</strong> Nombre, email, teléfono (si lo das), cómo prefieres que te contactemos, el tipo de consulta y tu mensaje. Los usamos para responderte y, si te interesa, prepararte un presupuesto. Base legal: tu consentimiento al marcar la casilla y las medidas precontractuales que pides (art. 6.1.a y 6.1.b RGPD).</p>
<p><strong>Novedades por email.</strong> Solo si marcas la casilla de novedades, usamos tu email para enviarte ideas, productos nuevos y promociones de Bendito Lab y Dilo Bonito. Es voluntario y puedes darte de baja cuando quieras, desde el enlace de cada email o escribiéndonos. Base legal: tu consentimiento (art. 6.1.a RGPD y art. 21 LSSI-CE).</p>
<p><strong>Área de cliente.</strong> Si trabajamos juntos, te damos acceso a un área privada donde guardamos tus datos de contacto y facturación, presupuestos, diseños, pedidos y facturas. Base legal: la ejecución del contrato (art. 6.1.b RGPD) y nuestras obligaciones fiscales y contables (art. 6.1.c RGPD).</p>
<p><strong>WhatsApp, email y redes sociales.</strong> Si nos escribes por estos canales, usamos lo que nos mandes solo para atender tu consulta. Esas plataformas tienen sus propias políticas de privacidad.</p>
<p><strong>Analítica.</strong> Si aceptas las cookies analíticas, Google Analytics recoge datos de navegación de forma agregada para saber qué páginas se visitan. Más detalle en la política de cookies.</p>

<h3>Cuánto tiempo los guardamos</h3>
<p>Las consultas que no terminan en pedido, un máximo de 12 meses. Los datos de clientes, mientras dure la relación y después durante 6 años, que es lo que exige el Código de Comercio para la documentación contable. El email de novedades, hasta que te des de baja.</p>

<h3>Con quién los compartimos</h3>
<p>No vendemos ni cedemos tus datos a nadie, salvo obligación legal (por ejemplo, Hacienda). Para que la web funcione usamos proveedores que tratan datos por cuenta nuestra y con contrato de encargo: Vercel Inc. (alojamiento de la web), Supabase Inc. (base de datos del formulario y del área de cliente), Google LLC (Google Analytics) y nuestro proveedor de correo electrónico. Algunos de ellos pueden tratar datos fuera del Espacio Económico Europeo. En ese caso lo hacen amparados en el Marco de Privacidad de Datos UE-EE. UU. o en cláusulas contractuales tipo aprobadas por la Comisión Europea.</p>

<h3>Tus derechos</h3>
<p>Puedes pedir acceso a tus datos, rectificarlos, suprimirlos, oponerte a su uso, limitarlo o pedir que te los pasemos en un formato portable. También puedes retirar tu consentimiento en cualquier momento, sin que eso afecte a lo tratado antes. Escríbenos a <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a> indicando qué derecho quieres ejercer. Te contestaremos en un plazo máximo de un mes.</p>
<p>Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos: <a href="https://www.aepd.es" target="_blank" rel="noopener">www.aepd.es</a>.</p>

<h3>Menores</h3>
<p>La web no está dirigida a menores de 14 años. Si trabajamos con un AMPA o un centro educativo, los datos los gestiona la persona adulta responsable del pedido.</p>

<p style="font-size:12px;color:#888;">Última actualización: septiembre de 2026</p>`;
function abrirModal(tipo) {
  document.getElementById('modal-contenido').innerHTML = tipo==='aviso'?textoAviso:tipo==='cookies'?textoCookies:textoPrivacidad;
  document.getElementById('modal-legal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}
function cerrarModal() {
  document.getElementById('modal-legal').style.display = 'none';
  document.body.style.overflow = '';
}
document.getElementById('modal-legal').addEventListener('click', function(e){ if(e.target===this) cerrarModal(); });
document.querySelectorAll('[data-modal]').forEach(function(el){
  el.addEventListener('click', function(e){ e.preventDefault(); abrirModal(this.dataset.modal); });
});
var btnCerrarModal = document.getElementById('btn-cerrar-modal');
if (btnCerrarModal) btnCerrarModal.addEventListener('click', cerrarModal);
var btnRechazarCookies = document.getElementById('btn-rechazar-cookies');
if (btnRechazarCookies) btnRechazarCookies.addEventListener('click', rechazarCookies);
var btnAceptarCookies = document.getElementById('btn-aceptar-cookies');
if (btnAceptarCookies) btnAceptarCookies.addEventListener('click', aceptarCookies);
var navHamburger = document.querySelector('.nav-hamburger');
if (navHamburger) navHamburger.addEventListener('click', toggleNav);

function aceptarCookies() {
  localStorage.setItem('bl_cookie_consent','accepted');
  document.getElementById('cookie-banner').style.display = 'none';
  activarAnalytics();
}
function rechazarCookies() {
  localStorage.setItem('bl_cookie_consent','rejected');
  document.getElementById('cookie-banner').style.display = 'none';
}
function activarAnalytics() {
  if(window._gaActivado) return; window._gaActivado=true;
  var s=document.createElement('script'); s.src='https://www.googletagmanager.com/gtag/js?id=G-QHM1133FL4'; s.async=true; document.head.appendChild(s);
  window.dataLayer=window.dataLayer||[]; function gtag(){dataLayer.push(arguments);} window.gtag=gtag;
  gtag('js',new Date()); gtag('config','G-QHM1133FL4');
}
window.addEventListener('DOMContentLoaded', function(){
  var consent = localStorage.getItem('bl_cookie_consent');
  if (!consent) { var b=document.getElementById('cookie-banner'); if(b) b.style.display='flex'; }
  if (consent==='accepted') activarAnalytics();
});
