(function(){
  const frame=document.getElementById('pageFrame');
  const context=document.getElementById('contextLabel');
  const saveState=document.getElementById('saveState');
  const canvas=document.getElementById('webCanvas');
  const nav=document.getElementById('navPanel');
  const inspector=document.getElementById('inspector');
  const toast=document.getElementById('toast');
  let currentMode='page';
  let currentName='Inicio';

  function showToast(message){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800)}
  function setContext(kind,name){context.innerHTML=(kind==='page'?'PÁGINA WEB':'NEWSLETTER')+' <span>/</span> '+name;currentName=name;currentMode=kind}

  document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>{
    const section=btn.dataset.section;
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
    if(section==='pages'){
      currentMode='page';document.getElementById('pageList').hidden=false;document.getElementById('newsletterList').hidden=true;setContext('page',currentName);frame.style.display='block';
    }else if(section==='newsletters'){
      currentMode='newsletter';document.getElementById('pageList').hidden=true;document.getElementById('newsletterList').hidden=false;frame.style.display='block';setContext('newsletter','Empresas');showToast('Editor de newsletters preparado');
    }else{showToast(section.charAt(0).toUpperCase()+section.slice(1)+' · conexión pendiente con el proyecto existente')}
  }));

  document.querySelectorAll('[data-page]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-page]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
    const name=btn.dataset.name;setContext('page',name);frame.src='/'+btn.dataset.page+'?admin=1';saveState.textContent='Guardado';nav.classList.remove('open');
  }));
  document.querySelectorAll('[data-newsletter]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-newsletter]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');setContext('newsletter',btn.dataset.name);showToast('Newsletter seleccionada');
  }));

  document.querySelectorAll('.device').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.device').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
    canvas.classList.remove('tablet','mobile');if(btn.dataset.device!=='desktop')canvas.classList.add(btn.dataset.device);showToast('Vista '+btn.textContent.trim());
  }));

  document.getElementById('mobileMenuBtn').addEventListener('click',()=>nav.classList.toggle('open'));
  document.getElementById('closeInspector').addEventListener('click',()=>inspector.classList.remove('open'));
  document.getElementById('previewBtn').addEventListener('click',()=>{if(currentMode==='page')window.open(frame.src,'_blank','noopener');else showToast('Vista previa de newsletter preparada para la siguiente integración')});
  document.getElementById('publishBtn').addEventListener('click',()=>showToast(currentMode==='page'?'Publicación se conectará al flujo existente':'Guardado de newsletter se conectará al flujo existente'));
  document.getElementById('undoBtn').addEventListener('click',()=>showToast('Deshacer preparado'));
  document.getElementById('redoBtn').addEventListener('click',()=>showToast('Rehacer preparado'));
  document.getElementById('sheetClose').addEventListener('click',()=>document.getElementById('mobileSheet').style.display='none');

  window.addEventListener('message',event=>{
    if(!event.data)return;
    if(event.data.type==='bl-save-status'){
      saveState.textContent=event.data.status||'Guardado';
    }
    if(event.data.type==='bl-editor-select'){
      inspector.classList.add('open');document.getElementById('inspectorEmpty').hidden=true;document.getElementById('inspectorContent').hidden=false;
      document.getElementById('inspectorTitle').textContent=event.data.label||'Elemento';
      if(typeof event.data.text==='string')document.getElementById('textField').value=event.data.text;
    }
  });
})();
