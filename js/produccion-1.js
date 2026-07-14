const PIN_DEFAULT = '2305';
const ESTADOS = [
  {id:'pendiente',  label:'Pendiente',       cls:'bp',  color:'var(--amber)',  bg:'var(--amber-bg)'},
  {id:'produccion', label:'En producción',   cls:'bpr', color:'var(--blue)',   bg:'var(--blue-bg)'},
  {id:'listo',      label:'Listo',           cls:'bl',  color:'var(--green)',  bg:'var(--green-bg)'},
  {id:'enviado',    label:'Entregado',       cls:'be',  color:'var(--purple)', bg:'var(--purple-bg)'},
  {id:'cancelado',  label:'Cancelado',       cls:'bc',  color:'var(--red)',    bg:'var(--red-bg)'},
];
const TCOLOR = {b2b:'var(--blue)',evento:'var(--pink-dark)',b2c:'var(--green)',interno:'var(--purple)'};
const TLABEL = {b2b:'B2B',evento:'Evento Dilo Bonito',b2c:'B2C',interno:'Interno'};
const CATS = [{id:'prep',l:'Prep'},{id:'produccion',l:'Producción'},{id:'acabados',l:'Acabados'},{id:'embalaje',l:'Embalaje'}];

let state = {pedidos:[]};
let filter = 'all', sort = 'fecha';
let activeId = null, newType = 'b2b';
let pinBuf = '';

// ── PERSISTENCIA: Supabase via /api/db ──────────────────
async function load(){
  try {
    // Intentar cargar desde Supabase
    const r = await fetch('/api/db?tabla=produccion', { headers: BL_API.authHeaders() });
    const d = await r.json();
    if (d.ok && d.data) {
      const { pedidos, materiales, checklist, maleta } = d.data;
      // Reconstruir state agrupando por pedidoId
      const pedidosMap = {};
      (pedidos||[]).forEach(p => {
        pedidosMap[p.id] = {
          id: p.id, tipo: p.tipo, cliente: p.cliente,
          articulo: p.articulo, estado: p.estado, notas: p.notas||'',
          pedido_id: p.pedido_id,
          materiales: [], checklist: [], maleta: []
        };
      });
      (materiales||[]).forEach(m => {
        if (pedidosMap[m.pedido_id]) pedidosMap[m.pedido_id].materiales.push({
          id: m.id, nombre: m.nombre, proveedor: m.proveedor||'',
          qty: parseInt(m.qty)||1, pers: m.pers||'', medida: m.medida||'', arte_ok: m.arte_ok==='true'||m.arte_ok===true
        });
      });
      (checklist||[]).forEach(c => {
        if (pedidosMap[c.pedido_id]) pedidosMap[c.pedido_id].checklist.push({
          id: c.id, tarea: c.tarea, cat: c.cat||'', done: c.done==='true'||c.done===true
        });
      });
      (maleta||[]).forEach(m => {
        if (pedidosMap[m.pedido_id]) pedidosMap[m.pedido_id].maleta.push({
          id: m.id, item: m.item, qty: parseInt(m.qty)||1, checked: m.checked==='true'||m.checked===true
        });
      });
      state.pedidos = Object.values(pedidosMap);
      // Guardar copia local como caché offline
      try { localStorage.setItem('bl3_cache', JSON.stringify(state)); } catch(e){}
      return;
    }
  } catch(e) {
    console.warn('[produccion] Supabase no disponible, usando caché local:', e.message);
  }
  // Fallback: caché local
  try { const s = localStorage.getItem('bl3_cache')||localStorage.getItem('bl3'); if(s) state=JSON.parse(s); } catch(e){}
}

async function save(){
  // Guardar en local inmediatamente (UI reactiva)
  try { localStorage.setItem('bl3_cache', JSON.stringify(state)); } catch(e){}
  // Sincronizar a Supabase en background
  syncSheets();
}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,5);}
function ged(id){return state.pedidos.find(p=>p.id===id);}

