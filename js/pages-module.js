// js/pages-module.js — Inicialización consolidada de páginas estáticas
// Consolida: index-1/2/3.js, portada-1.js, dilo-bonito-1.js, bendito-lab-1.js
// Dependencias: common.js (toggleNav, modales, cookies, analytics)

  var cur = 0;
  var timer;

  // Crear dots
  for(var i=0;i<n;i++){
    var d = document.createElement('button');
    d.className = 'c-dot' + (i===0?' on':'');
    d.setAttribute('data-i', i);
    d.setAttribute('type', 'button');
    d.setAttribute('aria-label', 'Ir a la imagen ' + (i+1) + ' de ' + n);
    d.onclick = (function(idx){ return function(){ clearInterval(timer); go(idx); start(); }; })(i);
    dotsEl.appendChild(d);
  }

  function go(idx){
    cur = (idx+n)%n;
    track.style.transform = 'translateX(-'+cur*100+'%)';
    document.querySelectorAll('.c-dot').forEach(function(d,j){ d.classList.toggle('on',j===cur); });
  }
  window.cPrev = function(){ clearInterval(timer); go(cur-1); start(); };
  window.cNext = function(){ clearInterval(timer); go(cur+1); start(); };
  function start(){ timer = setInterval(function(){ go(cur+1); }, 4500); }

  // Swipe
  var sx=0;
  var el=document.getElementById('carousel');
  el.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;},{passive:true});
  el.addEventListener('touchend',function(e){
    var dx=sx-e.changedTouches[0].clientX;
    if(Math.abs(dx)>50){ dx>0?cNext():cPrev(); }
  },{passive:true});

  start();
})();
}); // end DOMContentLoaded carrusel

// ── NAV MOBILE ────────────────────────────────────────────
function toggleNav(){
  var isOpen=document.body.classList.contains('nav-open');
  if(isOpen){closeMob();}else{
    document.getElementById('nav').classList.add('mob-open');
    document.getElementById('nav-ham').classList.add('open');
    document.body.classList.add('nav-open');
    document.body.style.overflow='hidden';
  }
}
function closeMob(){
  document.getElementById('nav').classList.remove('mob-open');
  document.getElementById('nav-ham').classList.remove('open');
  document.body.classList.remove('nav-open');
  document.body.style.overflow='';
}
document.querySelectorAll('.nav-links a').forEach(function(a){a.addEventListener('click',closeMob);});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMob();});


// ── FORMULARIO COTIZACIÓN ─────────────────────────────────
async function enviarCotizacion(){
  var nombre = document.getElementById('f-nombre').value.trim();
  var tel    = document.getElementById('f-tel').value.trim();
  var email  = document.getElementById('f-email').value.trim();
  var tipo   = document.getElementById('f-tipo').value;
  var msg    = document.getElementById('f-msg').value.trim();

  if(!nombre||!tel||!email){
    alert('Por favor rellena nombre, teléfono y email.');
    return;
  }

  var btn = document.querySelector('.cot-submit');
  btn.disabled=true; btn.textContent='Enviando...';

  try{
    var r = await fetch('/api/contact',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        type: 'cotizacion',
        data: { nombre, telefono:tel, email, servicio:tipo, mensaje:msg }
      })
    });
    var d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Error al enviar');
    document.getElementById('cot-form').style.display='none';
    document.getElementById('cot-ok').style.display='block';
  }catch(e){
    btn.disabled=false; btn.textContent='ENVIAR SOLICITUD →';
    alert('Error al enviar. Escríbenos directamente a contacto@benditolab.com');
  }
}

  var root = document.documentElement;

  // 1. Primero aplicar desde localStorage (guardado por el admin)
  try {
    var stored = localStorage.getItem('bl-portada-v1');
    if (stored) {
      var data = JSON.parse(stored);
      COLOR_VARS.forEach(function(id) {
        var val = data['color-' + id];
        if (val && val.startsWith('#')) {
          root.style.setProperty('--' + id, val);
        }
      });
    }
  } catch(e) {}

  // 2. Luego intentar Sheets (sobreescribe si hay datos más recientes)
  setTimeout(async function() {
    try {
      var r = await fetch('/api/content?pagina=portada&t=' + Date.now());
      var d = await r.json();
      if (!d.data) return;
      var data = d.data;
      // Formato Sheets: colores.cream → --cream
      COLOR_VARS.forEach(function(id) {
        var val = data['colores.' + id] || data['color-' + id];
        if (val && val.startsWith('#')) {
          root.style.setProperty('--' + id, val);
        }
      });
    } catch(e) { /* sin conexión — se usan los del localStorage o los por defecto */ }
  }, 300);
})();

