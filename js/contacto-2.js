
function toggleNav(){ document.body.classList.toggle('nav-open'); }
document.querySelectorAll('.site-nav a').forEach(function(a){
  a.addEventListener('click', function(){ document.body.classList.remove('nav-open'); });
});

// Los botones "Únete como colaborador →" (artículos) y "QUIERO SER
// COLABORADOR→" (colaboradores.html) traen a esta página con
// ?tipo=colaboradores para preseleccionar el motivo, en vez de depender
// de un formulario dedicado que ya no existe (ver colaboradores.html).
(function preseleccionarTipoContacto() {
  var tipo = new URLSearchParams(location.search).get('tipo');
  var select = document.querySelector('[name="tipo_contacto"]');
  if (tipo && select && [...select.options].some(function(o){ return o.value === tipo; })) {
    select.value = tipo;
  }
})();

// enviandoContacto: btn.disabled por sí solo no basta en móvil — un doble
// tap casi simultáneo puede disparar dos eventos "submit" antes de que
// disabled surta efecto visualmente (mismo problema y mismo fix que
// enviandoPresupuesto en catalogo-comun.js).
var enviandoContacto = false;
document.getElementById('contacto-form').addEventListener('submit', async function(e){
  e.preventDefault();
  if (enviandoContacto) return;
  enviandoContacto = true;
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
        data: { nombre: f.get('nombre'), email: f.get('email'), telefono: f.get('telefono'), contacto_preferido: f.get('contacto_preferido'), tipo_contacto: f.get('tipo_contacto'), asunto: f.get('asunto'), mensaje: f.get('mensaje'), newsletter: f.get('newsletter') === 'on' }
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
