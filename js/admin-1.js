// ═══════════════════════════════════════════════════════════
var PASS = null; // gestionado por /api/auth
var STORE = 'bl-admin-v5';
var dirty = false;

// ── COLORES ──────────────────────────────────────────────
// ── SECCIONES EDITABLES ──────────────────────────────────
var SEC_STYLES = [
  {id:'sec-hero',       name:'Hero — Bloque principal',     bgDef:'#17233F', colorDef:'#FBF4E9'},
  {id:'sec-lineas',     name:'Dos líneas de negocio',       bgDef:'',        colorDef:''},
  {id:'sec-cotizacion', name:'Solicitar cotización',        bgDef:'#F4F1E6', colorDef:'#17233F'},
  {id:'sec-redes',      name:'Síguenos en redes',           bgDef:'#17233F', colorDef:'#FBF4E9'},
];

function showToast(msg) {
  var t = document.getElementById('bl-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'bl-toast';
    t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(16px);background:#17233F;color:#E8C24A;padding:10px 22px;border-radius:20px;font-size:13px;font-family:'Inter',sans-serif;opacity:0;transition:all .25s;z-index:9999;white-space:nowrap;pointer-events:none;";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(function () {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(16px)';
  }, 2500);
}

function uploadImgData(el) { uploadImg(el, el.dataset.path, el.dataset.grp); }

function anadirImgData(el) { anadirImg(el, el.dataset.grp); }

function closeBannerModal() { document.getElementById('banner-modal').style.display = 'none'; }

function copiarCodigoBanner() {
  var ta = document.querySelector('#banner-modal textarea');
  if (!ta) return;
  navigator.clipboard.writeText(ta.value)
    .then(function(){ showToast('Código copiado ✓'); })
    .catch(function(){ showToast('Error al copiar'); });
}

function renderSecColorList() {
  var d = getData();
  var estilos = d.sec_styles || {};
  var list = document.getElementById('sec-color-list');
  if (!list) return;
  list.innerHTML = '';
  SEC_STYLES.forEach(function(s, idx) {
    var saved = estilos[s.id] || {};
    var bg    = saved.bg    || s.bgDef    || '#ffffff';
    var color = saved.color || s.colorDef || '#17233F';

    var wrap = document.createElement('div');
    wrap.style.cssText = 'padding:14px;border:1px solid #E0DDD6;margin-bottom:10px;background:#FAFAF8;';

    // Título
    var title = document.createElement('div');
    title.style.cssText = 'font-family:\'Helvetica World\',\'Helvetica Neue\',Helvetica,Arial,sans-serif;font-weight:800;font-size:13px;color:#17233F;margin-bottom:10px;';
    title.textContent = s.name;
    wrap.appendChild(title);

    // Grid 2 columnas
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';

    // Helper para crear una fila de color
    function crearFilaColor(prop, label, val, idPicker, idText) {
      var col = document.createElement('div');
      var lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;margin-bottom:6px;';
      lbl.textContent = label;
      col.appendChild(lbl);

      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;';

      // Color picker
      var picker = document.createElement('input');
      picker.type = 'color';
      picker.value = val;
      picker.id = idPicker;
      picker.style.cssText = 'width:40px;height:36px;padding:2px;border:1.5px solid #E0DDD6;cursor:pointer;';
      picker.addEventListener('input', (function(sid, p){ return function(){ aplicarEstiloSeccion(sid, p, this.value); }; })(s.id, prop));
      row.appendChild(picker);

      // Text input
      var txt = document.createElement('input');
      txt.type = 'text';
      txt.value = val;
      txt.id = idText;
      txt.maxLength = 9;
      txt.style.cssText = 'flex:1;padding:8px;border:1.5px solid #E0DDD6;font-family:monospace;font-size:12px;';
      txt.addEventListener('input', (function(sid, p){ return function(){ aplicarEstiloSeccionTxt(sid, p, this.value); }; })(s.id, prop));
      row.appendChild(txt);

      // Reset
      var reset = document.createElement('button');
      reset.textContent = '↩';
      reset.title = 'Restablecer';
      reset.style.cssText = 'background:none;border:1px solid #ddd;color:#aaa;padding:6px 8px;cursor:pointer;font-size:14px;';
      reset.addEventListener('click', (function(sid, p, def){ return function(){ resetEstilo(sid, p, def); }; })(s.id, prop, prop==='bg'?s.bgDef:s.colorDef));
      row.appendChild(reset);

      col.appendChild(row);
      return col;
    }

    grid.appendChild(crearFilaColor('bg',    'Fondo', bg,    'bg-'+s.id,  'bgtxt-'+s.id));
    grid.appendChild(crearFilaColor('color', 'Texto', color, 'col-'+s.id, 'coltxt-'+s.id));
    wrap.appendChild(grid);

    // Vista previa
    var preview = document.createElement('div');
    preview.id = 'preview-'+s.id;
    preview.style.cssText = 'margin-top:10px;padding:12px;font-size:13px;font-weight:700;text-align:center;background:'+bg+';color:'+color+';';
    preview.textContent = 'Vista previa · ' + s.name;
    wrap.appendChild(preview);

    list.appendChild(wrap);
  });
}

function aplicarEstiloSeccion(secId, prop, val) {
  // Actualizar texto
  document.getElementById((prop==='bg'?'bgtxt-':'coltxt-')+secId).value = val;
  // Vista previa
  var prev = document.getElementById('preview-'+secId);
  if (prev) prev.style[prop==='bg'?'background':'color'] = val;
  // Guardar
  var d = getData();
  if (!d.sec_styles) d.sec_styles = {};
  if (!d.sec_styles[secId]) d.sec_styles[secId] = {};
  d.sec_styles[secId][prop] = val;
  setData(d);
  markDirty();
  // Enviar a portada via postMessage
  broadcastToPortada(buildPortadaData());
}

function aplicarEstiloSeccionTxt(secId, prop, val) {
  if (val.length < 4) return;
  document.getElementById((prop==='bg'?'bg-':'col-')+secId).value = val;
  aplicarEstiloSeccion(secId, prop, val);
}

function resetEstilo(secId, prop, defVal) {
  if (!defVal) return;
  document.getElementById((prop==='bg'?'bg-':'col-')+secId).value = defVal;
  document.getElementById((prop==='bg'?'bgtxt-':'coltxt-')+secId).value = defVal;
  aplicarEstiloSeccion(secId, prop, defVal);
}

var COLOR_DEFS = [
  {id:'deep',    name:'Azul marino (fondo oscuro)',  def:'#17233F'},
  {id:'captain', name:'Azul medio (acento)',         def:'#2F8FEA'},
  {id:'baby',    name:'Azul cielo (fondo claro)',    def:'#93ACA7'},
  {id:'sunshine',name:'Amarillo (acento brillante)', def:'#E8C24A'},
  {id:'poppy',   name:'Coral (hover/acento)',        def:'#E2704A'},
  {id:'cream',   name:'Crema (fondo principal)',     def:'#F4F1E6'},
  {id:'white',   name:'Blanco (tarjetas)',           def:'#FBF4E9'},
  {id:'mid',     name:'Gris texto',                  def:'#666666'},
  {id:'gray',    name:'Gris bordes',                 def:'#E3DFCF'},
];

var PRESETS = {
  marble: {deep:'#17233F',captain:'#2F8FEA',baby:'#93ACA7',sunshine:'#E8C24A',poppy:'#E2704A',cream:'#F4F1E6',white:'#FBF4E9',mid:'#666',gray:'#E3DFCF'},
  tierra: {deep:'#5C3D2E',captain:'#8B6355',baby:'#D4A574',sunshine:'#F5C842',poppy:'#C0392B',cream:'#FAF0E6',white:'#FDF8F0',mid:'#7A6155',gray:'#D4C4B0'},
  verde:  {deep:'#1B4332',captain:'#2D6A4F',baby:'#95D5B2',sunshine:'#F2D024',poppy:'#D62828',cream:'#D8F3DC',white:'#F0FFF4',mid:'#40916C',gray:'#B7E4C7'},
  negro:  {deep:'#111111',captain:'#333333',baby:'#666666',sunshine:'#E8C24A',poppy:'#E2704A',cream:'#F5F5F0',white:'#FFFFFF',mid:'#888',gray:'#CCCCCC'},
};

// ── SECCIONES ─────────────────────────────────────────────
var SECCIONES_DEFAULT = [
  {id:'sec-carrusel', name:'Carrusel de fotos',   icon:'🖼️', visible:true,  editable:false},
  {id:'sec-hero',     name:'Hero — Claim central',icon:'⚡', visible:true,  editable:true},
  {id:'sec-lineas',   name:'Dos líneas de negocio',icon:'📋',visible:true,  editable:true},
  {id:'sec-cotizacion',name:'Solicitar cotización',icon:'📩',visible:true,  editable:true},
  {id:'sec-redes',    name:'Síguenos en redes',   icon:'📱', visible:true,  editable:true},
];

var secciones = JSON.parse(JSON.stringify(SECCIONES_DEFAULT));
var seccionesExtra = [];

// ── REDES ─────────────────────────────────────────────────
var REDES_DEFAULT = [
  {id:'red-ig1',   icon:'📸', name:'Instagram',  handle:'@bendito_lab',              href:'https://instagram.com/bendito_lab',              visible:true},
  {id:'red-ig2',   icon:'✨', name:'Instagram',  handle:'@dilobonitopersonalizados',  href:'https://instagram.com/dilobonitopersonalizados', visible:true},
  {id:'red-tiktok',icon:'🎵', name:'TikTok',     handle:'@bendito_lab',              href:'https://tiktok.com/@bendito_lab',               visible:true},
  {id:'red-wa',    icon:'💬', name:'WhatsApp',   handle:'647 444 308',               href:'https://wa.me/34647444308',                     visible:true},
];
var redes = JSON.parse(JSON.stringify(REDES_DEFAULT));

// ── PRODUCTOS ─────────────────────────────────────────────
var productos = [
  {nombre:'Tote bag',  desc:'Bolsa tela algodón', precio:'Consultar'},
  {nombre:'Gorra',     desc:'Bordada o DTF',      precio:'Consultar'},
  {nombre:'Neceser',   desc:'Personalizable',     precio:'Consultar'},
  {nombre:'Camiseta',  desc:'Personalizada',      precio:'Consultar'},
];

// ── IMÁGENES ──────────────────────────────────────────────
var IMG_GROUPS = {
  logos: [
    {key:'logo-bendito.png', path:'logo-bendito.png', name:'Logo Bendito Lab (todas las páginas)'},
    {key:'logo.png',         path:'logo.png',         name:'Logo Dilo Bonito (menú)'},
  ],
  portada_carrusel: [
    {key:'carrusel-1.jpg', path:'images/carrusel-1.jpg', name:'Portada — Carrusel Foto 1'},
    {key:'carrusel-2.jpg', path:'images/carrusel-2.jpg', name:'Portada — Carrusel Foto 2'},
    {key:'carrusel-3.jpg', path:'images/carrusel-3.jpg', name:'Portada — Carrusel Foto 3'},
    {key:'carrusel-4.jpg', path:'images/carrusel-4.jpg', name:'Portada — Carrusel Foto 4'},
    {key:'hero.jpg',       path:'images/hero.jpg',       name:'Portada — Retrato (intro)'},
    {key:'db-personalizacion.jpg', path:'images/db-personalizacion.jpg', name:'Portada — Qué hacemos: Dilo Bonito'},
    {key:'img-tote.jpg',   path:'images/img-tote.jpg',   name:'Portada — Qué hacemos: Bendito Lab'},
    {key:'colab-hero.jpg', path:'images/colab-hero.jpg', name:'Portada — Qué hacemos: Colaboradores'},
    {key:'b2b-1.jpg',      path:'images/b2b-1.jpg',      name:'Portada — Banda de imagen (camisetas)'},
  ],
  db_carrusel: [
    {key:'carrusel-1.jpg', path:'images/carrusel-1.jpg', name:'Dilo Bonito — Galería Foto 1'},
    {key:'carrusel-2.jpg', path:'images/carrusel-2.jpg', name:'Dilo Bonito — Galería Foto 2'},
    {key:'carrusel-3.jpg', path:'images/carrusel-3.jpg', name:'Dilo Bonito — Galería Foto 3'},
    {key:'carrusel-4.jpg', path:'images/carrusel-4.jpg', name:'Dilo Bonito — Galería Foto 4'},
    {key:'carrusel-5.jpg', path:'images/carrusel-5.jpg', name:'Dilo Bonito — Galería Foto 5'},
  ],
  dilo_bonito: [
    {key:'db-personalizacion.jpg', path:'images/db-personalizacion.jpg', name:'Dilo Bonito — Servicio: Personalización en directo'},
    {key:'seating.jpg',            path:'images/seating.jpg',            name:'Dilo Bonito — Servicio: Seating Plan'},
    {key:'db-maquinas.jpg',        path:'images/db-maquinas.jpg',        name:'Dilo Bonito — Servicio: Máquina expendedora'},
    {key:'maquinas.jpg',           path:'images/maquinas.jpg',           name:'Dilo Bonito — Servicio: Máquina de gancho'},
    {key:'db-merch.jpg',           path:'images/db-merch.jpg',           name:'Dilo Bonito — Servicio: Corner Merch'},
    {key:'merch.jpg',              path:'images/merch.jpg',              name:'Dilo Bonito — Servicio: Cuéntanos tu idea'},
    {key:'personalizacion.jpg',    path:'images/personalizacion.jpg',    name:'Dilo Bonito — Sección personalización (foto grande)'},
  ],
  colaboradores: [
    {key:'colab-hero.jpg', path:'images/colab-hero.jpg', name:'Colaboradores — Foto de fondo del hero'},
    {key:'b2b-1.jpg', path:'images/b2b-1.jpg', name:'Colaboradores — Comisión por evento confirmado'},
    {key:'b2b-2.jpg', path:'images/b2b-2.jpg', name:'Colaboradores — Servicio exclusivo'},
    {key:'b2b-3.jpg', path:'images/b2b-3.jpg', name:'Colaboradores — Cero gestión y cero inversión'},
  ],
  bendito_lab: [
    {key:'b2b-1.jpg',      path:'images/b2b-1.jpg',      name:'Bendito Lab — Producto 1'},
    {key:'b2b-2.jpg',      path:'images/b2b-2.jpg',      name:'Bendito Lab — Producto 2'},
    {key:'b2b-3.jpg',      path:'images/b2b-3.jpg',      name:'Bendito Lab — Producto 3'},
    {key:'img-gorra.jpg',  path:'images/img-gorra.jpg',  name:'Bendito Lab — Ropa laboral e imagen corporativa'},
    {key:'img-neceser.jpg',path:'images/img-neceser.jpg',name:'Bendito Lab — Merchandising y regalos'},
    {key:'personalizacion.jpg', path:'images/personalizacion.jpg', name:'Bendito Lab — Soluciones personalizadas'},
    {key:'carrusel-1.jpg', path:'images/carrusel-1.jpg', name:'Bendito Lab — Carrusel Foto 1'},
    {key:'carrusel-2.jpg', path:'images/carrusel-2.jpg', name:'Bendito Lab — Carrusel Foto 2'},
    {key:'carrusel-3.jpg', path:'images/carrusel-3.jpg', name:'Bendito Lab — Carrusel Foto 3'},
    {key:'carrusel-4.jpg', path:'images/carrusel-4.jpg', name:'Bendito Lab — Carrusel Foto 4'},
    {key:'carrusel-5.jpg', path:'images/carrusel-5.jpg', name:'Bendito Lab — Carrusel Foto 5'},
    {key:'bl-foto-1.jpg', path:'images/bl-foto-1.jpg', name:'Bendito Lab — Foto camiseta "Rafa"'},
    {key:'bl-foto-2.jpg', path:'images/bl-foto-2.jpg', name:'Bendito Lab — Foto taller (workshop)'},
  ],
};

