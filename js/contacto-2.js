
function toggleNav(){ document.body.classList.toggle('nav-open'); }
document.querySelectorAll('.site-nav a').forEach(function(a){
  a.addEventListener('click', function(){ document.body.classList.remove('nav-open'); });
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
        data: { nombre: f.get('nombre'), email: f.get('email'), telefono: f.get('telefono'), contacto_preferido: f.get('contacto_preferido'), asunto: f.get('asunto'), mensaje: f.get('mensaje') }
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