// PIN
function pp(d){if(pinBuf.length>=4)return;pinBuf+=d;ud();if(pinBuf.length===4)setTimeout(checkPin,120);}
function pb(){pinBuf=pinBuf.slice(0,-1);ud();}
function pc(){pinBuf='';ud();}
function ud(){for(let i=0;i<4;i++)document.getElementById('d'+i).classList.toggle('filled',i<pinBuf.length);}
async function checkPin(){
  const ok=localStorage.getItem('bl3_pin')||PIN_DEFAULT;
  if(pinBuf===ok){
    await BL_API.login(pinBuf);
    document.getElementById('pin-screen').style.display='none';
    document.getElementById('app').style.display='flex';
    document.getElementById('fab').style.display='flex';
    await load();render();
  } else {
    document.getElementById('pin-err').classList.add('show');
    for(let i=0;i<4;i++)document.getElementById('d'+i).classList.add('filled');
    setTimeout(()=>{pinBuf='';ud();document.getElementById('pin-err').classList.remove('show');},800);
  }
}
function lockApp(){
  pinBuf='';ud();
  document.getElementById('app').style.display='none';
  document.getElementById('pin-screen').style.display='flex';
  document.getElementById('fab').style.display='none';
}

// FILTER / SORT
function setFilter(f){
  filter=f;
  document.querySelectorAll('.filter-chip').forEach(c=>c.classList.toggle('active',c.dataset.f===f));
  render();
}
function setSort(s){sort=s;render();}
function filtered(){
  let arr=state.pedidos.filter(p=>filter==='all'||p.tipo===filter);
  if(sort==='fecha')arr.sort((a,b)=>(a.fecha||'9999')<(b.fecha||'9999')?-1:1);
  else if(sort==='estado')arr.sort((a,b)=>ESTADOS.findIndex(e=>e.id===a.estado)-ESTADOS.findIndex(e=>e.id===b.estado));
  else if(sort==='tipo')arr.sort((a,b)=>a.tipo.localeCompare(b.tipo));
  else arr.sort((a,b)=>b.id.localeCompare(a.id));
  return arr;
}

// RENDER LIST
function render(){
  const arr=filtered();
  const total=filter==='all'?state.pedidos.length:arr.length;
  document.getElementById('list-count').textContent=total+' pedido'+(total!==1?'s':'')+(filter!=='all'?' · filtrado':'');
  const cont=document.getElementById('ped-list');
  if(!arr.length){
    const em={all:'📋',b2b:'🏢',evento:'🎉',b2c:'👤',interno:'⚙️'};
    cont.innerHTML=`<div class="empty"><div class="ei">${em[filter]||'📋'}</div><p>No hay pedidos${filter!=='all'?' de este tipo':''}.<br>Pulsa + para crear uno.</p></div>`;
    return;
  }
  const today=new Date().toISOString().split('T')[0];
  cont.innerHTML=arr.map(p=>{
    const est=ESTADOS.find(e=>e.id===p.estado)||ESTADOS[0];
    const chkT=(p.checklist||[]).length;
    const chkD=(p.checklist||[]).filter(x=>x.done).length;
    const pct=chkT?Math.round(chkD/chkT*100):0;
    const urgent=p.fecha&&p.fecha<=today&&p.estado!=='listo'&&p.estado!=='enviado'&&p.estado!=='cancelado';
    return `<div class="ped-card" data-action="open-drawer" data-id="${p.id}">
      <div class="ped-card-top">
        <div class="type-dot" style="background:${TCOLOR[p.tipo]}"></div>
        <div class="ped-body">
          <div class="ped-title">${esc(p.cliente||'Sin nombre')}</div>
          <div class="ped-meta">${p.articulo?esc(p.articulo)+' · ':''}${TLABEL[p.tipo]||p.tipo}</div>
        </div>
        <div class="ped-right">
          <span class="badge ${est.cls}">${est.label}</span>
          ${p.fecha?`<span class="ped-fecha${urgent?' urgent':''}">${fmtF(p.fecha)}</span>`:''}
        </div>
      </div>
      ${chkT?`<div class="ped-progress"><div class="ped-progress-fill" style="width:${pct}%"></div></div>`:''}
    </div>`;
  }).join('');
}

function fmtF(f){if(!f)return'';const[y,m,d]=f.split('-');return`${d}/${m}/${y}`;}

// NEW PEDIDO
// Cache de presupuestos cargados
let _presups=[];

async function loadPresupuestos(){
  const sel=document.getElementById('m-presup');
  const lbl=document.getElementById('m-presup-loading');
  if(_presups.length){_renderPresupSel(sel);return;}
  lbl.style.display='block';
  try{
    const data=await BL_API.dbGet({ tabla: 'presupuestos' });
    if(data.ok&&Array.isArray(data.data)){
      const excluir=['cancelado','rechazado','Cancelado','Rechazado'];
      _presups=data.data.filter(p=>!excluir.includes(p.estado));
      _presups.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
      _renderPresupSel(sel);
    } else {
      sel.innerHTML='<option value="">Sin presupuestos en Sheets aún</option>';
    }
  }catch(e){
    console.warn('Error cargando presupuestos',e);
    sel.innerHTML='<option value="">Error al cargar</option>';
  }
  finally{lbl.style.display='none';}
}