// ══ LOGIN ══════════════════════════════════════════════════
function toggleSidebar(){
  var sb = document.querySelector('.sidebar');
  var ov = document.getElementById('sidebar-overlay');
  var open = sb.classList.toggle('open');
  ov.style.display = open ? 'block' : 'none';
}

async function checkLogin(){
  var pwd=document.getElementById('pwd').value;
  var btn=document.querySelector('.login-btn');
  var err=document.getElementById('login-err');
  err.style.display='none';
  if(btn){btn.disabled=true;btn.textContent='Entrando…';}
  try{
    var ok=await BL_API.login(pwd);
    if(ok){
      document.getElementById('login').style.display='none';
      enterEditor();
    }else{
      err.textContent='Contraseña incorrecta';
      err.style.display='block';
      document.getElementById('pwd').value='';
    }
  }catch(e){
    err.textContent='Error de conexión: '+e.message;
    err.style.display='block';
  }finally{
    if(btn){btn.disabled=false;btn.textContent='ENTRAR →';}
  }
}

// Si ya hay una sesión válida (token guardado), saltar la pantalla de login.
(function(){
  if(BL_API.getToken()){
    document.addEventListener('DOMContentLoaded',function(){
      document.getElementById('login').style.display='none';
      enterEditor();
    });
  }
})();

// ══ EDITOR VISUAL (sidebar + página real en iframe, como Admin.dc.html) ═══
var EDITOR_PAGINAS = [
  {archivo:'portada.html',      nombre:'Portada',           color:'#E2704A'},
  {archivo:'bendito-lab.html',  nombre:'Bendito Lab',       color:'#93ACA7'},
  {archivo:'colaboradores.html',nombre:'Colaboradores',     color:'#2F8FEA'},
  {archivo:'dilo-bonito.html',  nombre:'Dilo Bonito',       color:'#B6A8DB'},
  {archivo:'faq.html',          nombre:'FAQ',               color:'#9AB791'},
  {archivo:'contacto.html',     nombre:'Contacto',          color:'#E2704A'},
  {archivo:'link-bio.html',     nombre:'Link Bio (móvil)',  color:'#E2704A'},
  {archivo:'area-clientes.html',nombre:'Área Clientes',     color:'#E2704A'},
];
var editorActiveIdx=0;

function enterEditor(){
  document.getElementById('app').style.display='none';
  document.getElementById('editor').style.display='flex';
  renderEditorSidebar();
  var params=new URLSearchParams(location.search);
  var next=params.get('next');
  if(next){ location.href=decodeURIComponent(next); return; }
  var startFile=params.get('pagina');
  var idx=startFile?EDITOR_PAGINAS.findIndex(function(p){return p.archivo===startFile;}):0;
  selectPagina(idx>=0?idx:0);
}

function renderEditorSidebar(){
  var c=document.getElementById('editor-pages');
  c.innerHTML='';
  EDITOR_PAGINAS.forEach(function(p,i){
    var btn=document.createElement('button');
    btn.className='navbtn';
    btn.textContent=p.nombre;
    btn.id='editor-nav-'+i;
    btn.onclick=function(){selectPagina(i);};
    c.appendChild(btn);
  });
}

function selectPagina(i){
  editorActiveIdx=i;
  var p=EDITOR_PAGINAS[i];
  EDITOR_PAGINAS.forEach(function(pp,ii){
    var btn=document.getElementById('editor-nav-'+ii);
    if(!btn)return;
    btn.style.background=ii===i?pp.color:'transparent';
    btn.style.color=ii===i?'#FBF4E9':'#17233F';
  });
  document.getElementById('editor-dot').style.background=p.color;
  document.getElementById('editor-pagename').textContent=p.nombre;
  document.getElementById('editor-frame').src=p.archivo+'?admin=1';
  document.getElementById('editor-open-tab').href=p.archivo;
}

function showPanelAvanzado(){
  document.getElementById('editor').style.display='none';
  document.getElementById('app').style.display='flex';
  init();
}

function backToEditor(){
  document.getElementById('app').style.display='none';
  document.getElementById('editor').style.display='flex';
}

function logoutAdmin(){
  BL_API.setToken(null);
  location.href='admin.html';
}

// ══ NAV ════════════════════════════════════════════════════
function show(id,el){
  if(window.innerWidth<=600){var sb=document.querySelector('.sidebar');if(sb&&sb.classList.contains('open'))toggleSidebar();}
  document.querySelectorAll('.panel').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.sb-item').forEach(function(s){s.classList.remove('active');});
  var p=document.getElementById('panel-'+id);
  if(p)p.classList.add('active');
  if(el)el.classList.add('active');
  if(id==='db-precios') loadPreciosPortal();
  if(id==='colecciones'){ cargarColecciones(); cargarMetaCatalogo(); }
}

// ══ DIRTY ══════════════════════════════════════════════════
function markDirty(){dirty=true;document.getElementById('dirty').classList.add('on');document.getElementById('saved').classList.remove('on');}

// ══ STORAGE ════════════════════════════════════════════════
function getData(){try{return JSON.parse(localStorage.getItem(STORE)||'{}');}catch(e){return{};}}
function setData(d){localStorage.setItem(STORE,JSON.stringify(d));}

var TEXT_IDS=['t-eyebrow','t-h1','t-sub','t-cta1','t-cta2','t-db-tag','t-db-title','t-db-desc','t-db-cta','t-bl-tag','t-bl-title','t-bl-desc','t-bl-cta','t-cot-title','t-redes-sub','dt-tag','dt-h1','dt-sub','dt-tel','dt-email','bt-tag','bt-h1','bt-sub','bt-ctat','bt-ctas','p-mini','p-intima','p-clasica','p-premium','e-hora','e-dis','e-nin','e-mon','e-max','e-km','gh-user','gh-repo'];

function loadAll(){
  var d=getData();
  TEXT_IDS.forEach(function(id){var el=document.getElementById(id);if(el&&d[id]!==undefined)el.value=d[id];});
  if(d.colores){Object.keys(d.colores).forEach(function(k){var el=document.getElementById('col-picker-'+k);var tex=document.getElementById('col-text-'+k);if(el)el.value=d.colores[k];if(tex)tex.value=d.colores[k];});}
  if(d.secciones)secciones=d.secciones;
  if(d.seccionesExtra)seccionesExtra=d.seccionesExtra;
  if(d.redes)redes=d.redes;
  if(d.productos)productos=d.productos;
  loadCalcPrecios();
  // Cargar precios de calculadora desde Supabase (prevalecen sobre localStorage)
  BL_API.dbGet({ tabla: 'calc_precios' })
    .then(function(d){
      var calc = d && d.data;
      if (calc && typeof calc === 'object' && Object.keys(calc).length) {
        var d2 = getData();
        d2.calcPrecios = calc;
        setData(d2);
        loadCalcPrecios();
        console.log('Precios calculadora cargados desde Supabase ✓');
      }
    })
    .catch(function(e){ console.warn('No se pudieron cargar precios desde Supabase:', e); });
  if(localStorage.getItem('bl-gh-token')){document.getElementById('gh-token').value='••••••••••••';document.getElementById('gh-token-2').value='••••••••••••';}
  renderSecciones();
  renderRedes();
  renderProductos();
  renderColorGrid();
  renderSecColorList();
  renderColorGrid();
}

function saveAll(){
  var d=getData();
  TEXT_IDS.forEach(function(id){var el=document.getElementById(id);if(el)d[id]=el.value;});
  // Colores
  var colores={};
  COLOR_DEFS.forEach(function(c){var el=document.getElementById('col-text-'+c.id);if(el)colores[c.id]=el.value;});
  d.colores=colores;
  d.secciones=secciones;
  d.seccionesExtra=seccionesExtra;
  d.redes=redes;
  d.productos=productos;
  // Precios calculadora
  d.calcPrecios = getCalcPrecios();
  setData(d);

  // Mandar datos a la portada si está abierta (postMessage)
  broadcastToPortada(buildPortadaData());

  // Guardar precios de calculadora en Supabase
  var calcP = getCalcPrecios();
  BL_API.dbPost({ accion: 'guardarCalcPrecios', datos: calcP }).then(function(d){
    if (d.ok) console.log('Precios calculadora guardados en Supabase ✓');
    else console.warn('Error guardando precios calculadora:', d.error);
  }).catch(function(e){ console.warn('Error Supabase calc-precios:', e); });

  dirty=false;
  document.getElementById('dirty').classList.remove('on');
  var ok=document.getElementById('saved');
  ok.classList.add('on');
  setTimeout(function(){ok.classList.remove('on');},2500);
}

function buildPortadaData(){
  var d=getData();
  var out={};
  // Textos
  var map={'p-eyebrow':'t-eyebrow','p-h1':'t-h1','p-sub':'t-sub','p-db-tag':'t-db-tag','p-db-title':'t-db-title','p-db-desc':'t-db-desc','p-db-cta':'t-db-cta','p-bl-tag':'t-bl-tag','p-bl-title':'t-bl-title','p-bl-desc':'t-bl-desc','p-bl-cta':'t-bl-cta','p-cot-title':'t-cot-title','p-redes-sub':'t-redes-sub'};
  Object.keys(map).forEach(function(pid){var el=document.getElementById(map[pid]);if(el&&el.value)out[pid]=el.value;});
  // Colores
  COLOR_DEFS.forEach(function(c){var el=document.getElementById('col-text-'+c.id);if(el&&el.value)out['color-'+c.id]=el.value;});
  // Secciones visibilidad
  secciones.forEach(function(s){out[s.id+'_visible']=s.visible;});
  // Redes
  out.redes=redes;
  // Estilos de sección
  var d2=getData();
  out.sec_styles = d2.sec_styles || {};
  return out;
}

function broadcastToPortada(data){
  // Intentar enviar a otras ventanas (si la portada está abierta)
  try{
    if(window.opener)window.opener.postMessage({type:'bl-update',data:data},'*');
  }catch(e){}
  // También guardar en localStorage para que la portada lo recoja al cargar
  localStorage.setItem('bl-portada-v1',JSON.stringify(data));
}

// ══ COLORES ════════════════════════════════════════════════
function renderColorGrid(){
  var d=getData();
  var colores=d.colores||{};
  var grid=document.getElementById('color-grid');
  grid.innerHTML='';
  COLOR_DEFS.forEach(function(c){
    var val=colores[c.id]||c.def;
    var row=document.createElement('div');
    row.className='color-row';
    row.innerHTML=
      '<input type="color" id="col-picker-'+c.id+'" value="'+val+'" data-action="sync-color" data-id="'+c.id+'">'+
      '<div class="color-info"><span class="color-name">'+c.name+'</span><input type="text" id="col-text-'+c.id+'" value="'+val+'" maxlength="9" data-action="sync-color-text" data-id="'+c.id+'" style="margin-top:4px;padding:4px 8px;border:1.5px solid #E0DDD6;font-family:monospace;font-size:12px;width:100%;outline:none;"></div>';
    grid.appendChild(row);
  });
}

