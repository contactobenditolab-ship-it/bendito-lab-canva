
function toggleNav(){ document.body.classList.toggle('nav-open'); }
document.querySelectorAll('.site-nav a').forEach(function(a){
  a.addEventListener('click', function(){ document.body.classList.remove('nav-open'); });
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
});

// ── ÚNETE FORM ──
var UNETE_FISICOS = ['Finca', 'Restaurante', 'Hotel', 'Espacio de eventos'];
var unTipo = '';

document.querySelectorAll('#tipos-grid .tipbtn').forEach(function(btn){
  btn.addEventListener('click', function(){
    unTipo = btn.dataset.tipo;
    document.querySelectorAll('#tipos-grid .tipbtn').forEach(function(b){ b.classList.remove('sel'); });
    btn.classList.add('sel');
    var esFisico = UNETE_FISICOS.indexOf(unTipo) !== -1;
    document.getElementById('datos-fisico').style.display = esFisico ? 'block' : 'none';
    document.getElementById('datos-servicio').style.display = esFisico ? 'none' : 'block';
  });
});

document.getElementById('unete-form-el').addEventListener('submit', async function(e){
  e.preventDefault();
  if (!unTipo) { alert('Selecciona un tipo de colaborador'); return; }
  var form = e.target;
  var f = new FormData(form);
  var esFisico = UNETE_FISICOS.indexOf(unTipo) !== -1;
  var data = {
    nombre: f.get('nombre'),
    espacio: f.get('espacio'),
    email: f.get('email'),
    telefono: f.get('telefono'),
    instagram: f.get('instagram') || '-',
    web: f.get('web') || '-',
    tipo: unTipo
  };
  if (esFisico) {
    Object.assign(data, {
      direccion: f.get('direccion'),
      aforo: f.get('aforo'),
      zona_stand: f.get('zona_stand'),
      medidas: f.get('medidas') || '-',
      corriente: f.get('corriente'),
      acceso: f.get('acceso'),
      aparcamiento: f.get('aparcamiento'),
      observaciones: f.get('obs_espacio') || '-'
    });
  } else {
    Object.assign(data, {
      eventos_anio: f.get('eventos_anio'),
      zona_trabajo: f.get('zona_trabajo'),
      portfolio: f.get('portfolio') || '-',
      forma_recomendacion: f.get('forma_recomendacion'),
      lista_proveedores: f.get('lista_proveedores'),
      observaciones: f.get('obs_servicios') || '-'
    });
  }
  var submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true; submitBtn.textContent = 'Enviando...';
  try {
    var r = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'colaborador', data: data })
    });
    var d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Error al enviar');
    document.getElementById('unete-form-visible').style.display = 'none';
    document.getElementById('unete-form-success').style.display = 'block';
  } catch (err) {
    var body = encodeURIComponent(JSON.stringify(data, null, 2));
    var subject = encodeURIComponent('Solicitud de colaborador - ' + unTipo);
    alert(err.message + '. Te abrimos tu email para que nos escribas directamente.');
    window.location.href = 'mailto:colaboradores@benditolab.com?subject=' + subject + '&body=' + body;
  } finally {
    submitBtn.disabled = false; submitBtn.textContent = 'ENVIAR SOLICITUD→';
  }
});