function _renderPresupSel(sel){
  sel.innerHTML='<option value="">— '+_presups.length+' presupuestos disponibles —</option>';
  _presups.forEach((p,i)=>{
    const cliente = p.cliente||p.empresa||'Sin nombre';
    const tipo    = p.tipocliente==='evento'?'🎉 Evento':p.tipocliente==='b2c'?'👤 B2C':'🏢 B2B';
    const pack    = p.pack||p.tipo||'';
    const fecha   = p.fecha||'';
    const estado  = p.estado||'';
    const label   = [tipo, cliente, pack, fecha, estado].filter(Boolean).join(' · ');
    const opt=document.createElement('option');
    opt.value=i;
    opt.textContent=label;
    sel.appendChild(opt);
  });
}

// ── Checklists precargados por tipo ──
const CHECKLISTS = {
  evento: [
    {tarea:'Arte final — diseño personalizado',       cat:'prep'},
    {tarea:'Imprimir transfers / cortar vinilo',      cat:'prep'},
    {tarea:'Preparar artículos (neceseres, totes…)',  cat:'produccion'},
    {tarea:'Revisión de colores y acabado',           cat:'produccion'},
    {tarea:'Comprobación de cantidades',              cat:'produccion'},
    {tarea:'Cargar maleta / montar stand',            cat:'embalaje'},
    {tarea:'Evento en directo',                       cat:'embalaje'},
    {tarea:'Post-evento / recogida y cierre',         cat:'acabados'},
  ],
  b2b: [
    {tarea:'Arte final aprobado por cliente',         cat:'prep'},
    {tarea:'Producción (sublimación / DTF / vinilo / láser)', cat:'produccion'},
    {tarea:'Revisión de colores y acabado',           cat:'acabados'},
    {tarea:'Comprobación de cantidades',              cat:'acabados'},
    {tarea:'Etiquetado individual',                   cat:'acabados'},
    {tarea:'Embalaje y protección',                   cat:'embalaje'},
    {tarea:'Preparación envío / albarán',             cat:'embalaje'},
    {tarea:'Envío / entrega al cliente',              cat:'embalaje'},
  ],
  b2c: [
    {tarea:'Arte final aprobado por cliente',         cat:'prep'},
    {tarea:'Producción (sublimación / DTF / vinilo / láser)', cat:'produccion'},
    {tarea:'Revisión de colores y acabado',           cat:'acabados'},
    {tarea:'Comprobación de cantidades',              cat:'acabados'},
    {tarea:'Etiquetado individual',                   cat:'acabados'},
    {tarea:'Embalaje y protección',                   cat:'embalaje'},
    {tarea:'Preparación envío / albarán',             cat:'embalaje'},
    {tarea:'Envío / entrega al cliente',              cat:'embalaje'},
  ],
  interno: [
    {tarea:'Definir objetivo del encargo',            cat:'prep'},
    {tarea:'Producción',                              cat:'produccion'},
    {tarea:'Control de resultado',                    cat:'acabados'},
    {tarea:'Almacenar / etiquetar',                   cat:'embalaje'},
  ],
};

function getChecklistPrecargado(tipo) {
  const base = CHECKLISTS[tipo] || CHECKLISTS['b2b'];
  return base.map(t => ({...t, done: false}));
}

function selPresup(idx){
  if(idx==='')return;
  const p=_presups[parseInt(idx)];
  if(!p)return;
  // Tipo
  const tc   = p.tipocliente||'b2b';
  const tipo = tc==='evento'?'evento':tc==='b2c'?'b2c':tc==='interno'?'interno':'b2b';
  selType(tipo);
  // Rellenar todos los campos
  document.getElementById('m-cliente').value        = p.cliente||p.empresa||'';
  document.getElementById('m-art').value            = p.pack||p.tipo||'';
  document.getElementById('m-email').value          = p.email||'';
  document.getElementById('m-tel').value            = p.tel||p.contacto||'';
  document.getElementById('m-fecha').value          = p.fecha||'';
  document.getElementById('m-invitados').value      = p.invitados||'';
  document.getElementById('m-importe').value        = p.importe||'';
  document.getElementById('m-estado-presup').value  = p.estado||'';
  document.getElementById('m-notas-presup').value   = p.notas||'';
  // Guardar referencia completa
  window._selectedPresup = { ...p, _tipo: tipo };
}