function syncColor(id,val){
  var tex=document.getElementById('col-text-'+id);
  if(tex)tex.value=val;
  // Preview en vivo en esta ventana
  document.documentElement.style.setProperty('--'+id,val);
  markDirty();
}

function syncColorText(id,val){
  if(val.length===7&&val.startsWith('#')){
    var picker=document.getElementById('col-picker-'+id);
    if(picker)picker.value=val;
    document.documentElement.style.setProperty('--'+id,val);
    markDirty();
  }
}

function applyPreset(name){
  var p=PRESETS[name];
  if(!p)return;
  Object.keys(p).forEach(function(k){
    var picker=document.getElementById('col-picker-'+k);
    var tex=document.getElementById('col-text-'+k);
    if(picker)picker.value=p[k];
    if(tex)tex.value=p[k];
    document.documentElement.style.setProperty('--'+k,p[k]);
  });
  markDirty();
}

// ══ SECCIONES ══════════════════════════════════════════════
function renderSecciones(){
  var list=document.getElementById('secciones-list');
  list.innerHTML='';
  var all=secciones.concat(seccionesExtra);
  all.forEach(function(s,i){
    var card=document.createElement('div');
    card.className='sec-card';
    card.innerHTML=
      '<div class="sec-head" data-action="toggle-sec-card">'+
        '<span class="sec-handle">⠿</span>'+
        '<span style="font-size:18px;margin-right:4px;">'+s.icon+'</span>'+
        '<span class="sec-name">'+s.name+'</span>'+
        '<div class="sec-toggle">'+
          '<span style="font-size:11px;color:#888;">'+(s.visible?'Visible':'Oculta')+'</span>'+
          '<div class="toggle'+(s.visible?' on':'')+'" id="tog-'+s.id+'" data-action="toggle-sec" data-id="'+s.id+'"></div>'+
        '</div>'+
      '</div>'+
      (s.editable!==false?
      '<div class="sec-body">'+
        '<p style="font-size:12px;color:#aaa;margin-bottom:12px;">Esta sección se edita desde la pestaña <strong>Textos</strong>.</p>'+
        (i>=secciones.length?'<button data-action="remove-extra" data-i="'+( i-secciones.length)+'" style="background:#fff;border:1px solid #ddd;color:#C0392B;padding:6px 14px;cursor:pointer;font-size:12px;">✕ Eliminar sección</button>':'')
      +'</div>':'');
    list.appendChild(card);
  });
}

function toggleSecCard(head){
  var card=head.parentElement;
  card.classList.toggle('open');
}

function toggleSec(id,el){
  el.classList.toggle('on');
  var label=el.previousElementSibling;
  var visible=el.classList.contains('on');
  // Actualizar en secciones
  var all=secciones.concat(seccionesExtra);
  all.forEach(function(s){if(s.id===id)s.visible=visible;});
  if(label)label.textContent=visible?'Visible':'Oculta';
  markDirty();
}

function addSeccion(){
  var titulo=document.getElementById('new-sec-titulo').value.trim();
  var tipo=document.getElementById('new-sec-tipo').value;
  var bg=document.getElementById('new-sec-bg').value;
  if(!titulo){alert('Escribe un título para la sección.');return;}

  var icons={'texto':'📄','texto-imagen':'🖼️','grid3':'⚡','destacado':'⭐','banner':'📢'};
  var id='sec-extra-'+Date.now();
  seccionesExtra.push({id:id,name:titulo,icon:icons[tipo]||'📄',visible:true,editable:true,tipo:tipo,bg:bg,generada:true});

  // También hay que inyectarlo en la portada — guardar para que el bridge lo recoja
  document.getElementById('new-sec-titulo').value='';
  renderSecciones();
  markDirty();
  alert('Sección "'+titulo+'" añadida. Guarda y recarga la portada para verla. Para editar su contenido ve a la pestaña Textos.');
}

function removeExtra(idx){
  if(!confirm('¿Eliminar esta sección?'))return;
  seccionesExtra.splice(idx,1);
  renderSecciones();
  markDirty();
}

// ══ REDES ══════════════════════════════════════════════════
function renderRedes(){
  var list=document.getElementById('redes-list');
  list.innerHTML='';
  redes.forEach(function(r,i){
    var row=document.createElement('div');
    row.className='red-row';
    row.innerHTML=
      '<div class="red-icon-big">'+r.icon+'</div>'+
      '<input type="text" value="'+(r.name||'')+'" placeholder="Nombre" style="padding:8px;border:1.5px solid #E0DDD6;font-size:13px;" data-action="upd-red-name" data-i="'+i+'">'+
      '<input type="text" value="'+(r.handle||'')+'" placeholder="@handle" style="padding:8px;border:1.5px solid #E0DDD6;font-size:13px;" data-action="upd-red-handle" data-i="'+i+'">'+
      '<input type="text" value="'+(r.href||'')+'" placeholder="https://..." style="padding:8px;border:1.5px solid #E0DDD6;font-size:12px;font-family:monospace;" data-action="upd-red-href" data-i="'+i+'">'+
      '<div class="red-toggle-sm'+(r.visible?' on':'')+'" data-action="toggle-red" data-i="'+i+'"></div>';
    list.appendChild(row);
  });
}

function updRedName(i,v){ redes[i].name=v; markDirty(); }
function updRedHandle(i,v){ redes[i].handle=v; markDirty(); }
function updRedHref(i,v){ redes[i].href=v; markDirty(); }
function toggleRed(i,el){
  el.classList.toggle('on');
  redes[i].visible=el.classList.contains('on');
  markDirty();
}

// ══ PRODUCTOS ══════════════════════════════════════════════
function renderProductos(){
  var c=document.getElementById('productos-list');
  if(!c)return;
  c.innerHTML='';
  productos.forEach(function(p,i){
    var row=document.createElement('div');
    row.style.cssText='display:grid;grid-template-columns:1fr 2fr 100px 32px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #F0EDE6;';
    row.innerHTML=
      '<input type="text" value="'+(p.nombre||'')+'" placeholder="Nombre" style="padding:8px;border:1.5px solid #E0DDD6;font-size:13px;" data-action="upd-producto-nombre" data-i="'+i+'">'+
      '<input type="text" value="'+(p.desc||'')+'" placeholder="Descripción" style="padding:8px;border:1.5px solid #E0DDD6;font-size:13px;" data-action="upd-producto-desc" data-i="'+i+'">'+
      '<input type="text" value="'+(p.precio||'')+'" placeholder="Precio" style="padding:8px;border:1.5px solid #E0DDD6;font-size:13px;" data-action="upd-producto-precio" data-i="'+i+'">'+
      '<button data-action="rm-producto" data-i="'+i+'" style="background:#fff;border:1px solid #ddd;color:#bbb;cursor:pointer;height:34px;font-size:16px;">×</button>';
    c.appendChild(row);
  });
}
function addProducto(){productos.push({nombre:'',desc:'',precio:''});renderProductos();markDirty();}
function updProductoNombre(i,v){ productos[i].nombre=v; markDirty(); }
function updProductoDesc(i,v){ productos[i].desc=v; markDirty(); }
function updProductoPrecio(i,v){ productos[i].precio=v; markDirty(); }
function rmProducto(i){ productos.splice(i,1); renderProductos(); markDirty(); }

// ══ IMÁGENES ═══════════════════════════════════════════════
function renderImages(grpId,imgs){
  var c=document.getElementById('grp-'+grpId);
  if(!c)return;
  c.innerHTML='';
  imgs.forEach(function(img,i){
    var url=IMAGE_CONTENT[img.path]||('/'+img.path);
    var uid=img.key.replace(/[^a-z0-9]/gi,'-');
    var div=document.createElement('div');
    div.className='img-card';
    div.innerHTML=
      '<div class="img-preview" id="prev-'+uid+'" style="cursor:zoom-in;" data-action="ver-img-grande" data-url="'+url+'">'+
        '<img src="'+url+'?t='+Date.now()+'" alt="'+img.name+'" class="img-fallback">'+
      '</div>'+
      '<div class="img-info">'+
        '<div class="img-name">'+img.name+'</div>'+
        '<div class="img-key">'+img.path+'</div>'+
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">'+
          '<label class="img-btn" for="file-'+uid+'">📤 Cambiar</label>'+
          '<input type="file" id="file-'+uid+'" accept="image/*" data-action="upload-img" data-path="'+img.path+'" data-uid="'+uid+'">'+
          '<button data-action="eliminar-img" data-grp="'+grpId+'" data-i="'+i+'" data-path="'+img.path+'" data-uid="'+uid+'" style="background:#FFEBEE;color:#C0392B;border:1px solid #FFCDD2;padding:6px 12px;font-size:11px;cursor:pointer;font-family:\'Inter\',sans-serif;font-weight:700;">🗑 Quitar</button>'+
        '</div>'+
        '<div class="prog-wrap" id="prog-'+uid+'"><div class="prog-bar" id="pb-'+uid+'"></div></div>'+
        '<div class="img-status" id="st-'+uid+'"></div>'+
      '</div>';
    c.appendChild(div);
  });
  c.querySelectorAll('img.img-fallback').forEach(function(img){
    img.addEventListener('error', function(){ img.parentElement.innerHTML = 'Sin imagen'; });
  });
  // Añadir nueva imagen
  var addDiv=document.createElement('div');
  addDiv.style.cssText='border:2px dashed #E3DFCF;padding:20px;text-align:center;margin-top:8px;background:#FAFAF8;';
  addDiv.innerHTML=
    '<p style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;margin-bottom:10px;">Añadir nueva foto</p>'+
    '<label for="file-add-'+grpId+'" style="background:#17233F;color:#E8C24A;font-family:\'Helvetica World\',\'Helvetica Neue\',Helvetica,Arial,sans-serif;font-weight:900;font-size:11px;letter-spacing:1px;padding:8px 18px;cursor:pointer;display:inline-block;">+ AÑADIR FOTO</label>'+
    '<input type="file" id="file-add-'+grpId+'" accept="image/*" style="display:none" data-action="anadir-img" data-grp="'+grpId+'">';
  c.appendChild(addDiv);
}

function verImgGrande(url){
  var o=document.getElementById('img-overlay');
  if(!o){
    o=document.createElement('div');
    o.id='img-overlay';
    o.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    o.onclick=function(){this.style.display='none';};
    var img=document.createElement('img');
    img.id='img-overlay-img';
    img.style.cssText='max-width:95vw;max-height:95vh;object-fit:contain;';
    o.appendChild(img);
    document.body.appendChild(o);
  }
  document.getElementById('img-overlay-img').src=url;
  o.style.display='flex';
}

// ══ IMÁGENES — backend real (Vercel Blob vía /api/upload-image) ═══════════

// Redimensiona/comprime en el navegador antes de subir: evita fotos de
// móvil de varios MB y se mantiene bajo el límite de 4.5MB de body que
// impone Vercel a las funciones serverless.
async function resizeImageToDataUrl(file,maxDim,quality){
  maxDim=maxDim||1600;quality=quality||0.82;
  var bitmap=await createImageBitmap(file);
  try{
    var scale=Math.min(1,maxDim/Math.max(bitmap.width,bitmap.height));
    var w=Math.max(1,Math.round(bitmap.width*scale));
    var h=Math.max(1,Math.round(bitmap.height*scale));
    var canvas=document.createElement('canvas');
    canvas.width=w;canvas.height=h;
    canvas.getContext('2d').drawImage(bitmap,0,0,w,h);
    var q=quality;
    var dataUrl=canvas.toDataURL('image/webp',q);
    // Si aun así pesa demasiado, bajar calidad progresivamente.
    while(dataUrl.length>3.6*1024*1024 && q>0.35){
      q-=0.1;
      dataUrl=canvas.toDataURL('image/webp',q);
    }
    return dataUrl;
  }finally{
    if(bitmap.close)bitmap.close();
  }
}

async function subirImagenSlot(slotPath,file){
  var dataUrl=await resizeImageToDataUrl(file);
  var r=await fetch('/api/upload-image',{
    method:'POST',
    headers:BL_API.authHeaders(),
    body:JSON.stringify({path:slotPath,dataUrl:dataUrl})
  });
  var d=await r.json();
  if(!d.ok)throw new Error(d.error||'Error al subir la imagen');
  return d.url;
}

async function eliminarImg(grpId,idx,filePath,uid){
  if(!confirm('¿Quitar esta foto?\n\nSe borrará la sustitución subida desde el admin y volverá a mostrarse la foto original del sitio.'))return;
  var st=document.getElementById('st-'+uid);
  if(st){st.style.display='block';st.style.color='#888';st.textContent='Eliminando...';}
  try{
    var r=await fetch('/api/delete-image',{
      method:'POST',
      headers:BL_API.authHeaders(),
      body:JSON.stringify({path:filePath})
    });
    var d=await r.json();
    if(!d.ok)throw new Error(d.error||'Error al eliminar');
    delete IMAGE_CONTENT[filePath];
    renderImages(grpId,IMG_GROUPS[grpId]);
    showToast('Imagen restaurada a la original ✓');
  }catch(err){
    if(st){st.style.color='#C0392B';st.textContent='Error: '+err.message;}
    showToast('Error: '+err.message);
  }
}

