// js/bl-images.js — Lee el contenido guardado en /api/content (imágenes
// subidas a Vercel Blob + textos editados) y lo aplica sobre la página
// estática. En modo edición (?admin=1 con sesión de admin activa) además
// convierte las fotos y los bloques de texto marcados con data-edit en
// controles clicables para cambiarlos ahí mismo, sobre la propia página.
(function () {
  function normalize(src) {
    return (src || '').replace(/^\.?\//, '').split('?')[0];
  }

  var CONTENT = { images: {}, texts: {} };

  function applyImages(images) {
    document.querySelectorAll('img[src]').forEach(function (img) {
      var key = img.getAttribute('data-slot') || normalize(img.getAttribute('src'));
      img.setAttribute('data-slot', key);
      if (images[key]) img.src = images[key];
    });
    document.querySelectorAll('[data-bg-slot]').forEach(function (el) {
      var key = el.getAttribute('data-bg-slot');
      if (images[key]) el.style.backgroundImage = "url('" + images[key] + "')";
    });
  }

  function applyTexts(texts) {
    document.querySelectorAll('[data-edit]').forEach(function (el) {
      var id = el.getAttribute('data-edit');
      if (texts[id] !== undefined) el.innerHTML = texts[id];
    });
  }

  var loaded = fetch('/api/content', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      CONTENT.images = (data && data.images) || {};
      CONTENT.texts = (data && data.texts) || {};
      applyImages(CONTENT.images);
      applyTexts(CONTENT.texts);
    })
    .catch(function () {});

  // ── MODO EDICIÓN ─────────────────────────────────────────────────────
  var params = new URLSearchParams(location.search);
  var wantsEdit = params.get('admin') === '1';
  if (!wantsEdit) return;

  loaded.then(function () {
    if (!window.BL_API || !BL_API.getToken()) {
      // No hay sesión: manda a iniciar sesión y volver aquí.
      var back = encodeURIComponent(location.pathname + '?admin=1');
      location.href = '/admin.html?next=' + back;
      return;
    }
    initEditMode();
  });

  function toast(msg, ok) {
    var t = document.getElementById('bl-edit-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'bl-edit-toast';
      t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
        'background:#17233F;color:#FBF4E9;font:600 13px/1 Inter,sans-serif;padding:10px 18px;' +
        'border-radius:8px;z-index:999999;opacity:0;transition:opacity .2s;pointer-events:none;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = ok === false ? '#B3261E' : '#17233F';
    t.style.opacity = '1';
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(function () { t.style.opacity = '0'; }, 2000);
  }

  async function resizeImageToDataUrl(file, maxDim, quality) {
    maxDim = maxDim || 1600; quality = quality || 0.82;
    var bitmap = await createImageBitmap(file);
    try {
      var scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      var w = Math.max(1, Math.round(bitmap.width * scale));
      var h = Math.max(1, Math.round(bitmap.height * scale));
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
      var q = quality;
      var dataUrl = canvas.toDataURL('image/webp', q);
      while (dataUrl.length > 3.6 * 1024 * 1024 && q > 0.35) {
        q -= 0.1;
        dataUrl = canvas.toDataURL('image/webp', q);
      }
      return dataUrl;
    } finally {
      if (bitmap.close) bitmap.close();
    }
  }

  var inIframe = window.self !== window.top;

  function initEditMode() {
    injectStyles();
    if (!inIframe) injectExitPill();
    wireImages();
    wireTexts();
  }

  function injectStyles() {
    var s = document.createElement('style');
    s.textContent =
      (inIframe ? '' : 'body{padding-top:44px!important;}') +
      '[data-edit]{outline-offset:2px;cursor:text;}' +
      '[data-edit]:hover{outline:2px dashed #2F8FEA;}' +
      '[data-edit][contenteditable="true"]{outline:2px solid #2F8FEA;background:rgba(47,143,234,.08);}' +
      'img[data-slot]{cursor:pointer;}' +
      'img[data-slot]:hover{outline:2px dashed #2F8FEA;outline-offset:-2px;}';
    document.head.appendChild(s);
  }

  // Visitar una página directamente con ?admin=1 (sin pasar por el panel):
  // deja editar igual, solo con una píldora para salir. La navegación entre
  // páginas en modo edición vive en la barra lateral de admin.html.
  function injectExitPill() {
    var bar = document.createElement('div');
    bar.id = 'bl-edit-bar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:44px;background:#17233F;' +
      'color:#FBF4E9;display:flex;align-items:center;gap:16px;padding:0 16px;z-index:999998;' +
      'font:600 12px/1 Inter,sans-serif;';
    bar.innerHTML =
      '<strong style="color:#E8C24A;">✏️ MODO EDICIÓN</strong>' +
      '<span style="opacity:.8;">haz clic en cualquier foto o texto para cambiarlo</span>' +
      '<span style="flex:1;"></span>' +
      '<a href="admin.html" style="color:#FBF4E9;border:1px solid #FBF4E9;padding:6px 12px;border-radius:14px;">Ir al panel→</a>';
    document.body.prepend(bar);
  }

  function wireTexts() {
    document.querySelectorAll('[data-edit]').forEach(function (el) {
      el.title = 'Clic para editar';
      el.addEventListener('click', function (e) {
        if (el.getAttribute('contenteditable') === 'true') return;
        e.preventDefault();
        e.stopPropagation();
        el.setAttribute('contenteditable', 'true');
        el.focus();
      });
      el.addEventListener('blur', function () {
        el.removeAttribute('contenteditable');
        saveText(el.getAttribute('data-edit'), el.innerHTML.trim());
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && el.tagName !== 'P' && !el.hasAttribute('data-edit-multiline')) {
          e.preventDefault();
          el.blur();
        }
        if (e.key === 'Escape') { el.blur(); }
      });
    });
  }

  var savingText = {};
  function saveText(id, text) {
    if (!id) return;
    if (savingText[id] === text) return;
    savingText[id] = text;
    fetch('/api/save-text', {
      method: 'POST',
      headers: BL_API.authHeaders(),
      body: JSON.stringify({ id: id, text: text })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { toast(d.ok ? 'Guardado ✓' : ('Error: ' + d.error), d.ok); })
      .catch(function () { toast('Error de conexión', false); });
  }

  function wireImages() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    var targetImg = null;

    document.querySelectorAll('img[data-slot]').forEach(function (img) {
      img.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        targetImg = img;
        input.click();
      });
    });

    input.addEventListener('change', async function () {
      var file = input.files && input.files[0];
      input.value = '';
      if (!file || !targetImg) return;
      var img = targetImg;
      var slot = img.getAttribute('data-slot');
      var prevSrc = img.src;
      img.style.opacity = '.5';
      try {
        var dataUrl = await resizeImageToDataUrl(file);
        var r = await fetch('/api/upload-image', {
          method: 'POST',
          headers: BL_API.authHeaders(),
          body: JSON.stringify({ path: slot, dataUrl: dataUrl })
        });
        var d = await r.json();
        if (!d.ok) throw new Error(d.error || 'Error al subir');
        img.src = d.url;
        toast('Imagen actualizada ✓', true);
      } catch (err) {
        img.src = prevSrc;
        toast('Error: ' + err.message, false);
      } finally {
        img.style.opacity = '';
      }
    });
  }
})();
