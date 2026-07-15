
// ── CARRUSEL ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function(){
(function(){
  var track = document.getElementById('c-track');
  var dotsEl = document.getElementById('c-dots');
  if (!track || !dotsEl) return;
  var slides = track.children;
  var n = slides.length;
  var cur = 0;
  var timer;

  // Crear dots
  for(var i=0;i<n;i++){
    var d = document.createElement('button');
    d.className = 'c-dot' + (i===0?' on':'');
    d.setAttribute('data-i', i);
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