async function anadirImg(input,grpId){
  var file=input.files[0];
  if(!file)return;
  var num=IMG_GROUPS[grpId]?IMG_GROUPS[grpId].length+1:1;
  var newKey=grpId.replace(/_/g,'-')+'-extra-'+num+'-'+Date.now();
  var newPath=(grpId==='logos'?'':'images/')+newKey;
  var newName=grpId.replace(/_/g,' ')+' — Foto '+num;
  showToast('Subiendo '+file.name+'...');
  try{
    var url=await subirImagenSlot(newPath,file);
    IMAGE_CONTENT[newPath]=url;
    if(!IMG_GROUPS[grpId])IMG_GROUPS[grpId]=[];
    IMG_GROUPS[grpId].push({key:newKey,path:newPath,name:newName});
    renderImages(grpId,IMG_GROUPS[grpId]);
    showToast('✓ Imagen añadida');
  }catch(err){showToast('Error: '+err.message);}
  input.value='';
}

async function uploadImg(input,filePath,uid){
  var file=input.files[0];
  if(!file)return;
  var st=document.getElementById('st-'+uid);
  var prog=document.getElementById('prog-'+uid);
  var pb=document.getElementById('pb-'+uid);
  st.style.display='block';st.style.color='#888';st.textContent='Procesando imagen...';
  prog.style.display='block';pb.style.width='30%';
  try{
    pb.style.width='60%';st.textContent='Subiendo...';
    var url=await subirImagenSlot(filePath,file);
    IMAGE_CONTENT[filePath]=url;
    pb.style.width='100%';
    st.style.color='#27AE60';st.textContent='✓ Subida';
    var img=document.querySelector('#prev-'+uid+' img');
    if(img)img.src=url+'?t='+Date.now();
  }catch(err){
    st.style.color='#C0392B';st.textContent='✗ Error: '+err.message;
  }
  setTimeout(function(){prog.style.display='none';pb.style.width='0%';},3000);
}

// ══ CONTENIDO WEB ═══════════════════════════════════════════
var _webContenido = {}; // { pagina: { clave: valor } }
var _webDirty = false;
var _webPagina = 'portada';

var WEB_CAMPOS = {
  portada: [
    { sec: 'Hero', campos: [
      { key: 'hero.eyebrow', label: 'Frase pequeña', tipo: 'input', hint: 'Texto encima del título' },
      { key: 'hero.h1', label: 'Título principal', tipo: 'textarea', hint: 'En mayúsculas. Usa Enter para saltos de línea' },
      { key: 'hero.sub', label: 'Subtítulo', tipo: 'textarea', hint: 'Descripción breve' },
      { key: 'hero.cta1', label: 'Botón principal', tipo: 'input' },
      { key: 'hero.cta2', label: 'Botón secundario', tipo: 'input' }
    ]},
    { sec: 'Bloque Dilo Bonito', campos: [
      { key: 'db.tag', label: 'Etiqueta', tipo: 'input' },
      { key: 'db.titulo', label: 'Título', tipo: 'input' },
      { key: 'db.desc', label: 'Descripción', tipo: 'textarea' },
      { key: 'db.cta', label: 'Botón', tipo: 'input' }
    ]},
    { sec: 'Bloque Bendito Lab', campos: [
      { key: 'bl.tag', label: 'Etiqueta', tipo: 'input' },
      { key: 'bl.titulo', label: 'Título', tipo: 'input' },
      { key: 'bl.desc', label: 'Descripción', tipo: 'textarea' },
      { key: 'bl.cta', label: 'Botón', tipo: 'input' }
    ]},
    { sec: 'Formulario contacto', campos: [
      { key: 'cot.titulo', label: 'Título', tipo: 'input' }
    ]},
    { sec: 'Colores', campos: [
      { key: 'colores.cream', label: 'Fondo crema', tipo: 'color' },
      { key: 'colores.deep', label: 'Azul marino', tipo: 'color' },
      { key: 'colores.sunshine', label: 'Amarillo', tipo: 'color' },
      { key: 'colores.poppy', label: 'Naranja', tipo: 'color' }
    ]},
    { sec: 'Tipografía', campos: [
      { key: 'tipografia.titulos', label: 'Fuente títulos', tipo: 'select', opciones: ['League Spartan','Playfair Display','Montserrat','Oswald','Raleway'] },
      { key: 'tipografia.texto', label: 'Fuente texto', tipo: 'select', opciones: ['Lato','Open Sans','Roboto','Nunito','Source Sans Pro'] }
    ]}
  ],
  'dilo-bonito': [
    { sec: 'Hero', campos: [
      { key: 'hero.tag', label: 'Etiqueta', tipo: 'input' },
      { key: 'hero.h1', label: 'Título', tipo: 'textarea' },
      { key: 'hero.sub', label: 'Subtítulo', tipo: 'textarea' },
      { key: 'hero.tel', label: 'Teléfono', tipo: 'input' },
      { key: 'hero.email', label: 'Email', tipo: 'input' }
    ]},
    { sec: 'Servicio 1 — DTF', campos: [
      { key: 'srv1.titulo', label: 'Título', tipo: 'input' },
      { key: 'srv1.desc', label: 'Descripción', tipo: 'textarea' }
    ]},
    { sec: 'Servicio 2 — Seating Plan', campos: [
      { key: 'srv2.titulo', label: 'Título', tipo: 'input' },
      { key: 'srv2.desc', label: 'Descripción', tipo: 'textarea' }
    ]},
    { sec: 'Servicio 3 — Vasitos', campos: [
      { key: 'srv3.titulo', label: 'Título', tipo: 'input' },
      { key: 'srv3.desc', label: 'Descripción', tipo: 'textarea' }
    ]},
    { sec: 'Servicio 4 — Máquina Gancho', campos: [
      { key: 'srv4.titulo', label: 'Título', tipo: 'input' },
      { key: 'srv4.desc', label: 'Descripción', tipo: 'textarea' }
    ]},
    { sec: 'Servicio 5 — Merch Corner', campos: [
      { key: 'srv5.titulo', label: 'Título', tipo: 'input' },
      { key: 'srv5.desc', label: 'Descripción', tipo: 'textarea' }
    ]},
    { sec: 'Precios packs', campos: [
      { key: 'pack.mini.precio', label: 'Pack MINI (€)', tipo: 'input' },
      { key: 'pack.intima.precio', label: 'Pack ÍNTIMA (€)', tipo: 'input' },
      { key: 'pack.clasica.precio', label: 'Pack CLÁSICA (€)', tipo: 'input' },
      { key: 'pack.premium.precio', label: 'Pack PREMIUM (€)', tipo: 'input' }
    ]}
  ],
  'bendito-lab': [
    { sec: 'Hero', campos: [
      { key: 'hero.h1', label: 'Título', tipo: 'textarea' },
      { key: 'hero.sub', label: 'Subtítulo', tipo: 'textarea' }
    ]},
    { sec: 'Secciones', campos: [
      { key: 'sec1.titulo', label: 'Título sección 1', tipo: 'input' },
      { key: 'sec2.titulo', label: 'Título sección 2', tipo: 'input' },
      { key: 'sec3.titulo', label: 'Título sección 3', tipo: 'input' },
      { key: 'sec4.titulo', label: 'Título sección 4', tipo: 'input' }
    ]}
  ],
  colaboradores: [
    { sec: 'Hero', campos: [
      { key: 'hero.h1', label: 'Título', tipo: 'textarea' },
      { key: 'hero.sub', label: 'Subtítulo', tipo: 'textarea' }
    ]},
    { sec: 'Secciones', campos: [
      { key: 'sec1.titulo', label: 'Cómo funciona — título', tipo: 'input' },
      { key: 'sec2.titulo', label: 'Ventajas — título', tipo: 'input' },
      { key: 'cta.titulo', label: 'CTA — título', tipo: 'input' },
      { key: 'cta.sub', label: 'CTA — subtítulo', tipo: 'textarea' }
    ]}
  ]
};

async function webCargarPagina(pagina) {
  _webPagina = pagina;
  document.querySelectorAll('.web-page-tab').forEach(function(t){ t.classList.toggle('active', t.dataset.page === pagina); });
  if (!_webContenido[pagina]) {
    document.getElementById('web-fields').innerHTML = '<p style="color:#888;padding:20px;">Cargando...</p>';
    try {
      var d = await BL_API.gsWeb({ web: pagina, t: Date.now() });
      _webContenido[pagina] = d.data || {};
    } catch(e) { _webContenido[pagina] = {}; }
  }
  webRenderCampos();
}

function webRenderCampos() {
  var secciones = WEB_CAMPOS[_webPagina] || [];
  var data = _webContenido[_webPagina] || {};
  var html = '';

  secciones.forEach(function(sec) {
    html += '<div style="margin-bottom:20px;">';
    html += '<div class="card-title" style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#999;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #F0EDE6;">'+sec.sec+'</div>';
    sec.campos.forEach(function(c) {
      var val = data[c.key] || '';
      html += '<div class="field" style="margin-bottom:10px;">';
      html += '<label style="font-size:11px;font-weight:700;color:#666;display:block;margin-bottom:4px;">'+c.label+'</label>';
      if (c.tipo === 'textarea') {
        html += '<textarea data-action="web-campo-change" data-key="'+c.key+'" style="width:100%;padding:8px;border:1.5px solid #E0DDD6;font-size:13px;resize:vertical;min-height:60px;font-family:inherit;">'+val+'</textarea>';
      } else if (c.tipo === 'color') {
        html += '<div style="display:flex;gap:8px;align-items:center;">';
        html += '<input type="color" value="'+(val||'#000000')+'" data-action="web-campo-change" data-key="'+c.key+'" style="width:48px;height:36px;padding:2px;border:1.5px solid #E0DDD6;cursor:pointer;">';
        html += '<input type="text" value="'+val+'" data-action="web-campo-change" data-key="'+c.key+'" style="width:100px;padding:8px;border:1.5px solid #E0DDD6;font-size:13px;">';
        html += '</div>';
      } else if (c.tipo === 'select') {
        html += '<select data-action="web-campo-change" data-key="'+c.key+'" style="width:100%;padding:8px;border:1.5px solid #E0DDD6;font-size:13px;">';
        (c.opciones||[]).forEach(function(op) {
          html += '<option value="'+op+'"'+(val===op?' selected':'')+'>'+op+'</option>';
        });
        html += '</select>';
      } else {
        html += '<input type="text" value="'+val+'" data-action="web-campo-change" data-key="'+c.key+'" style="width:100%;padding:8px;border:1.5px solid #E0DDD6;font-size:13px;">';
      }
      if (c.hint) html += '<div style="font-size:11px;color:#aaa;margin-top:3px;">'+c.hint+'</div>';
      html += '</div>';
    });
    html += '</div>';
  });

  document.getElementById('web-fields').innerHTML = html;
}

function webCampoChange(key, valor) {
  if (!_webContenido[_webPagina]) _webContenido[_webPagina] = {};
  _webContenido[_webPagina][key] = valor;
  _webDirty = true;
  document.getElementById('web-status').textContent = '● Cambios sin guardar';
  document.getElementById('web-status').style.color = '#E2704A';
}

async function webGuardar() {
  var btn = document.getElementById('web-save-btn');
  btn.textContent = 'Guardando...'; btn.disabled = true;
  try {
    var d = await BL_API.gsPost('web', { accion: 'guardarContenidoWeb', pagina: _webPagina, contenido: _webContenido[_webPagina] });
    if (d.ok) {
      _webDirty = false;
      document.getElementById('web-status').textContent = '✓ Guardado en Sheets';
      document.getElementById('web-status').style.color = '#27AE60';
      setTimeout(function(){ document.getElementById('web-status').textContent = ''; }, 3000);
    } else throw new Error(d.error);
  } catch(e) {
    document.getElementById('web-status').textContent = '✗ Error: ' + e.message;
    document.getElementById('web-status').style.color = '#C0392B';
  }
  btn.textContent = '💾 Guardar'; btn.disabled = false;
}
function saveToken(){var v=document.getElementById('gh-token').value;if(v&&!v.startsWith('••')){localStorage.setItem('bl-gh-token',v);document.getElementById('gh-token').value='••••••••••••';var ok=document.getElementById('tok-ok');ok.style.display='inline';setTimeout(function(){ok.style.display='none';},2000);}}
function saveToken2(){var v=document.getElementById('gh-token-2').value;if(v&&!v.startsWith('••')){localStorage.setItem('bl-gh-token',v);document.getElementById('gh-token-2').value='••••••••••••';var ok=document.getElementById('tok-ok-2');ok.style.display='inline';setTimeout(function(){ok.style.display='none';},2000);}}

// ══ INIT ═════════════════════════════════════════════════════
var IMAGE_CONTENT = {}; // slot path -> URL en Vercel Blob (sustituciones subidas desde el admin)