function openNewModal(){
  window._selectedPresup = null;
  ['m-presup','m-cliente','m-art','m-email','m-tel','m-fecha','m-invitados','m-importe','m-estado-presup','m-notas-presup'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  selType('b2b');
  document.getElementById('modal-bd').classList.add('open');
  loadPresupuestos();
}
function closeModal(){document.getElementById('modal-bd').classList.remove('open');window._selectedPresup=null;}
function selType(t){
  newType=t;
  document.querySelectorAll('.topt').forEach(o=>o.classList.toggle('sel',o.dataset.t===t));
}
function createPedido(){
  const cliente=document.getElementById('m-cliente').value.trim();
  if(!cliente){toast('Añade cliente o referencia');return;}
  const tipo      = newType;
  const checklist = getChecklistPrecargado(tipo);
  const sp        = window._selectedPresup || {};
  const p = {
    id:        uid(),
    tipo,
    cliente,
    articulo:  document.getElementById('m-art').value.trim(),
    email:     document.getElementById('m-email').value.trim(),
    tel:       document.getElementById('m-tel').value.trim(),
    fecha:     document.getElementById('m-fecha').value,
    invitados: document.getElementById('m-invitados').value,
    importe:   document.getElementById('m-importe').value,
    notas:     document.getElementById('m-notas-presup').value.trim(),
    estado:    'pendiente',
    materiales: [], checklist, maleta: [],
    presupId:  sp.id||'',
    numPresup: sp.numPresup||'',
    ts: Date.now()
  };
  window._selectedPresup = null;
  state.pedidos.unshift(p);
  save();render();closeModal();
  toast('Pedido creado con checklist ✓');
  setTimeout(()=>openDrawer(p.id),200);
}

// DRAWER
function openDrawer(id){
  activeId=id;
  const p=ged(id);if(!p)return;
  document.getElementById('drawer-title').textContent=p.cliente||'Pedido';
  document.getElementById('d-cliente').value=p.cliente||'';
  document.getElementById('d-tipo').value=p.tipo||'b2b';
  document.getElementById('d-fecha').value=p.fecha||'';
  document.getElementById('d-articulo').value=p.articulo||'';
  document.getElementById('d-notas').value=p.notas||'';
  renderSGrid(p.estado);
  dTab('info');
  renderMat();renderChk();renderMal();
  document.getElementById('drawer-bd').classList.add('open');
}
function closeDrawer(){document.getElementById('drawer-bd').classList.remove('open');activeId=null;}
function dTab(t){
  document.querySelectorAll('.dtab').forEach(d=>d.classList.toggle('active',d.dataset.dt===t));
  document.querySelectorAll('.dsec').forEach(s=>s.classList.toggle('active',s.id==='dsec-'+t));
}
function renderSGrid(cur){
  document.getElementById('sgrid').innerHTML=ESTADOS.map(e=>`
    <div class="sopt${e.id===cur?' sel':''}" style="background:${e.bg};color:${e.color}" data-action="sel-status" data-id="${e.id}">${e.label}</div>
  `).join('');
}
function selStatus(sid){
  const p=ged(activeId);if(!p)return;
  p.estado=sid;renderSGrid(sid);
}
function saveDrawer(){
  const p=ged(activeId);if(!p)return;
  p.cliente=document.getElementById('d-cliente').value.trim();
  p.tipo=document.getElementById('d-tipo').value;
  p.fecha=document.getElementById('d-fecha').value;
  p.articulo=document.getElementById('d-articulo').value.trim();
  p.notas=document.getElementById('d-notas').value.trim();
  document.getElementById('drawer-title').textContent=p.cliente||'Pedido';
  save();render();toast('Guardado ✓');
}
function deletePedido(){
  if(!confirm('¿Eliminar este pedido?'))return;
  state.pedidos=state.pedidos.filter(p=>p.id!==activeId);
  save();render();closeDrawer();toast('Eliminado');
}

// MATERIALES
function renderMat(){
  const p=ged(activeId);if(!p)return;
  const arr=p.materiales||[];
  const c=document.getElementById('d-mat-list');
  if(!arr.length){c.innerHTML='<div style="font-size:.8rem;color:var(--gray);padding:6px 0">Sin materiales.</div>';return;}
  c.innerHTML=arr.map((m,i)=>`
    <div class="irow">
      <div class="irow-body">
        <div class="irow-title">${esc(m.nombre)}</div>
        ${m.proveedor?`<div class="irow-meta">${esc(m.proveedor)}</div>`:''}
      </div>
      <div class="qtyc">
        <button class="qtyb" data-action="chg-mat" data-i="${i}" data-d="-1">−</button>
        <span class="qtyv">${m.qty}</span>
        <button class="qtyb" data-action="chg-mat" data-i="${i}" data-d="1">+</button>
      </div>
      <button class="rmb" data-action="rm-mat" data-i="${i}">🗑</button>
    </div>`).join('');
}
function addMat(){
  const n=document.getElementById('d-mn').value.trim();if(!n)return;
  const p=ged(activeId);if(!p)return;
  p.materiales=p.materiales||[];
  p.materiales.push({nombre:n,proveedor:document.getElementById('d-mp').value.trim(),qty:parseInt(document.getElementById('d-mq').value)||1});
  document.getElementById('d-mn').value='';document.getElementById('d-mp').value='';document.getElementById('d-mq').value='';
  save();renderMat();
}
function chgMat(i,d){const p=ged(activeId);if(!p)return;p.materiales[i].qty=Math.max(1,(p.materiales[i].qty||1)+d);save();renderMat();}
function rmMat(i){const p=ged(activeId);if(!p)return;p.materiales.splice(i,1);save();renderMat();}

// CHECKLIST
function renderChk(){
  const p=ged(activeId);if(!p)return;
  const arr=p.checklist||[];
  const done=arr.filter(x=>x.done).length;
  const pct=arr.length?Math.round(done/arr.length*100):0;
  document.getElementById('chk-prog').textContent=`${done} / ${arr.length} completadas`;
  document.getElementById('chk-bar').style.width=pct+'%';
  const c=document.getElementById('d-chk-list');
  if(!arr.length){c.innerHTML='<div style="font-size:.8rem;color:var(--gray);padding:6px 0">Sin tareas.</div>';return;}
  let html='';
  CATS.forEach(cat=>{
    const items=arr.filter(x=>x.cat===cat.id);
    if(!items.length)return;
    html+=`<div class="cat-label">${cat.l}</div>`;
    items.forEach(item=>{
      const gi=arr.indexOf(item);
      html+=`<div class="irow" style="${item.done?'opacity:.5':''}">
        <div class="chkbox${item.done?' on':''}" data-action="tog-chk" data-i="${gi}">${item.done?'✓':''}</div>
        <div class="irow-body"><div class="irow-title" style="${item.done?'text-decoration:line-through':''}">${esc(item.tarea)}</div></div>
        <button class="rmb" data-action="rm-chk" data-i="${gi}">🗑</button>
      </div>`;
    });
  });
  c.innerHTML=html;
}
function addChk(){
  const t=document.getElementById('d-ct').value.trim();if(!t)return;
  const p=ged(activeId);if(!p)return;
  p.checklist=p.checklist||[];
  p.checklist.push({tarea:t,cat:document.getElementById('d-cc').value,done:false});
  document.getElementById('d-ct').value='';
  save();renderChk();render();
}
function togChk(i){const p=ged(activeId);if(!p)return;p.checklist[i].done=!p.checklist[i].done;save();renderChk();render();}
function rmChk(i){const p=ged(activeId);if(!p)return;p.checklist.splice(i,1);save();renderChk();}

// MALETA
function renderMal(){
  const p=ged(activeId);if(!p)return;
  const arr=p.maleta||[];
  const c=document.getElementById('d-mal-list');
  if(!arr.length){c.innerHTML='<div style="font-size:.8rem;color:var(--gray);padding:6px 0">Sin elementos.</div>';return;}
  c.innerHTML=arr.map((m,i)=>`
    <div class="irow" style="${m.checked?'opacity:.5':''}">
      <div class="chkbox${m.checked?' on':''}" data-action="tog-mal" data-i="${i}">${m.checked?'✓':''}</div>
      <div class="irow-body">
        <div class="irow-title" style="${m.checked?'text-decoration:line-through':''}">${esc(m.item)}</div>
        <div class="irow-meta">x${m.qty}</div>
      </div>
      <button class="rmb" data-action="rm-mal" data-i="${i}">🗑</button>
    </div>`).join('');
}
function addMal(){
  const item=document.getElementById('d-mi').value.trim();if(!item)return;
  const p=ged(activeId);if(!p)return;
  p.maleta=p.maleta||[];
  p.maleta.push({item,qty:parseInt(document.getElementById('d-miq').value)||1,checked:false});
  document.getElementById('d-mi').value='';document.getElementById('d-miq').value='';
  save();renderMal();
}
function togMal(i){const p=ged(activeId);if(!p)return;p.maleta[i].checked=!p.maleta[i].checked;save();renderMal();}
function rmMal(i){const p=ged(activeId);if(!p)return;p.maleta.splice(i,1);save();renderMal();}

// SYNC
async function syncSheets(){
  const dot = document.getElementById('sync-dot');
  if(dot) dot.className='sync-dot spin';
  try{
    // Aplanar state en arrays para Supabase
    const pedidos=[], materiales=[], checklist=[], maleta=[];
    state.pedidos.forEach(p => {
      pedidos.push({ id:p.id, pedido_id:p.pedido_id||p.id, tipo:p.tipo||'', cliente:p.cliente||'', articulo:p.articulo||'', estado:p.estado||'pendiente', notas:p.notas||'' });
      (p.materiales||[]).forEach(m => materiales.push({ id:m.id, pedido_id:p.id, nombre:m.nombre||'', proveedor:m.proveedor||'', qty:String(m.qty||1), pers:m.pers||'', medida:m.medida||'', arte_ok:String(m.arte_ok||false) }));
      (p.checklist||[]).forEach(c => checklist.push({ id:c.id, pedido_id:p.id, tarea:c.tarea||'', cat:c.cat||'', done:String(c.done||false) }));
      (p.maleta||[]).forEach(m => maleta.push({ id:m.id, pedido_id:p.id, item:m.item||'', qty:String(m.qty||1), checked:String(m.checked||false) }));
    });
    await BL_API.dbPost({ accion: 'guardarProduccion', datos: { pedidos, materiales, checklist, maleta } });
    if(dot){ dot.className='sync-dot ok'; setTimeout(()=>dot.className='sync-dot',3000); }
  }catch(e){
    console.warn('[sync]', e.message);
    if(dot) dot.className='sync-dot err';
  }
}

// TOAST
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200);}