<li><strong>Domicilio:</strong> Calle Independencia 65, 13200 Manzanares, Ciudad Real</li>
<li><strong>Email:</strong> <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a></li>
<li><strong>Actividad:</strong> Personalización y merchandising (Bendito Lab · Dilo Bonito)</li>
</ul>
<p>Todos los contenidos del sitio son propiedad de la titular o de terceros autorizados. Queda prohibida su reproducción sin autorización escrita. Legislación española aplicable — Juzgados de Manzanares, Ciudad Real.</p>`;

var textoPrivacidad = `<h2 style="color:#17233F;margin-top:0">Política de Privacidad</h2>
<p><strong>Responsable:</strong> Silvia G. M. · NIF 05931103-R · <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a></p>
<p><strong>Datos recabados:</strong> A través de los formularios de contacto y colaboradores: nombre, email, teléfono, empresa/espacio y el resto de datos indicados en el formulario. Finalidad: gestionar tu consulta o solicitud de colaboración.</p>
<p><strong>Base legal:</strong> Consentimiento (art. 6.1.a RGPD) y ejecución de contrato (art. 6.1.b RGPD).</p>
<p><strong>Conservación:</strong> Durante el tiempo necesario y los plazos legales (hasta 5 años).</p>
<p><strong>Terceros:</strong> Google Analytics (Google LLC, analítica web), Resend (envío de emails transaccionales) y Bendito OS / Supabase (gestión de solicitudes de colaboración).</p>
<p><strong>Tus derechos:</strong> Acceso, rectificación, supresión, oposición, limitación y portabilidad. Escríbenos a <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a> o reclama ante la <a href="https://www.aepd.es" target="_blank">AEPD</a>.</p>`;

var textoCookies = `<h2 style="color:#17233F;margin-top:0">Política de Cookies</h2>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
<tr style="background:#f5f5f5;"><th style="padding:8px;border:1px solid #ddd;text-align:left;">Cookie</th><th style="padding:8px;border:1px solid #ddd;text-align:left;">Tipo</th><th style="padding:8px;border:1px solid #ddd;text-align:left;">Finalidad</th><th style="padding:8px;border:1px solid #ddd;text-align:left;">Duración</th></tr>
<tr><td style="padding:8px;border:1px solid #ddd;">bl_cookie_consent</td><td style="padding:8px;border:1px solid #ddd;">Técnica propia</td><td style="padding:8px;border:1px solid #ddd;">Guardar tu preferencia</td><td style="padding:8px;border:1px solid #ddd;">1 año</td></tr>
<tr><td style="padding:8px;border:1px solid #ddd;">_ga, _gid, _gat</td><td style="padding:8px;border:1px solid #ddd;">Analítica (Google)</td><td style="padding:8px;border:1px solid #ddd;">Análisis anónimo del tráfico</td><td style="padding:8px;border:1px solid #ddd;">Hasta 2 años</td></tr>
</table>
<p style="margin-top:16px;">Puedes rechazar o retirar el consentimiento en cualquier momento. Desactivar Analytics: <a href="https://tools.google.com/dlpage/gaoptout" target="_blank">tools.google.com/dlpage/gaoptout</a></p>`;

function abrirModal(tipo) {
  document.getElementById('modal-contenido').innerHTML = tipo==='aviso'?textoAviso:tipo==='privacidad'?textoPrivacidad:textoCookies;
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
var navHamburger = document.getElementById('nav-ham');
if (navHamburger) navHamburger.addEventListener('click', toggleNav);
document.querySelectorAll('.mob-close-link').forEach(function(el){ el.addEventListener('click', closeMob); });
var cArrowPrev = document.getElementById('c-arrow-prev');
if (cArrowPrev) cArrowPrev.addEventListener('click', cPrev);
var cArrowNext = document.getElementById('c-arrow-next');
if (cArrowNext) cArrowNext.addEventListener('click', cNext);
var btnEnviarCotizacion = document.getElementById('btn-enviar-cotizacion');
if (btnEnviarCotizacion) btnEnviarCotizacion.addEventListener('click', enviarCotizacion);

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
  if (!consent) { var b=document.getElementById('cookie-banner'); b.style.display='flex'; }
  if (consent==='accepted') activarAnalytics();
});

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
var textoAviso = `<h2 style="color:#17233F;margin-top:0">Aviso Legal</h2>
<ul>
<li><strong>Titular:</strong> Silvia G. M. · NIF: 05931103-R</li>
<li><strong>Domicilio:</strong> Calle Independencia 65, 13200 Manzanares, Ciudad Real</li>
<li><strong>Email:</strong> <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a></li>
<li><strong>Actividad:</strong> Personalización y merchandising (Bendito Lab · Dilo Bonito)</li>
</ul>
<p>Todos los contenidos del sitio son propiedad de la titular o de terceros autorizados. Queda prohibida su reproducción sin autorización escrita. Legislación española aplicable — Juzgados de Manzanares, Ciudad Real.</p>`;

var textoCookies = `<h2 style="color:#17233F;margin-top:0">Política de Cookies</h2>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
<tr style="background:#f5f5f5;"><th style="padding:8px;border:1px solid #ddd;text-align:left;">Cookie</th><th style="padding:8px;border:1px solid #ddd;text-align:left;">Tipo</th><th style="padding:8px;border:1px solid #ddd;text-align:left;">Finalidad</th><th style="padding:8px;border:1px solid #ddd;text-align:left;">Duración</th></tr>
<tr><td style="padding:8px;border:1px solid #ddd;">bl_cookie_consent</td><td style="padding:8px;border:1px solid #ddd;">Técnica propia</td><td style="padding:8px;border:1px solid #ddd;">Guardar tu preferencia</td><td style="padding:8px;border:1px solid #ddd;">1 año</td></tr>
<tr><td style="padding:8px;border:1px solid #ddd;">_ga, _gid, _gat</td><td style="padding:8px;border:1px solid #ddd;">Analítica (Google)</td><td style="padding:8px;border:1px solid #ddd;">Análisis anónimo del tráfico</td><td style="padding:8px;border:1px solid #ddd;">Hasta 2 años</td></tr>
</table>
<p style="margin-top:16px;">Puedes rechazar o retirar el consentimiento en cualquier momento. Desactivar Analytics: <a href="https://tools.google.com/dlpage/gaoptout" target="_blank">tools.google.com/dlpage/gaoptout</a></p>`;

var textoPrivacidad = `<h2 style="color:#17233F;margin-top:0">Política de Privacidad</h2>
<p><strong>Responsable:</strong> Silvia G. M. · NIF 05931103-R · <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a></p>
<p><strong>Datos recabados:</strong> A través de los formularios de contacto y colaboradores: nombre, email, teléfono, empresa/espacio y el resto de datos indicados en el formulario. Finalidad: gestionar tu consulta o solicitud de colaboración.</p>
<p><strong>Base legal:</strong> Consentimiento (art. 6.1.a RGPD) y ejecución de contrato (art. 6.1.b RGPD).</p>
<p><strong>Conservación:</strong> Durante el tiempo necesario y los plazos legales (hasta 5 años).</p>
<p><strong>Terceros:</strong> Google Analytics (Google LLC, analítica web), Resend (envío de emails transaccionales) y Bendito OS / Supabase (gestión de solicitudes de colaboración).</p>
<p><strong>Tus derechos:</strong> Acceso, rectificación, supresión, oposición, limitación y portabilidad. Escríbenos a <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a> o reclama ante la <a href="https://www.aepd.es" target="_blank">AEPD</a>.</p>`;
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

});
var textoAviso = `<h2 style="color:#17233F;margin-top:0">Aviso Legal</h2>
<ul>
<li><strong>Titular:</strong> Silvia G. M. · NIF: 05931103-R</li>
<li><strong>Domicilio:</strong> Calle Independencia 65, 13200 Manzanares, Ciudad Real</li>
<li><strong>Email:</strong> <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a></li>
<li><strong>Actividad:</strong> Personalización y merchandising (Bendito Lab · Dilo Bonito)</li>
</ul>
<p>Todos los contenidos del sitio son propiedad de la titular o de terceros autorizados. Queda prohibida su reproducción sin autorización escrita. Legislación española aplicable — Juzgados de Manzanares, Ciudad Real.</p>`;

var textoCookies = `<h2 style="color:#17233F;margin-top:0">Política de Cookies</h2>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
<tr style="background:#f5f5f5;"><th style="padding:8px;border:1px solid #ddd;text-align:left;">Cookie</th><th style="padding:8px;border:1px solid #ddd;text-align:left;">Tipo</th><th style="padding:8px;border:1px solid #ddd;text-align:left;">Finalidad</th><th style="padding:8px;border:1px solid #ddd;text-align:left;">Duración</th></tr>
<tr><td style="padding:8px;border:1px solid #ddd;">bl_cookie_consent</td><td style="padding:8px;border:1px solid #ddd;">Técnica propia</td><td style="padding:8px;border:1px solid #ddd;">Guardar tu preferencia</td><td style="padding:8px;border:1px solid #ddd;">1 año</td></tr>
<tr><td style="padding:8px;border:1px solid #ddd;">_ga, _gid, _gat</td><td style="padding:8px;border:1px solid #ddd;">Analítica (Google)</td><td style="padding:8px;border:1px solid #ddd;">Análisis anónimo del tráfico</td><td style="padding:8px;border:1px solid #ddd;">Hasta 2 años</td></tr>
</table>
<p style="margin-top:16px;">Puedes rechazar o retirar el consentimiento en cualquier momento. Desactivar Analytics: <a href="https://tools.google.com/dlpage/gaoptout" target="_blank">tools.google.com/dlpage/gaoptout</a></p>`;

var textoPrivacidad = `<h2 style="color:#17233F;margin-top:0">Política de Privacidad</h2>
<p><strong>Responsable:</strong> Silvia G. M. · NIF 05931103-R · <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a></p>
<p><strong>Datos recabados:</strong> A través de los formularios de contacto y colaboradores: nombre, email, teléfono, empresa/espacio y el resto de datos indicados en el formulario. Finalidad: gestionar tu consulta o solicitud de colaboración.</p>
<p><strong>Base legal:</strong> Consentimiento (art. 6.1.a RGPD) y ejecución de contrato (art. 6.1.b RGPD).</p>
<p><strong>Conservación:</strong> Durante el tiempo necesario y los plazos legales (hasta 5 años).</p>
<p><strong>Terceros:</strong> Google Analytics (Google LLC, analítica web), Resend (envío de emails transaccionales) y Bendito OS / Supabase (gestión de solicitudes de colaboración).</p>
<p><strong>Tus derechos:</strong> Acceso, rectificación, supresión, oposición, limitación y portabilidad. Escríbenos a <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a> o reclama ante la <a href="https://www.aepd.es" target="_blank">AEPD</a>.</p>`;
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
  
  // Sección Personalización en directo → página de producto específica
  var personalizacionSection = document.querySelector('#personalizacion .db-two-col');
  if(personalizacionSection){
    personalizacionSection.addEventListener('click', function(){
      window.location.href = 'https://www.benditolab.com/producto/personalizacion-para-eventos-f83a849d-0f21-41a5-b22e-2aa8141dce1f';
    });
  }
  
  // Otras secciones (Seating, Expendedora, Gancho, Merch) → contacto
  var contactoSections = ['#seating', '#expendedora', '#gancho', '#merchcorner'];
  contactoSections.forEach(function(selector){
    var section = document.querySelector(selector);
    if(section){
      section.addEventListener('click', function(){
        window.location.href = 'contacto.html';
      });
    }
  });
  
  // Hacer clickeables otras fotos de sv-card → contacto
  var svCardImages = document.querySelectorAll('.sv-card img');
  svCardImages.forEach(function(img){
    img.addEventListener('click', function(){
      window.location.href = 'contacto.html';
    });
  });
});

  var slides = wrap.querySelectorAll('.bl-slide');
  var dotsEl = document.getElementById('bl-dots');
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
function toggleNav(){ document.body.classList.toggle('nav-open'); }
document.querySelectorAll('.site-nav a').forEach(function(a){
  a.addEventListener('click', function(){ document.body.classList.remove('nav-open'); });
});

// ── MODAL LEGAL ──
var textoAviso = `<h2 style="color:#17233F;margin-top:0">Aviso Legal</h2>
<ul>
<li><strong>Titular:</strong> Silvia G. M. · NIF: 05931103-R</li>
<li><strong>Domicilio:</strong> Calle Independencia 65, 13200 Manzanares, Ciudad Real</li>
<li><strong>Email:</strong> <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a></li>
<li><strong>Actividad:</strong> Personalización y merchandising (Bendito Lab · Dilo Bonito)</li>
</ul>
<p>Todos los contenidos del sitio son propiedad de la titular o de terceros autorizados. Queda prohibida su reproducción sin autorización escrita. Legislación española aplicable — Juzgados de Manzanares, Ciudad Real.</p>`;

var textoCookies = `<h2 style="color:#17233F;margin-top:0">Política de Cookies</h2>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
<tr style="background:#f5f5f5;"><th style="padding:8px;border:1px solid #ddd;text-align:left;">Cookie</th><th style="padding:8px;border:1px solid #ddd;text-align:left;">Tipo</th><th style="padding:8px;border:1px solid #ddd;text-align:left;">Finalidad</th><th style="padding:8px;border:1px solid #ddd;text-align:left;">Duración</th></tr>
<tr><td style="padding:8px;border:1px solid #ddd;">bl_cookie_consent</td><td style="padding:8px;border:1px solid #ddd;">Técnica propia</td><td style="padding:8px;border:1px solid #ddd;">Guardar tu preferencia</td><td style="padding:8px;border:1px solid #ddd;">1 año</td></tr>
<tr><td style="padding:8px;border:1px solid #ddd;">_ga, _gid, _gat</td><td style="padding:8px;border:1px solid #ddd;">Analítica (Google)</td><td style="padding:8px;border:1px solid #ddd;">Análisis anónimo del tráfico</td><td style="padding:8px;border:1px solid #ddd;">Hasta 2 años</td></tr>
</table>
<p style="margin-top:16px;">Puedes rechazar o retirar el consentimiento en cualquier momento. Desactivar Analytics: <a href="https://tools.google.com/dlpage/gaoptout" target="_blank">tools.google.com/dlpage/gaoptout</a></p>`;

var textoPrivacidad = `<h2 style="color:#17233F;margin-top:0">Política de Privacidad</h2>
<p><strong>Responsable:</strong> Silvia G. M. · NIF 05931103-R · <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a></p>
<p><strong>Datos recabados:</strong> A través de los formularios de contacto y colaboradores: nombre, email, teléfono, empresa/espacio y el resto de datos indicados en el formulario. Finalidad: gestionar tu consulta o solicitud de colaboración.</p>
<p><strong>Base legal:</strong> Consentimiento (art. 6.1.a RGPD) y ejecución de contrato (art. 6.1.b RGPD).</p>
<p><strong>Conservación:</strong> Durante el tiempo necesario y los plazos legales (hasta 5 años).</p>
<p><strong>Terceros:</strong> Google Analytics (Google LLC, analítica web), Resend (envío de emails transaccionales) y Bendito OS / Supabase (gestión de solicitudes de colaboración).</p>
<p><strong>Tus derechos:</strong> Acceso, rectificación, supresión, oposición, limitación y portabilidad. Escríbenos a <a href="mailto:contacto@benditolab.com">contacto@benditolab.com</a> o reclama ante la <a href="https://www.aepd.es" target="_blank">AEPD</a>.</p>`;
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