function loadImageContent(){
  return fetch('/api/content',{cache:'no-store'})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(d){IMAGE_CONTENT=(d&&d.images)||{};})
    .catch(function(){IMAGE_CONTENT={};});
}

function init(){
  loadAll();
  // Imágenes — primero el mapa de sustituciones reales, luego renderizar
  loadImageContent().then(function(){
    Object.keys(IMG_GROUPS).forEach(function(g){renderImages(g,IMG_GROUPS[g]);});
  });
  // Colores
  renderColorGrid();
  renderSecColorList();
  // Secciones
  renderSecciones();
  // Productos
  renderProductos();
}

document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();saveAll();}});

// ══ CALCULADORA — PRECIOS ══════════════════════════════════
var CALC_FIELDS = [
  'cp-321-ancho','cp-321-alto','cp-321-envio',
  'cp-dtfbcn-ancho','cp-dtfbcn-alto','cp-dtfbcn-precio','cp-dtfbcn-envio','cp-dtfbcn-gratis',
  'cp-tudtf-ancho','cp-tudtf-alto','cp-tudtf-precio','cp-tudtf-envio','cp-tudtf-gratis',
  'cp-dtfrap-ancho','cp-dtfrap-alto','cp-dtfrap-precio',
  'cp-vin-ancho','cp-vin-largo','cp-vin-precio',
  'ct-bord-puntada','ct-bord-manip','ct-bord-picaje','ct-bord-color',
  'ct-laser-maq','ct-laser-mo',
  'cm-margen','cm-iva-compra','cm-iva-venta',
  'cm-envio-bl','cm-envio-gratis',
  'cm-dto-1','cm-dto-2','cm-dto-3','cm-dto-4','cm-dto-5'
];

function getCalcPrecios() {
  var out = {};
  CALC_FIELDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) out[id] = el.value;
  });
  return out;
}

function loadCalcPrecios() {
  var d = getData();
  var precios = d.calcPrecios || {};
  CALC_FIELDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el && precios[id] !== undefined) el.value = precios[id];
  });
}


// ─── DB DISEÑO CUSTOMIZER ───
const DB_DEFAULTS = {
  '--cream':'#F4F1E6','--deep':'#17233F','--captain':'#2F8FEA',
  '--baby':'#93ACA7','--sunshine':'#E8C24A','--rose':'#E3A29C','--poppy':'#E2704A'
};
function dbApplyColor(input) {
  localStorage.setItem('db-color-' + input.dataset.var, input.value);
  // Guardar también en Sheets para que la web lo lea
  var key = 'colores.' + input.dataset.var.replace('--','');
  var obj = {};
  obj[key] = input.value;
  BL_API.gsPost('web', { accion: 'guardarContenidoWeb', pagina: 'portada', contenido: obj })
    .then(function(d){ if(d.ok) console.log('Color guardado en Sheets:', key, input.value); })
    .catch(function(e){ console.warn('Error guardando color:', e); });
}
function dbApplyFont(type, value) {
  localStorage.setItem('db-font-' + type, value);
}
function dbExportCSS() {
  let css = ':root {\n';
  Object.keys(DB_DEFAULTS).forEach(function(k) {
    const saved = localStorage.getItem('db-color-' + k);
    if (saved) css += '  ' + k + ': ' + saved + ';\n';
  });
  css += '}';
  const area = document.getElementById('db-code-area');
  area.value = css;
  area.style.display = 'block';
  navigator.clipboard.writeText(css).catch(function(){});
  const msg = document.getElementById('db-saved-msg');
  msg.style.display = 'block';
  setTimeout(function(){ msg.style.display='none'; area.style.display='none'; }, 4000);
}
function dbResetAll() {
  Object.keys(DB_DEFAULTS).forEach(function(k){ localStorage.removeItem('db-color-' + k); });
  ['title','body'].forEach(function(t){ localStorage.removeItem('db-font-' + t); });
  alert('Restaurado. Recarga la página de Dilo Bonito para ver los cambios.');
}


// ══ CARRUSEL DILO BONITO ════════════════════════════════════
// Renderizar con drag-and-drop para reordenar
function renderCarruselDB() {
  var c = document.getElementById('grp-db_carrusel');
  if (!c) return;
  var imgs = IMG_GROUPS['db_carrusel'] || [];
  c.innerHTML = '';

  imgs.forEach(function(img, i) {
    var url = '/' + img.path;
    var uid = 'dbc-' + i;
    var div = document.createElement('div');
    div.className = 'img-card';
    div.draggable = true;
    div.dataset.idx = i;
    div.style.cssText = 'border:2px solid transparent;transition:border .2s;cursor:grab;';
    div.addEventListener('dragstart', function(e){ dbcDragStart(e, i); });
    div.addEventListener('dragover', function(e){ dbcDragOver(e); });
    div.addEventListener('drop', function(e){ dbcDrop(e, i); });
    div.addEventListener('dragleave', function(){ div.style.borderColor='transparent'; });
    div.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:#FAFAF8;border:1px solid #E0DDD6;margin-bottom:6px;">' +
        '<span style="font-size:20px;cursor:grab;color:#aaa;">⠿</span>' +
        '<img src="' + url + '?t=' + Date.now() + '" style="width:80px;height:60px;object-fit:cover;border:1px solid #ddd;" class="img-hide-on-error">' +
        '<div style="flex:1;">' +
          '<div style="font-weight:700;font-size:13px;color:#17233F;">' + (i+1) + '. ' + img.name + '</div>' +
          '<div style="font-size:11px;color:#888;">' + img.path + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;">' +
          '<label style="background:#17233F;color:#E8C24A;font-weight:700;font-size:11px;letter-spacing:1px;padding:6px 12px;cursor:pointer;" for="file-dbc-' + i + '">📤 Cambiar</label>' +
          '<input type="file" id="file-dbc-' + i + '" accept="image/*" style="display:none" data-path="' + img.path + '" data-grp="dbc-' + i + '" data-action="upload-img-data">' +
          '<button data-action="dbc-eliminar" data-i="' + i + '" style="background:#FFEBEE;color:#C0392B;border:1px solid #FFCDD2;padding:6px 12px;font-size:11px;cursor:pointer;font-weight:700;">🗑</button>' +
        '</div>' +
      '</div>';
    c.appendChild(div);
  });
  c.querySelectorAll('img.img-hide-on-error').forEach(function(img){
    img.addEventListener('error', function(){ img.style.display='none'; });
  });

  // Añadir nueva foto
  var addDiv = document.createElement('div');
  addDiv.innerHTML =
    '<div style="border:2px dashed #E3DFCF;padding:16px;text-align:center;background:#FAFAF8;">' +
      '<label for="file-add-db_carrusel" style="background:#17233F;color:#E8C24A;font-family:\'Helvetica World\',\'Helvetica Neue\',Helvetica,Arial,sans-serif;font-weight:900;font-size:11px;letter-spacing:1px;padding:8px 18px;cursor:pointer;display:inline-block;">+ AÑADIR FOTO AL CARRUSEL</label>' +
      '<input type="file" id="file-add-db_carrusel" accept="image/*" style="display:none" data-grp="db_carrusel" data-action="anadir-img-data">' +
    '</div>';
  c.appendChild(addDiv);
}

var dbcDragging = null;
function dbcDragStart(e, idx) { dbcDragging = idx; e.target.style.opacity = '0.5'; }
function dbcDragOver(e) { e.preventDefault(); e.currentTarget.style.borderColor = '#E8C24A'; }
function dbcDrop(e, idx) {
  e.preventDefault();
  e.currentTarget.style.borderColor = 'transparent';
  if (dbcDragging === null || dbcDragging === idx) return;
  var imgs = IMG_GROUPS['db_carrusel'];
  var moved = imgs.splice(dbcDragging, 1)[0];
  imgs.splice(idx, 0, moved);
  dbcDragging = null;
  renderCarruselDB();
  showToast('Orden actualizado — pulsa "Publicar" para aplicarlo');
}
function dbcEliminar(idx) {
  if (!confirm('¿Quitar esta foto del carrusel?')) return;
  IMG_GROUPS['db_carrusel'].splice(idx, 1);
  renderCarruselDB();
  showToast('Foto quitada — pulsa "Publicar" para aplicarlo');
}