// UTILS
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// DELEGACIÓN DE EVENTOS (sustituye a los onclick/onchange inline, requerido por la CSP estricta)
function handleAction(e){
  const el=e.target.closest('[data-action]');
  if(!el)return;
  const i=el.dataset.i!==undefined?parseInt(el.dataset.i,10):undefined;
  switch(el.dataset.action){
    case 'pin-digit':    pp(el.dataset.d); break;
    case 'pin-clear':    pc(); break;
    case 'pin-back':     pb(); break;
    case 'lock':         lockApp(); break;
    case 'filter':       setFilter(el.dataset.f); break;
    case 'new-modal':    openNewModal(); break;
    case 'close-drawer': closeDrawer(); break;
    case 'dtab':         dTab(el.dataset.dt); break;
    case 'save-drawer':  saveDrawer(); break;
    case 'delete-pedido':deletePedido(); break;
    case 'add-mat':      addMat(); break;
    case 'add-chk':      addChk(); break;
    case 'add-mal':      addMal(); break;
    case 'sel-type':     selType(el.dataset.t); break;
    case 'close-modal':  closeModal(); break;
    case 'create-pedido':createPedido(); break;
    case 'open-drawer':  openDrawer(el.dataset.id); break;
    case 'sel-status':   selStatus(el.dataset.id); break;
    case 'chg-mat':      chgMat(i, parseInt(el.dataset.d,10)); break;
    case 'rm-mat':       rmMat(i); break;
    case 'tog-chk':      togChk(i); break;
    case 'rm-chk':       rmChk(i); break;
    case 'tog-mal':      togMal(i); break;
    case 'rm-mal':       rmMal(i); break;
  }
}
document.addEventListener('click', handleAction);
document.getElementById('sort-sel').addEventListener('change', e=>setSort(e.target.value));
document.getElementById('m-presup').addEventListener('change', e=>selPresup(e.target.value));
document.getElementById('drawer-bd').addEventListener('click', e=>{ if(e.target===e.currentTarget) closeDrawer(); });
document.getElementById('modal-bd').addEventListener('click', e=>{ if(e.target===e.currentTarget) closeModal(); });

// INIT
document.getElementById('fab').style.display='none';
