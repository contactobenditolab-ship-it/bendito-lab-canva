// js/contact-module.js — Funcionalidad consolidada de formularios
// Consolida: contacto-1.js + contacto-2.js
// Dependencias: common.js (toggleNav, modales, escapeHtml)


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
document.getElementById('contacto-form').addEventListener('submit', async function(e){
  e.preventDefault();
  var form = e.target;
  var f = new FormData(form);
  var errEl = document.getElementById('contacto-error');
  errEl.style.display = 'none';
  var btn = form.querySelector('.btn-send');
  btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    var r = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'contacto',
        website: f.get('website'),
        data: { nombre: f.get('nombre'), email: f.get('email'), telefono: f.get('telefono'), contacto_preferido: f.get('contacto_preferido'), tipo_contacto: f.get('tipo_contacto'), asunto: f.get('asunto'), mensaje: f.get('mensaje') }
      })
    });
    var d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Error al enviar');
    form.style.display = 'none';
    document.getElementById('contacto-success').style.display = 'block';
  } catch (err) {
    errEl.textContent = err.message + ' — o escríbenos directamente a contacto@benditolab.com';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'ENVIAR→';
  }
});