async function publicarCarruselDB() {
  var token = localStorage.getItem('bl-gh-token');
  if (!token) { alert('Añade el token de GitHub en Ajustes.'); return; }
  var imgs = IMG_GROUPS['db_carrusel'];
  if (!imgs || imgs.length === 0) { alert('No hay fotos en el carrusel.'); return; }

  // Leer dilo-bonito.html actual
  showToast('Publicando carrusel...');
  try {
    var r = await fetch('https://api.github.com/repos/contactobenditolab-ship-it/dossier-dilo-bonito/contents/dilo-bonito.html',
      { headers: { 'Authorization': 'token ' + token, 'User-Agent': 'BenditoAdmin' } });
    var fd = await r.json();
    var html = atob(fd.content.replace(/\n/g,''));

    // Generar nuevo HTML del carrusel
    var slidesHtml = imgs.map(function(img, i) {
      return '    <div class="carousel-slide"><img src="' + img.path + '" alt="Dilo Bonito ' + (i+1) + '" loading="' + (i===0?'eager':'lazy') + '"></div>';
    }).join('\n');
    var dotsHtml = imgs.map(function(img, i) {
      return '    <button' + (i===0?' class="active"':'') + ' data-idx="' + i + '"></button>';
    }).join('\n');

    var newCarrusel =
      '<!-- ── CARRUSEL ── -->' +
      '<div id="carousel"><div id="carousel-track">' +
      slidesHtml +
      '</div>' +
      '<button class="carousel-arrow prev" onclick="carouselPrev()">&#8592;</button>' +
      '<button class="carousel-arrow next" onclick="carouselNext()">&#8594;</button>' +
      '<div id="carousel-dots">' + dotsHtml + '</div></div>';

    // Reemplazar el bloque carrusel
    var carStart = html.indexOf('<!-- ── CARRUSEL ── -->');
    var carEnd = html.indexOf('</div>', html.indexOf('id="carousel-dots"')) + 6;
    if (carStart === -1) { showToast('Error: no se encontró el carrusel en dilo-bonito.html'); return; }
    html = html.substring(0, carStart) + newCarrusel + html.substring(carEnd);

    // Actualizar script dots count
    var newDots = 'var dots = document.querySelectorAll("#carousel-dots button");\n' +
      '  var slides = document.querySelectorAll(".carousel-slide");\n' +
      '  var n = ' + imgs.length + ';';
    html = html.replace(/var dots = document\.querySelectorAll\('[^']+'\);\s*var slides[^;]+;\s*var n = \d+;/, newDots);

    // Subir
    var b64 = btoa(unescape(encodeURIComponent(html)));
    var put = await fetch('https://api.github.com/repos/contactobenditolab-ship-it/dossier-dilo-bonito/contents/dilo-bonito.html', {
      method: 'PUT',
      headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json', 'User-Agent': 'BenditoAdmin' },
      body: JSON.stringify({ message: 'Admin: actualizar carrusel Dilo Bonito', content: b64, sha: fd.sha })
    });
    if (!put.ok) throw new Error((await put.json()).message);
    showToast('✓ Carrusel publicado. Visible en ~30s');
  } catch(err) {
    showToast('Error: ' + err.message);
  }
}

// ══ BANNERS PERSONALIZADOS ══════════════════════════════════
var BANNERS = JSON.parse(localStorage.getItem('bl-banners') || '[]');

function renderBanners() {
  var c = document.getElementById('banners-list');
  if (!c) return;
  if (BANNERS.length === 0) {
    c.innerHTML = '<p style="font-size:12px;color:#aaa;padding:8px 0;">No hay banners creados aún.</p>';
    return;
  }
  c.innerHTML = '';
  BANNERS.forEach(function(b, i) {
    var div = document.createElement('div');
    div.style.cssText = 'border:1px solid #E0DDD6;padding:16px;margin-bottom:12px;background:#FAFAF8;';
    div.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">' +
        '<div style="flex:1;">' +
          '<div style="font-weight:700;font-size:14px;color:#17233F;margin-bottom:4px;">' + (b.nombre || 'Banner ' + (i+1)) + '</div>' +
          '<div style="font-size:11px;color:#888;">Página: ' + (b.pagina || '—') + ' · Altura: ' + (b.altura || '400') + 'px</div>' +
          (b.imagen ? '<div style="font-size:11px;color:#27AE60;margin-top:2px;">✓ Con imagen</div>' : '<div style="font-size:11px;color:#E67E22;">⚠ Sin imagen</div>') +
        '</div>' +
        '<div style="display:flex;gap:6px;">' +
          '<button data-action="editar-banner" data-i="' + i + '" style="background:#17233F;color:#E8C24A;border:none;padding:8px 14px;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:1px;">✏️ EDITAR</button>' +
          '<button data-action="ver-codigo-banner" data-i="' + i + '" style="background:#F4F1E6;color:#17233F;border:1.5px solid #17233F;padding:8px 14px;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:1px;">📋 CÓDIGO</button>' +
          '<button data-action="eliminar-banner" data-i="' + i + '" style="background:#FFEBEE;color:#C0392B;border:1px solid #FFCDD2;padding:8px 14px;font-size:11px;font-weight:700;cursor:pointer;">🗑</button>' +
        '</div>' +
      '</div>';
    c.appendChild(div);
  });
}

function crearBanner() {
  var nombre = prompt('Nombre del banner (ej: Banner hero Dilo Bonito):');
  if (!nombre) return;
  var pagina = prompt('¿En qué página va? (portada / dilo-bonito / bendito-lab / colaboradores):', 'dilo-bonito');
  var altura = prompt('Altura en px (ej: 400 para medio, 600 para grande, 200 para pequeño):', '400');
  BANNERS.push({ nombre: nombre, pagina: pagina || 'dilo-bonito', altura: altura || '400', imagen: '', texto: '', cta: '' });
  localStorage.setItem('bl-banners', JSON.stringify(BANNERS));
  renderBanners();
  editarBanner(BANNERS.length - 1);
}

function editarBanner(i) {
  var b = BANNERS[i];
  var modal = document.getElementById('banner-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'banner-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    document.body.appendChild(modal);
  }
  modal.innerHTML =
    '<div style="background:#fff;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;padding:32px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">' +
        '<h3 style="font-family:\'Helvetica World\',\'Helvetica Neue\',Helvetica,Arial,sans-serif;font-size:20px;color:#17233F;margin:0;">Editar banner</h3>' +
        '<button data-action="close-banner-modal" style="background:none;border:none;font-size:24px;cursor:pointer;color:#aaa;">✕</button>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:14px;">' +
        '<div><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;display:block;margin-bottom:4px;">Nombre del banner</label>' +
          '<input id="bm-nombre" value="' + (b.nombre||'') + '" style="width:100%;padding:10px;border:1.5px solid #E0DDD6;font-size:13px;box-sizing:border-box;"></div>' +
        '<div><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;display:block;margin-bottom:4px;">Página</label>' +
          '<select id="bm-pagina" style="width:100%;padding:10px;border:1.5px solid #E0DDD6;font-size:13px;">' +
            '<option value="portada"' + (b.pagina==='portada'?' selected':'') + '>Portada</option>' +
            '<option value="dilo-bonito"' + (b.pagina==='dilo-bonito'?' selected':'') + '>Dilo Bonito</option>' +
            '<option value="bendito-lab"' + (b.pagina==='bendito-lab'?' selected':'') + '>Bendito Lab</option>' +
            '<option value="colaboradores"' + (b.pagina==='colaboradores'?' selected':'') + '>Colaboradores</option>' +
          '</select></div>' +
        '<div><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;display:block;margin-bottom:4px;">Altura (px)</label>' +
          '<input id="bm-altura" type="number" value="' + (b.altura||400) + '" style="width:100%;padding:10px;border:1.5px solid #E0DDD6;font-size:13px;box-sizing:border-box;"></div>' +
        '<div><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;display:block;margin-bottom:4px;">Imagen de fondo</label>' +
          (b.imagen ? '<img src="/' + b.imagen + '" style="width:100%;height:120px;object-fit:cover;margin-bottom:8px;">' : '') +
          '<label for="bm-file" style="background:#17233F;color:#E8C24A;font-weight:700;font-size:11px;letter-spacing:1px;padding:8px 16px;cursor:pointer;display:inline-block;">📤 SUBIR IMAGEN</label>' +
          '<input type="file" id="bm-file" accept="image/*" style="display:none" data-action="subir-img-banner" data-i="' + i + '"></div>' +
        '<div><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;display:block;margin-bottom:4px;">Texto sobre el banner (opcional)</label>' +
          '<input id="bm-texto" value="' + (b.texto||'') + '" placeholder="Ej: Personalización en directo" style="width:100%;padding:10px;border:1.5px solid #E0DDD6;font-size:13px;box-sizing:border-box;"></div>' +
        '<div><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;display:block;margin-bottom:4px;">Botón CTA (opcional)</label>' +
          '<input id="bm-cta" value="' + (b.cta||'') + '" placeholder="Ej: Ver packs →" style="width:100%;padding:10px;border:1.5px solid #E0DDD6;font-size:13px;box-sizing:border-box;"></div>' +
        '<div><label style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;display:block;margin-bottom:4px;">Enlace del CTA</label>' +
          '<input id="bm-cta-url" value="' + (b.ctaUrl||'') + '" placeholder="Ej: #cotizador" style="width:100%;padding:10px;border:1.5px solid #E0DDD6;font-size:13px;box-sizing:border-box;"></div>' +
        '<div style="display:flex;gap:10px;margin-top:8px;">' +
          '<button data-action="guardar-banner" data-i="' + i + '" style="flex:1;background:#17233F;color:#E8C24A;border:none;padding:14px;font-family:\'Helvetica World\',\'Helvetica Neue\',Helvetica,Arial,sans-serif;font-weight:900;font-size:14px;letter-spacing:1px;cursor:pointer;">💾 GUARDAR</button>' +
          '<button data-action="ver-codigo-banner" data-i="' + i + '" style="flex:1;background:#F4F1E6;color:#17233F;border:1.5px solid #17233F;padding:14px;font-family:\'Helvetica World\',\'Helvetica Neue\',Helvetica,Arial,sans-serif;font-weight:900;font-size:14px;letter-spacing:1px;cursor:pointer;">📋 VER CÓDIGO HTML</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  modal.style.display = 'flex';
}

function guardarBanner(i) {
  BANNERS[i].nombre = document.getElementById('bm-nombre').value;
  BANNERS[i].pagina = document.getElementById('bm-pagina').value;
  BANNERS[i].altura = document.getElementById('bm-altura').value;
  BANNERS[i].texto = document.getElementById('bm-texto').value;
  BANNERS[i].cta = document.getElementById('bm-cta').value;
  BANNERS[i].ctaUrl = document.getElementById('bm-cta-url').value;
  localStorage.setItem('bl-banners', JSON.stringify(BANNERS));
  document.getElementById('banner-modal').style.display = 'none';
  renderBanners();
  showToast('Banner guardado ✓');
}

async function subirImgBanner(input, i) {
  var file = input.files[0];
  if (!file) return;
  var token = localStorage.getItem('bl-gh-token');
  if (!token) { alert('Añade el token de GitHub en Ajustes.'); return; }
  var ext = file.name.split('.').pop().toLowerCase() || 'jpg';
  var newPath = 'images/banner-' + Date.now() + '.' + ext;
  showToast('Subiendo imagen del banner...');
  var reader = new FileReader();
  reader.onload = async function(e) {
    var b64 = e.target.result.split(',')[1];
    try {
      var put = await fetch('https://api.github.com/repos/contactobenditolab-ship-it/dossier-dilo-bonito/contents/' + newPath, {
        method: 'PUT',
        headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json', 'User-Agent': 'BenditoAdmin' },
        body: JSON.stringify({ message: 'Admin: imagen banner', content: b64 })
      });
      if (!put.ok) throw new Error((await put.json()).message);
      BANNERS[i].imagen = newPath;
      localStorage.setItem('bl-banners', JSON.stringify(BANNERS));
      showToast('✓ Imagen subida. Edita el banner para verla.');
      editarBanner(i);
    } catch(err) { showToast('Error: ' + err.message); }
  };
  reader.readAsDataURL(file);
}

function verCodigoBanner(i) {
  var b = BANNERS[i];
  var imgUrl = b.imagen ? '/' + b.imagen : '';
  var bgImg = imgUrl ? ' url(\'' + imgUrl + '\') center/cover no-repeat' : '';
  var inner = '';
  if (b.texto) {
    inner += '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:rgba(0,0,0,0.35);padding:40px;">';
    inner += '<h2 style="font-family:\'Helvetica World\',\'Helvetica Neue\',Helvetica,Arial,sans-serif;font-weight:900;font-size:clamp(32px,5vw,64px);color:#fff;letter-spacing:-1px;margin-bottom:24px;">' + b.texto + '</h2>';
    if (b.cta) inner += '<a href="' + (b.ctaUrl||'#') + '" style="background:var(--sunshine);color:var(--deep);font-family:\'Helvetica World\',\'Helvetica Neue\',Helvetica,Arial,sans-serif;font-weight:900;font-size:15px;letter-spacing:1px;padding:18px 48px;text-decoration:none;display:inline-block;">' + b.cta + '</a>';
    inner += '</div>';
  }
  var html = '<section style="width:100%;height:' + (b.altura||400) + 'px;position:relative;overflow:hidden;background:var(--deep)' + bgImg + ';">' + inner + '</section>';
  var modal = document.getElementById('banner-modal');
  modal.innerHTML =
    '<div style="background:#fff;width:100%;max-width:680px;max-height:90vh;overflow-y:auto;padding:32px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<h3 style="font-family:\'Helvetica World\',\'Helvetica Neue\',Helvetica,Arial,sans-serif;font-size:18px;color:#17233F;margin:0;">Código HTML del banner</h3>' +
        '<button data-action="close-banner-modal" style="background:none;border:none;font-size:24px;cursor:pointer;color:#aaa;">✕</button>' +
      '</div>' +
      '<p style="font-size:12px;color:#888;margin-bottom:12px;">Copia este código y pégalo en el HTML de la página <strong>' + (b.pagina||'') + '</strong> donde quieras que aparezca el banner.</p>' +
      '<textarea style="width:100%;height:220px;font-family:monospace;font-size:12px;padding:12px;border:1.5px solid #E0DDD6;background:#17233F;color:#7aff7a;resize:vertical;box-sizing:border-box;" readonly>' + html.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</textarea>' +
      '<button data-action="copiar-codigo-banner" style="width:100%;margin-top:12px;background:#17233F;color:#E8C24A;border:none;padding:14px;font-family:\'Helvetica World\',\'Helvetica Neue\',Helvetica,Arial,sans-serif;font-weight:900;font-size:14px;letter-spacing:1px;cursor:pointer;">📋 COPIAR CÓDIGO</button>' +
    '</div>';
  modal.style.display = 'flex';
}

function eliminarBanner(i) {
  if (!confirm('¿Eliminar este banner?')) return;
  BANNERS.splice(i, 1);
  localStorage.setItem('bl-banners', JSON.stringify(BANNERS));
  renderBanners();
  showToast('Banner eliminado');
}

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    renderCarruselDB();
    renderBanners();
  }, 300);
});



// ══ COLORES GLOBALES ════════════════════════════════════════
var GC_DEFAULTS = {
  baby:    '#93ACA7',
  deep:    '#17233F',
  sunshine:'#E8C24A',
  cream:   '#F4F1E6',
  captain: '#2F8FEA',
  rose:    '#E3A29C'
};

var GC_PAGES = {
  'portada':  'index.html',
  'portada2': 'portada.html',
  'db':       'dilo-bonito.html',
  'bl':       'bendito-lab.html',
  'colab':    'colaboradores.html',
  'unete':    'unete.html'
};

function gcPreview() {
  var ids = { baby:'gpb-baby', deep:'gpb-deep', sunshine:'gpb-sun', cream:'gpb-cream', captain:'gpb-cap', rose:'gpb-rose' };
  Object.keys(ids).forEach(function(k) {
    var val = document.getElementById('gc-' + k).value;
    document.getElementById(ids[k]).style.background = val;
    document.getElementById('gc-' + k + '-preview').style.background = val;
  });
}

function gcReset() {
  Object.keys(GC_DEFAULTS).forEach(function(k) {
    var el = document.getElementById('gc-' + k);
    if (el) el.value = GC_DEFAULTS[k];
  });
  gcPreview();
}

async function gcPublicar() {
  var token = localStorage.getItem('bl-gh-token');
  if (!token) { alert('Añade el token de GitHub en Ajustes primero.'); return; }

  var colors = {
    '--baby':     document.getElementById('gc-baby').value,
    '--deep':     document.getElementById('gc-deep').value,
    '--sunshine': document.getElementById('gc-sunshine').value,
    '--cream':    document.getElementById('gc-cream').value,
    '--captain':  document.getElementById('gc-captain').value,
    '--poppy':    document.getElementById('gc-rose').value
  };

  // Calcular variantes
  colors['--white'] = '#FBF4E9'; // fijo

  var status = document.getElementById('gc-status');
  status.style.display = 'block';
  status.style.background = '#EDE8D8';
  status.style.color = '#17233F';

  var pagesToUpdate = [];
  Object.keys(GC_PAGES).forEach(function(key) {
    if (document.getElementById('gc-pg-' + key) && document.getElementById('gc-pg-' + key).checked) {
      pagesToUpdate.push(GC_PAGES[key]);
    }
  });

  var ok = 0; var fail = 0;
  for (var i = 0; i < pagesToUpdate.length; i++) {
    var filename = pagesToUpdate[i];
    status.innerHTML = '⏳ Actualizando ' + filename + ' (' + (i+1) + '/' + pagesToUpdate.length + ')...';
    try {
      // Obtener SHA y contenido
      var r = await fetch(
        'https://api.github.com/repos/contactobenditolab-ship-it/dossier-dilo-bonito/contents/' + filename,
        { headers: { 'Authorization': 'token ' + token, 'User-Agent': 'BenditoAdmin' } }
      );
      if (!r.ok) throw new Error('No se pudo leer ' + filename);
      var fd = await r.json();
      var html = decodeURIComponent(escape(atob(fd.content.replace(/\n/g,''))));

      // Reemplazar cada variable de color en el :root
      Object.keys(colors).forEach(function(cssVar) {
        // Busca patrones tipo: --baby: #XXXXXX; o --baby:#XXXXXX;
        var regex = new RegExp('(' + cssVar.replace('--','--') + '\s*:\s*)#[0-9A-Fa-f]{3,8}', 'g');
        html = html.replace(regex, '$1' + colors[cssVar]);
      });

      // Subir
      var b64 = btoa(unescape(encodeURIComponent(html)));
      var put = await fetch(
        'https://api.github.com/repos/contactobenditolab-ship-it/dossier-dilo-bonito/contents/' + filename,
        {
          method: 'PUT',
          headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json', 'User-Agent': 'BenditoAdmin' },
          body: JSON.stringify({ message: 'Admin: actualizar colores globales', content: b64, sha: fd.sha })
        }
      );
      if (!put.ok) throw new Error((await put.json()).message);
      ok++;
    } catch(err) {
      fail++;
      console.error(filename, err);
    }
  }

  if (fail === 0) {
    status.style.background = '#d4edda';
    status.style.color = '#155724';
    status.innerHTML = '✓ Listo. ' + ok + ' páginas actualizadas. Los cambios se verán en ~30 segundos.';
  } else {
    status.style.background = '#fff3cd';
    status.style.color = '#856404';
    status.innerHTML = '⚠ ' + ok + ' páginas OK, ' + fail + ' con error. Revisa el token de GitHub en Ajustes.';
  }

  // Guardar en localStorage para recordar la paleta
  localStorage.setItem('bl-global-colors', JSON.stringify(colors));
}

// Cargar colores guardados al abrir el panel
document.addEventListener('DOMContentLoaded', function() {
  var saved = localStorage.getItem('bl-global-colors');
  if (saved) {
    try {
      var c = JSON.parse(saved);
      var map = { '--baby':'baby', '--deep':'deep', '--sunshine':'sunshine', '--cream':'cream', '--captain':'captain', '--rose':'rose' };
      Object.keys(map).forEach(function(cssVar) {
        var el = document.getElementById('gc-' + map[cssVar]);
        if (el && c[cssVar]) el.value = c[cssVar];
      });
      gcPreview();
    } catch(e) {}
  }
});


async function checkPassword(pwd) {
  return BL_API.login(pwd);
}


// ══════════════════════════════════════════════════════
// PANEL DE PRECIOS
// ══════════════════════════════════════════════════════

var _preciosData = {
  articulos: [],
  servicios: { mini:0, esencial:0, clasico:0, completo:0, medida:0, extras:[] },
  extras: { hora:0, diseno:0, nino:0, postmin:0, postmax:0, km:0, items:[] },
  tecnicas: []
};

function switchPrecioTab(tab, btn) {
  ['articulos','servicios','extras','tecnicas'].forEach(function(t) {
    var el = document.getElementById('precios-tab-' + t);
    if (el) el.style.display = t === tab ? '' : 'none';
  });
  document.querySelectorAll('.precio-tab').forEach(function(b) {
    var active = b.dataset.tab === tab;
    b.style.fontWeight = active ? '700' : '600';
    b.style.color = active ? '#17233F' : '#aaa';
    b.style.borderBottom = active ? '3px solid #17233F' : '3px solid transparent';
  });
}

async function loadPreciosAdmin() {
  try {
    var r = await BL_API.dbGet({ tabla: 'precios_bendito' });
    if (r.data) _preciosData = Object.assign(_preciosData, r.data);
  } catch(e) {
    // Primera vez — datos vacíos
  }
  renderPreciosArticulos();
  renderPreciosServicios();
  renderPreciosExtras();
  renderPreciosTecnicas();
}

// ── ARTÍCULOS ─────────────────────────────────────────
function renderPreciosArticulos() {
  var list = document.getElementById('precios-articulos-list');
  if (!list) return;
  if (!_preciosData.articulos.length) {
    list.innerHTML = '<div style="color:#aaa;font-size:13px;padding:12px 0;">Sin artículos — añade el primero</div>';
    return;
  }
  list.innerHTML = _preciosData.articulos.map(function(a, i) {
    var margen = a.pvp && a.coste ? Math.round((1 - a.coste/a.pvp)*100) : 0;
    var mColor = margen >= 60 ? '#27AE60' : margen >= 40 ? '#E8A020' : '#E85555';
    return '<div style="display:grid;grid-template-columns:80px 1fr 90px 90px 80px 32px;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid #f0f0f0;">' +
      '<input value="' + (a.ref||'') + '" placeholder="REF" data-action="upd-articulo-ref" data-i="' + i + '" style="padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:12px;font-family:monospace;">' +
      '<input value="' + (a.nombre||'') + '" placeholder="Nombre del artículo" data-action="upd-articulo-nombre" data-i="' + i + '" style="padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px;">' +
      '<input type="number" value="' + (a.coste||'') + '" placeholder="0.00" data-action="upd-articulo-coste" data-i="' + i + '" style="padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px;text-align:center;">' +
      '<input type="number" value="' + (a.pvp||'') + '" placeholder="0.00" data-action="upd-articulo-pvp" data-i="' + i + '" style="padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px;text-align:center;">' +
      '<div style="text-align:center;font-weight:700;font-size:13px;color:' + mColor + ';">' + margen + '%</div>' +
      '<button data-action="rm-articulo" data-i="' + i + '" style="background:none;border:none;color:#ccc;font-size:16px;cursor:pointer;">✕</button>' +
    '</div>';
  }).join('');
}

function updArticuloRef(i,v){ _preciosData.articulos[i].ref=v; }
function updArticuloNombre(i,v){ _preciosData.articulos[i].nombre=v; }
function updArticuloCoste(i,v){ _preciosData.articulos[i].coste=parseFloat(v)||0; renderPreciosArticulos(); }
function updArticuloPvp(i,v){ _preciosData.articulos[i].pvp=parseFloat(v)||0; renderPreciosArticulos(); }
function rmArticulo(i){ _preciosData.articulos.splice(i,1); renderPreciosArticulos(); }
function addPrecioArticulo() {
  _preciosData.articulos.push({ ref:'', nombre:'', coste:0, pvp:0 });
  renderPreciosArticulos();
}

async function guardarPreciosArticulos() {
  try {
    await BL_API.dbPost({ accion: 'guardarPreciosBendito', seccion: 'articulos', datos: _preciosData.articulos });
    showSaved();
  } catch(e) { alert('Error: ' + e.message); }
}

// ── SERVICIOS ─────────────────────────────────────────
function renderPreciosServicios() {
  var s = _preciosData.servicios || {};
  ['mini','esencial','clasico','completo','medida'].forEach(function(k) {
    var el = document.getElementById('ps-' + k);
    if (el && s[k]) el.value = s[k];
  });
  var list = document.getElementById('precios-servicios-extra-list');
  if (!list) return;
  var items = s.extras || [];
  list.innerHTML = items.map(function(it, i) {
    return '<div style="display:grid;grid-template-columns:1fr 100px 32px;gap:8px;align-items:center;margin-bottom:8px;">' +
      '<input value="' + (it.nombre||'') + '" placeholder="Nombre del servicio" data-action="upd-servicio-extra-nombre" data-i="' + i + '" style="padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-size:13px;">' +
      '<input type="number" value="' + (it.precio||'') + '" placeholder="€" data-action="upd-servicio-extra-precio" data-i="' + i + '" style="padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-size:13px;text-align:center;">' +
      '<button data-action="rm-servicio-extra" data-i="' + i + '" style="background:none;border:none;color:#ccc;font-size:16px;cursor:pointer;">✕</button>' +
    '</div>';
  }).join('');
}

function updServicioExtraNombre(i,v){ _preciosData.servicios.extras[i].nombre=v; }
function updServicioExtraPrecio(i,v){ _preciosData.servicios.extras[i].precio=parseFloat(v)||0; }
function rmServicioExtra(i){ _preciosData.servicios.extras.splice(i,1); renderPreciosServicios(); }
function addPrecioServicio() {
  if (!_preciosData.servicios.extras) _preciosData.servicios.extras = [];
  _preciosData.servicios.extras.push({ nombre:'', precio:0 });
  renderPreciosServicios();
}

async function guardarPreciosServicios() {
  var s = _preciosData.servicios;
  ['mini','esencial','clasico','completo','medida'].forEach(function(k) {
    var el = document.getElementById('ps-' + k);
    if (el) s[k] = parseFloat(el.value)||0;
  });
  try {
    await BL_API.dbPost({ accion: 'guardarPreciosBendito', seccion: 'servicios', datos: s });
    showSaved();
  } catch(e) { alert('Error: ' + e.message); }
}

// ── EXTRAS ────────────────────────────────────────────
function renderPreciosExtras() {
  var e = _preciosData.extras || {};
  ['hora','diseno','nino','postmin','postmax','km'].forEach(function(k) {
    var el = document.getElementById('pe-' + k);
    if (el && e[k]) el.value = e[k];
  });
  var list = document.getElementById('precios-extras-list');
  if (!list) return;
  var items = e.items || [];
  list.innerHTML = items.map(function(it, i) {
    return '<div style="display:grid;grid-template-columns:1fr 100px 80px 32px;gap:8px;align-items:center;margin-bottom:8px;">' +
      '<input value="' + (it.nombre||'') + '" placeholder="Extra" data-action="upd-extra-item-nombre" data-i="' + i + '" style="padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-size:13px;">' +
      '<input type="number" value="' + (it.precio||'') + '" placeholder="€" data-action="upd-extra-item-precio" data-i="' + i + '" style="padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-size:13px;text-align:center;">' +
      '<input value="' + (it.unidad||'ud') + '" placeholder="ud/hora/km" data-action="upd-extra-item-unidad" data-i="' + i + '" style="padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-size:12px;text-align:center;">' +
      '<button data-action="rm-extra-item" data-i="' + i + '" style="background:none;border:none;color:#ccc;font-size:16px;cursor:pointer;">✕</button>' +
    '</div>';
  }).join('');
}

function updExtraItemNombre(i,v){ _preciosData.extras.items[i].nombre=v; }
function updExtraItemPrecio(i,v){ _preciosData.extras.items[i].precio=parseFloat(v)||0; }
function updExtraItemUnidad(i,v){ _preciosData.extras.items[i].unidad=v; }
function rmExtraItem(i){ _preciosData.extras.items.splice(i,1); renderPreciosExtras(); }
function addPrecioExtra() {
  if (!_preciosData.extras.items) _preciosData.extras.items = [];
  _preciosData.extras.items.push({ nombre:'', precio:0, unidad:'ud' });
  renderPreciosExtras();
}

async function guardarPreciosExtras() {
  var e = _preciosData.extras;
  ['hora','diseno','nino','postmin','postmax','km'].forEach(function(k) {
    var el = document.getElementById('pe-' + k);
    if (el) e[k] = parseFloat(el.value)||0;
  });
  try {
    await BL_API.dbPost({ accion: 'guardarPreciosBendito', seccion: 'extras', datos: e });
    showSaved();
  } catch(e) { alert('Error: ' + e.message); }
}

// ── TÉCNICAS ──────────────────────────────────────────
function renderPreciosTecnicas() {
  var list = document.getElementById('precios-tecnicas-list');
  if (!list) return;
  if (!_preciosData.tecnicas.length) {
    list.innerHTML = '<div style="color:#aaa;font-size:13px;padding:12px 0;">Sin técnicas — añade la primera</div>';
    return;
  }
  list.innerHTML = _preciosData.tecnicas.map(function(t, i) {
    return '<div style="border:1px solid #e0e0e0;border-radius:10px;padding:14px;margin-bottom:10px;">' +
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">' +
        '<input value="' + (t.nombre||'') + '" placeholder="Nombre técnica (ej: DTF, Vinilo...)" data-action="upd-tecnica-nombre" data-i="' + i + '" style="flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-size:14px;font-weight:700;">' +
        '<button data-action="rm-tecnica" data-i="' + i + '" style="background:none;border:none;color:#ccc;font-size:18px;cursor:pointer;">🗑</button>' +
      '</div>' +
      '<div style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Precio por unidad según cantidad</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px;">' +
        (t.tramos||[{desde:1,hasta:10,precio:0}]).map(function(tr, ti) {
          return '<div style="border:1px solid #e8e8e8;border-radius:8px;padding:8px;text-align:center;">' +
            '<div style="font-size:10px;color:#aaa;margin-bottom:4px;">' +
              '<input type="number" value="' + (tr.desde||1) + '" data-action="upd-tramo-desde" data-i="' + i + '" data-ti="' + ti + '" style="width:40px;border:none;border-bottom:1px solid #ddd;text-align:center;font-size:11px;"> – ' +
              '<input type="number" value="' + (tr.hasta||'∞') + '" data-action="upd-tramo-hasta" data-i="' + i + '" data-ti="' + ti + '" style="width:40px;border:none;border-bottom:1px solid #ddd;text-align:center;font-size:11px;"> uds' +
            '</div>' +
            '<input type="number" value="' + (tr.precio||'') + '" placeholder="€/ud" data-action="upd-tramo-precio" data-i="' + i + '" data-ti="' + ti + '" style="width:100%;border:none;border-bottom:2px solid #17233F;text-align:center;font-size:15px;font-weight:700;padding:4px 0;">' +
            '<div style="font-size:10px;color:#aaa;margin-top:2px;">€/ud</div>' +
          '</div>';
        }).join('') +
        '<button data-action="add-tramo" data-i="' + i + '" style="border:1.5px dashed #ccc;border-radius:8px;background:none;cursor:pointer;font-size:11px;color:#aaa;padding:8px;">+ Tramo</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function updTecnicaNombre(i,v){ _preciosData.tecnicas[i].nombre=v; }
function rmTecnica(i){ _preciosData.tecnicas.splice(i,1); renderPreciosTecnicas(); }
function updTramoDesde(i,ti,v){ _preciosData.tecnicas[i].tramos[ti].desde=parseInt(v)||1; }
function updTramoHasta(i,ti,v){ _preciosData.tecnicas[i].tramos[ti].hasta=parseInt(v)||999; }
function updTramoPrecio(i,ti,v){ _preciosData.tecnicas[i].tramos[ti].precio=parseFloat(v)||0; }
function addPrecioTecnica() {
  _preciosData.tecnicas.push({ nombre:'', tramos:[{desde:1,hasta:10,precio:0},{desde:11,hasta:50,precio:0},{desde:51,hasta:999,precio:0}] });
  renderPreciosTecnicas();
}

function addTramo(tecIdx) {
  if (!_preciosData.tecnicas[tecIdx].tramos) _preciosData.tecnicas[tecIdx].tramos = [];
  _preciosData.tecnicas[tecIdx].tramos.push({ desde:1, hasta:999, precio:0 });
  renderPreciosTecnicas();
}

async function guardarPreciosTecnicas() {
  try {
    await BL_API.dbPost({ accion: 'guardarPreciosBendito', seccion: 'tecnicas', datos: _preciosData.tecnicas });
    showSaved();
  } catch(e) { alert('Error: ' + e.message); }
}

function showSaved() {
  var el = document.querySelector('.saved');
  if (el) { el.classList.add('on'); setTimeout(function(){ el.classList.remove('on'); }, 2000); }
}

// ══ PRECIOS PORTAL ══════════════════════════════════
var _preciosPortal = [];

async function loadPreciosPortal() {
  try {
    var r = await BL_API.dbGet({ tabla: 'precios_portal' });
    _preciosPortal = r.data || [];
    renderPreciosPortal();
  } catch(e) { console.warn('Error precios portal:', e); }
}

function renderPreciosPortal() {
  var el = document.getElementById('precios-portal-list');
  if (!el) return;
  if (!_preciosPortal.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:#aaa;">Sin precios configurados</div>';
    return;
  }
  var secciones = {};
  _preciosPortal.forEach(function(p) {
    if (!secciones[p.seccion]) secciones[p.seccion] = [];
    secciones[p.seccion].push(p);
  });
  var secLabels = { eventos:'🎉 Packs Dilo Bonito', extras:'➕ Extras y servicios' };
  var inp = 'width:100%;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:inherit;box-sizing:border-box;';
  el.innerHTML = Object.keys(secciones).map(function(sec) {
    return '<div class="card" style="margin-bottom:12px;">' +
      '<div class="card-title" style="margin-bottom:10px;">' + (secLabels[sec]||sec) + '</div>' +
      secciones[sec].map(function(p) {
        return '<div style="display:grid;grid-template-columns:1fr 120px 90px 40px;gap:8px;align-items:end;margin-bottom:8px;">' +
          '<div><label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#aaa;display:block;margin-bottom:3px;">' + p.nombre + '</label>' +
          '<input id="pv-' + p.id + '" type="text" value="' + p.precio + '" style="' + inp + '"></div>' +
          '<div><label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#aaa;display:block;margin-bottom:3px;">Tipo</label>' +
          '<select id="pt-' + p.id + '" style="' + inp + 'width:auto;padding:8px;">' +
            '<option value="fijo"' + (p.tipo==='fijo'?' selected':'') + '>Fijo</option>' +
            '<option value="desde"' + (p.tipo==='desde'?' selected':'') + '>Desde</option>' +
            '<option value="consultar"' + (p.tipo==='consultar'?' selected':'') + '>Consultar</option>' +
          '</select></div>' +
          '<button data-action="guardar-precio-portal" data-id="' + p.id + '" style="background:#17233F;color:#E8C24A;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer;width:100%;">Guardar</button>' +
          '<button data-action="eliminar-precio-portal" data-id="' + p.id + '" style="background:none;border:1px solid #e5e7eb;border-radius:8px;padding:10px;cursor:pointer;color:#aaa;">✕</button>' +
        '</div>';
      }).join('') +
    '</div>';
  }).join('');
}

async function guardarPrecioPortal(id) {
  var p = _preciosPortal.find(function(x){ return x.id===id; });
  if (!p) return;
  var val = document.getElementById('pv-' + id).value.trim();
  var tipo = document.getElementById('pt-' + id).value;
  try {
    await BL_API.dbPost({ accion: 'guardarPrecio', datos: Object.assign({}, p, { precio: val, tipo: tipo }) });
    p.precio = val; p.tipo = tipo;
    showSaved();
  } catch(e) { alert('Error: ' + e.message); }
}

async function agregarPrecioPortal() {
  var nombre = document.getElementById('nuevo-nombre').value.trim();
  var precio = document.getElementById('nuevo-precio').value.trim();
  var seccion = document.getElementById('nuevo-seccion').value;
  var tipo = document.getElementById('nuevo-tipo').value;
  if (!nombre || !precio) { alert('Rellena nombre y precio'); return; }
  var id = seccion + '-' + Date.now().toString(36);
  try {
    await BL_API.dbPost({ accion: 'guardarPrecio', datos: { id, seccion, nombre, precio, tipo, visible: true, orden: (_preciosPortal.filter(function(p){ return p.seccion===seccion; }).length+1)*10 } });
    loadPreciosPortal();
  } catch(e) { alert('Error: ' + e.message); }
}

async function eliminarPrecioPortal(id) {
  if (!confirm('¿Eliminar este precio?')) return;
  try {
    await BL_API.dbPost({ accion: 'eliminarPrecio', id });
    _preciosPortal = _preciosPortal.filter(function(p){ return p.id !== id; });
    renderPreciosPortal();
  } catch(e) { alert('Error: ' + e.message); }
}


// ══ DELEGACIÓN DE EVENTOS (sustituye a los onclick/onchange/oninput inline, requerido por la CSP estricta) ══
function handleClick(e){
  const el=e.target.closest('[data-action]');
  if(!el)return;
  const i=el.dataset.i!==undefined?parseInt(el.dataset.i,10):undefined;
  switch(el.dataset.action){
    case 'check-login':          checkLogin(); break;
    case 'logout-admin':         logoutAdmin(); break;
    case 'toggle-sidebar':       toggleSidebar(); break;
    case 'back-to-editor':       backToEditor(); break;
    case 'save-all':             saveAll(); break;
    case 'add-seccion':          addSeccion(); break;
    case 'db-export-css':        dbExportCSS(); break;
    case 'db-reset-all':         dbResetAll(); break;
    case 'save-token':           saveToken(); break;
    case 'publicar-carrusel-db': publicarCarruselDB(); break;
    case 'crear-banner':         crearBanner(); break;
    case 'web-guardar':          webGuardar(); break;
    case 'agregar-precio-portal':agregarPrecioPortal(); break;
    case 'add-producto':         addProducto(); break;
    case 'publicar-colores':     publicarColores(); break;
    case 'reset-colores':        resetColores(); break;
    case 'gc-publicar':          gcPublicar(); break;
    case 'gc-reset':             gcReset(); break;
    case 'save-token2':          saveToken2(); break;
    case 'show':                 show(el.dataset.panel, el); break;
    case 'web-cargar-pagina':    webCargarPagina(el.dataset.page); break;
    case 'apply-preset':         applyPreset(el.dataset.preset); break;
    case 'ver-img-grande':       verImgGrande(el.dataset.url); break;
    case 'eliminar-img':         eliminarImg(el.dataset.grp, parseInt(el.dataset.i,10), el.dataset.path, el.dataset.uid); break;
    case 'toggle-sec-card':      toggleSecCard(el); break;
    case 'toggle-sec':           toggleSec(el.dataset.id, el); break;
    case 'remove-extra':         removeExtra(i); break;
    case 'toggle-red':           toggleRed(i, el); break;
    case 'rm-producto':          rmProducto(i); break;
    case 'dbc-eliminar':         dbcEliminar(i); break;
    case 'editar-banner':        editarBanner(i); break;
    case 'ver-codigo-banner':    verCodigoBanner(i); break;
    case 'eliminar-banner':      eliminarBanner(i); break;
    case 'close-banner-modal':   closeBannerModal(); break;
    case 'guardar-banner':       guardarBanner(i); break;
    case 'copiar-codigo-banner': copiarCodigoBanner(); break;
    case 'rm-articulo':          rmArticulo(i); break;
    case 'rm-servicio-extra':    rmServicioExtra(i); break;
    case 'rm-extra-item':        rmExtraItem(i); break;
    case 'rm-tecnica':           rmTecnica(i); break;
    case 'add-tramo':            addTramo(i); break;
    case 'guardar-precio-portal':  guardarPrecioPortal(el.dataset.id); break;
    case 'eliminar-precio-portal': eliminarPrecioPortal(el.dataset.id); break;
    case 'add-coleccion':        addColeccion(); break;
    case 'rm-coleccion':         rmColeccion(el.dataset.slug); break;
    case 'save-colecciones':     guardarColecciones(); break;
  }
}
document.addEventListener('click', handleClick);

function handleChange(e){
  const el=e.target.closest('[data-action]');
  if(!el)return;
  const i=el.dataset.i!==undefined?parseInt(el.dataset.i,10):undefined;
  switch(el.dataset.action){
    case 'mark-dirty':      markDirty(); break;
    case 'gc-preview':      gcPreview(); break;
    case 'db-apply-color':  dbApplyColor(el); break;
    case 'db-apply-font':   dbApplyFont(el.dataset.font, el.value); break;
    case 'upd-red-name':    updRedName(i, el.value); break;
    case 'upd-red-handle':  updRedHandle(i, el.value); break;
    case 'upd-red-href':    updRedHref(i, el.value); break;
    case 'upd-producto-nombre': updProductoNombre(i, el.value); break;
    case 'upd-producto-desc':   updProductoDesc(i, el.value); break;
    case 'upd-producto-precio': updProductoPrecio(i, el.value); break;
    case 'upload-img':       uploadImg(el, el.dataset.path, el.dataset.uid); break;
    case 'anadir-img':       anadirImg(el, el.dataset.grp); break;
    case 'upload-img-data':  uploadImgData(el); break;
    case 'anadir-img-data':  anadirImgData(el); break;
    case 'subir-img-banner': subirImgBanner(el, i); break;
    case 'web-campo-change': webCampoChange(el.dataset.key, el.value); break;
    case 'subir-hero-coleccion': subirHeroColeccion(el, el.dataset.slug); break;
  }
}
document.addEventListener('change', handleChange);

function handleInput(e){
  const el=e.target.closest('[data-action]');
  if(!el)return;
  const i=el.dataset.i!==undefined?parseInt(el.dataset.i,10):undefined;
  const ti=el.dataset.ti!==undefined?parseInt(el.dataset.ti,10):undefined;
  switch(el.dataset.action){
    case 'sync-color':      syncColor(el.dataset.id, el.value); break;
    case 'sync-color-text': syncColorText(el.dataset.id, el.value); break;
    case 'upd-articulo-ref':    updArticuloRef(i, el.value); break;
    case 'upd-articulo-nombre': updArticuloNombre(i, el.value); break;
    case 'upd-articulo-coste':  updArticuloCoste(i, el.value); break;
    case 'upd-articulo-pvp':    updArticuloPvp(i, el.value); break;
    case 'upd-servicio-extra-nombre': updServicioExtraNombre(i, el.value); break;
    case 'upd-servicio-extra-precio': updServicioExtraPrecio(i, el.value); break;
    case 'upd-extra-item-nombre': updExtraItemNombre(i, el.value); break;
    case 'upd-extra-item-precio': updExtraItemPrecio(i, el.value); break;
    case 'upd-extra-item-unidad': updExtraItemUnidad(i, el.value); break;
    case 'upd-tecnica-nombre':    updTecnicaNombre(i, el.value); break;
    case 'upd-tramo-desde':  updTramoDesde(i, ti, el.value); break;
    case 'upd-tramo-hasta':  updTramoHasta(i, ti, el.value); break;
    case 'upd-tramo-precio': updTramoPrecio(i, ti, el.value); break;
    case 'upd-coleccion-slug':      updColeccionSlug(el.dataset.slug, el.value); break;
    case 'upd-coleccion-titulo':    updColeccionCampo(el.dataset.slug, 'titulo', el.value); break;
    case 'upd-coleccion-subtitulo': updColeccionCampo(el.dataset.slug, 'subtitulo', el.value); break;
    case 'upd-coleccion-tag':       updColeccionCampo(el.dataset.slug, 'tag', el.value); break;
  }
}
document.addEventListener('input', handleInput);

document.getElementById('pwd').addEventListener('keydown', function(e){
  if(e.key==='Enter') checkLogin();
});
