// js/bl-images.js — Lee el contenido guardado en /api/content (imágenes
// subidas a Vercel Blob, encuadres, colores y textos editados) y lo aplica
// sobre la página estática. En modo edición (?admin=1 con sesión de admin
// activa) además convierte fotos, colores y bloques de texto marcados con
// data-edit en controles clicables para cambiarlos ahí mismo, sobre la
// propia página.
(function () {
  function normalize(src) {
    return (src || '').replace(/^\.?\//, '').split('?')[0];
  }

  var CONTENT = { images: {}, imageView: {}, colors: {}, texts: {}, links: {} };

  // Cache en localStorage del último /api/content recibido: en la primera
  // visita no hay nada que hacer (toca esperar al fetch), pero en visitas
  // siguientes evita el parpadeo de "sale la foto vieja del HTML estático y
  // al momento la sustituye la subida real" — se aplica de forma síncrona,
  // sin esperar red, y el fetch de abajo la refresca por si cambió algo.
  var CONTENT_CACHE_KEY = 'bl_content_cache_v1';

  function leerContentCache() {
    try {
      var raw = localStorage.getItem(CONTENT_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function guardarContentCache(data) {
    try {
      localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

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

  // Un elemento solo puede recibir zoom/pan de forma segura si algún
  // ancestro recorta el desbordamiento (si no, la foto ampliada se saldría
  // de su hueco y taparía el contenido de al lado).
  function hasClippingAncestor(el) {
    var node = el.parentElement;
    while (node && node !== document.body) {
      var cs = getComputedStyle(node);
      if (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflowY === 'hidden' || cs.overflow === 'clip') {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  function applyViewTransform(img, view) {
    img.style.transformOrigin = 'center center';
    img.style.transform = 'scale(' + view.s + ') translate(' + view.x + '%, ' + view.y + '%)';
  }

  function applyImageViews(views) {
    document.querySelectorAll('img[data-slot]').forEach(function (img) {
      var key = img.getAttribute('data-slot');
      var view = views[key];
      if (view && hasClippingAncestor(img)) applyViewTransform(img, view);
    });
  }

  function applyColors(colors) {
    document.querySelectorAll('[data-color-bg]').forEach(function (el) {
      var id = el.getAttribute('data-color-bg');
      if (colors[id]) el.style.backgroundColor = colors[id];
    });
    document.querySelectorAll('[data-color-text]').forEach(function (el) {
      var id = el.getAttribute('data-color-text');
      if (colors[id]) el.style.color = colors[id];
    });
  }

  // Quita del HTML cualquier control que el propio modo edición haya podido
  // inyectar dentro de un [data-edit] (el círculo de color, la barra de
  // formato de texto...). Si alguna vez ese control quedó atrapado en el
  // texto guardado (por estar en el mismo elemento que data-color-*), esto
  // lo limpia tanto al pintarlo para los visitantes como antes de re-guardar.
  function limpiarControlesInyectados(html) {
    if (!html || html.indexOf('<') === -1) return html;
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('.bl-color-btn, .bl-toolbar, .bl-size-badge, .bl-crop-frame, ' +
      '.bl-link-toolbar, .bl-text-toolbar, input[type="color"], input[type="file"]').forEach(function (n) {
      n.remove();
    });
    return tmp.innerHTML;
  }

  function applyTexts(texts) {
    document.querySelectorAll('[data-edit]').forEach(function (el) {
      var id = el.getAttribute('data-edit');
      if (texts[id] !== undefined) el.innerHTML = limpiarControlesInyectados(texts[id]);
    });
  }

  function applyLinks(links) {
    document.querySelectorAll('[data-link-id]').forEach(function (a) {
      var id = a.getAttribute('data-link-id');
      var cfg = links[id];
      if (!cfg) return;
      if (cfg.url) a.setAttribute('href', cfg.url);
      if (cfg.hidden) a.style.display = 'none';
    });
  }

  // Aplica de inmediato lo último visto (sin esperar red) para no enseñar la
  // foto/textos por defecto del HTML estático ni un instante en visitas
  // repetidas; el fetch de abajo la sustituye por la versión fresca en
  // cuanto llega, y si algo cambió desde la última visita se nota igual.
  var cache = leerContentCache();
  if (cache) {
    if (cache.images) applyImages(cache.images);
    if (cache.imageView) applyImageViews(cache.imageView);
    if (cache.colors) applyColors(cache.colors);
    if (cache.texts) applyTexts(cache.texts);
    if (cache.links) applyLinks(cache.links);
  }

  var loaded = fetch('/api/content', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      CONTENT.images = (data && data.images) || {};
      CONTENT.imageView = (data && data.imageView) || {};
      CONTENT.colors = (data && data.colors) || {};
      CONTENT.texts = (data && data.texts) || {};
      CONTENT.links = (data && data.links) || {};
      applyImages(CONTENT.images);
      applyImageViews(CONTENT.imageView);
      applyColors(CONTENT.colors);
      applyTexts(CONTENT.texts);
      applyLinks(CONTENT.links);
      guardarContentCache(CONTENT);
    })
    .catch(function () {});

  // ── MODO EDICIÓN ─────────────────────────────────────────────────────
  var params = new URLSearchParams(location.search);
  var wantsEdit = params.get('admin') === '1';
  if (!wantsEdit) return;

  loaded.then(function () {
    if (!window.BL_API || !BL_API.getToken()) {
      var back = encodeURIComponent(location.pathname + '?admin=1');
      location.href = '/admin.html?next=' + back;
      return;
    }
    initEditMode();
  });

  function toast(msg, ok) {
    try {
      window.parent.postMessage({ type: 'bl-save-status', ok: ok !== false, msg: msg }, '*');
    } catch (e) {}
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

  function notifySaving() {
    try {
      window.parent.postMessage({ type: 'bl-save-status', saving: true }, '*');
    } catch (e) {}
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
    wireColors();
    wireLinks();
  }

  function injectStyles() {
    var s = document.createElement('style');
    s.textContent =
      (inIframe ? '' : 'body{padding-top:44px!important;}') +
      '[data-edit]{outline-offset:2px;cursor:text;position:relative;}' +
      '[data-edit]:hover{outline:2px dashed #2F8FEA;}' +
      '[data-edit][contenteditable="true"]{outline:2px solid #2F8FEA;background:rgba(47,143,234,.08);}' +
      '[data-color-bg],[data-color-text]{position:relative;}' +
      '.bl-img-wrap{position:relative;display:inline-block;}' +
      '.bl-toolbar{position:absolute;top:6px;right:6px;display:none;gap:4px;z-index:100;}' +
      '.bl-toolbar.on{display:flex;}' +
      '.bl-toolbar button{background:rgba(23,35,63,.85);color:#fff;border:none;border-radius:6px;' +
      'padding:5px 8px;font-size:12px;cursor:pointer;font-family:Inter,sans-serif;white-space:nowrap;}' +
      '.bl-toolbar button:hover{background:#2F8FEA;}' +
      '.bl-color-btn{position:absolute;top:6px;left:6px;width:22px;height:22px;border-radius:50%;' +
      'border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer;display:none;z-index:100;' +
      'background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red);}' +
      '[data-color-bg]:hover>.bl-color-btn,[data-color-text]:hover>.bl-color-btn{display:block;}' +
      'img[data-slot][data-reframing]{cursor:grab;}' +
      'img[data-slot][data-reframing][data-panning]{cursor:grabbing;}' +
      '.bl-size-badge{position:absolute;bottom:6px;left:6px;background:rgba(23,35,63,.85);color:#FBF4E9;' +
      'font:600 11px/1.3 Inter,sans-serif;padding:4px 8px;border-radius:6px;z-index:100;display:none;' +
      'pointer-events:none;white-space:nowrap;}' +
      '.bl-size-badge.on{display:block;}' +
      '.bl-crop-frame{position:absolute;inset:0;pointer-events:none;outline:2px dashed #E8C24A;' +
      'outline-offset:-2px;z-index:99;display:none;}' +
      '.bl-crop-frame.on{display:block;}' +
      '.bl-text-toolbar{position:fixed;display:none;align-items:center;gap:4px;background:#17233F;' +
      'border-radius:8px;padding:5px;box-shadow:0 4px 16px rgba(0,0,0,.35);z-index:999997;' +
      'font-family:Inter,sans-serif;}' +
      '.bl-text-toolbar.on{display:flex;}' +
      '.bl-text-toolbar button{background:transparent;color:#FBF4E9;border:none;border-radius:5px;' +
      'width:28px;height:28px;cursor:pointer;font-size:13px;line-height:1;}' +
      '.bl-text-toolbar button:hover,.bl-text-toolbar button.active{background:#2F8FEA;}' +
      '.bl-text-toolbar .bl-tb-sep{width:1px;align-self:stretch;background:rgba(251,244,233,.2);margin:0 2px;}' +
      '.bl-tb-dd{position:relative;}' +
      '.bl-tb-dd>button{width:auto;padding:0 8px;font-size:12px;white-space:nowrap;}' +
      '.bl-tb-dd-menu{position:absolute;top:100%;left:0;margin-top:4px;background:#17233F;' +
      'border-radius:8px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,.35);display:none;' +
      'flex-direction:column;min-width:130px;max-height:220px;overflow-y:auto;z-index:999998;}' +
      '.bl-tb-dd-menu.on{display:flex;}' +
      '.bl-tb-dd-menu button{width:100%;text-align:left;padding:6px 8px;height:auto;}' +
      '.bl-link-wrap{position:relative;display:inline-block;}' +
      '.bl-link-toolbar{position:absolute;top:-4px;right:-4px;display:none;gap:3px;z-index:100;transform:translateY(-100%);}' +
      '.bl-link-wrap:hover>.bl-link-toolbar{display:flex;}' +
      '.bl-link-toolbar button{background:rgba(23,35,63,.9);color:#fff;border:none;border-radius:5px;' +
      'padding:3px 6px;font-size:11px;cursor:pointer;line-height:1.4;}' +
      '.bl-link-toolbar button:hover{background:#2F8FEA;}' +
      '[data-link-id][data-link-hidden]{opacity:.35;}';
    document.head.appendChild(s);
  }

  function injectExitPill() {
    var bar = document.createElement('div');
    bar.id = 'bl-edit-bar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:44px;background:#17233F;' +
      'color:#FBF4E9;display:flex;align-items:center;gap:16px;padding:0 16px;z-index:999998;' +
      'font:600 12px/1 Inter,sans-serif;';
    bar.innerHTML =
      '<strong style="color:#E8C24A;">✏️ MODO EDICIÓN</strong>' +
      '<span style="opacity:.8;">haz clic en cualquier foto, texto o color para cambiarlo</span>' +
      '<span style="flex:1;"></span>' +
      '<a href="admin.html" style="color:#FBF4E9;border:1px solid #FBF4E9;padding:6px 12px;border-radius:14px;">Ir al panel→</a>';
    document.body.prepend(bar);
  }

  // ── TEXTOS ───────────────────────────────────────────────────────────
  var FONT_CHOICES = [
    { label: 'Fuente…', value: '' },
    { label: 'Inter', value: 'Inter, sans-serif' },
    { label: 'Helvetica', value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
    { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
    { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' }
  ];
  var SIZE_CHOICES = ['Tamaño…', '12', '14', '16', '18', '20', '24', '28', '32', '40', '56'];

  var textToolbar = null;
  var activeTextEl = null;
  var savedTextSelection = null;
  var savedTextEl = null;

  function buildTextToolbar() {
    if (textToolbar) return textToolbar;
    var bar = document.createElement('div');
    bar.className = 'bl-text-toolbar';

    function addBtn(label, title, cmd, val) {
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = label;
      b.title = title;
      b.addEventListener('mousedown', function (e) {
        e.preventDefault();
        document.execCommand(cmd, false, val);
        if (activeTextEl) activeTextEl.focus();
      });
      bar.appendChild(b);
      return b;
    }

    addBtn('<b>B</b>', 'Negrita', 'bold');
    addBtn('<i>I</i>', 'Cursiva', 'italic');
    addBtn('<u>U</u>', 'Subrayado', 'underline');

    var sep1 = document.createElement('span');
    sep1.className = 'bl-tb-sep';
    bar.appendChild(sep1);

    function addDropdown(label, options, onPick) {
      var wrap = document.createElement('span');
      wrap.className = 'bl-tb-dd';
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.textContent = label;
      var menu = document.createElement('div');
      menu.className = 'bl-tb-dd-menu';
      options.forEach(function (opt) {
        var item = document.createElement('button');
        item.type = 'button';
        item.textContent = opt.label;
        item.addEventListener('mousedown', function (e) {
          e.preventDefault();
          e.stopPropagation();
          onPick(opt.value);
          menu.classList.remove('on');
          if (activeTextEl) activeTextEl.focus();
        });
        menu.appendChild(item);
      });
      toggle.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var wasOn = menu.classList.contains('on');
        bar.querySelectorAll('.bl-tb-dd-menu.on').forEach(function (m) { m.classList.remove('on'); });
        if (!wasOn) menu.classList.add('on');
      });
      wrap.appendChild(toggle);
      wrap.appendChild(menu);
      bar.appendChild(wrap);
      return wrap;
    }

    addDropdown('Fuente ▾', FONT_CHOICES.slice(1), function (value) {
      applyStyleToSelection('fontFamily', value);
    });
    addDropdown('Tamaño ▾', SIZE_CHOICES.slice(1).map(function (s) {
      return { label: s + ' px', value: s + 'px' };
    }), function (value) {
      applyStyleToSelection('fontSize', value);
    });

    var colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.title = 'Color del texto';
    colorInput.style.cssText = 'width:26px;height:26px;padding:0;border:none;border-radius:5px;' +
      'background:transparent;cursor:pointer;';
    colorInput.addEventListener('mousedown', function () {
      var sel = window.getSelection();
      savedTextSelection = (sel && sel.rangeCount && !sel.isCollapsed) ? sel.getRangeAt(0).cloneRange() : null;
      savedTextEl = activeTextEl;
    });
    colorInput.addEventListener('change', function () {
      var el = savedTextEl;
      if (!el || !savedTextSelection) return;
      el.setAttribute('contenteditable', 'true');
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedTextSelection);
      applyStyleToSelection('color', colorInput.value);
      saveText(el.getAttribute('data-edit'), limpiarControlesInyectados(el.innerHTML.trim()));
      el.focus();
      showTextToolbar(el);
    });
    bar.appendChild(colorInput);

    document.addEventListener('mousedown', function (e) {
      if (!bar.contains(e.target)) {
        bar.querySelectorAll('.bl-tb-dd-menu.on').forEach(function (m) { m.classList.remove('on'); });
      }
    });

    var sep2 = document.createElement('span');
    sep2.className = 'bl-tb-sep';
    bar.appendChild(sep2);

    var linkBtn = document.createElement('button');
    linkBtn.type = 'button';
    linkBtn.innerHTML = '🔗';
    linkBtn.title = 'Añadir enlace';
    linkBtn.addEventListener('mousedown', function (e) {
      e.preventDefault();
      var url = prompt('URL del enlace:', 'https://');
      if (activeTextEl) activeTextEl.focus();
      if (!url) return;
      document.execCommand('createLink', false, url.trim());
    });
    bar.appendChild(linkBtn);

    addBtn('🔗∅', 'Quitar enlace', 'unlink');

    document.body.appendChild(bar);
    textToolbar = bar;
    return bar;
  }

  function applyStyleToSelection(prop, value) {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    var range = sel.getRangeAt(0);
    var span = document.createElement('span');
    span.style[prop] = value;
    try {
      range.surroundContents(span);
    } catch (err) {
      var frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    sel.removeAllRanges();
    var newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.addRange(newRange);
  }

  function positionTextToolbar(el) {
    var bar = textToolbar;
    var rect = el.getBoundingClientRect();
    var barH = bar.offsetHeight || 38;
    var top = rect.top - barH - 8;
    if (top < 4) top = rect.bottom + 8;
    var left = Math.max(4, Math.min(rect.left, window.innerWidth - bar.offsetWidth - 4));
    bar.style.top = top + 'px';
    bar.style.left = left + 'px';
  }

  function showTextToolbar(el) {
    buildTextToolbar();
    activeTextEl = el;
    textToolbar.classList.add('on');
    positionTextToolbar(el);
    var reposition = function () { if (activeTextEl === el) positionTextToolbar(el); };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    el._tbReposition = reposition;
  }

  function hideTextToolbar(el) {
    if (!textToolbar) return;
    textToolbar.classList.remove('on');
    if (activeTextEl === el) activeTextEl = null;
    if (el._tbReposition) {
      window.removeEventListener('scroll', el._tbReposition, true);
      window.removeEventListener('resize', el._tbReposition);
      el._tbReposition = null;
    }
  }

  function wireTexts() {
    document.querySelectorAll('[data-edit]').forEach(function (el) {
      el.title = 'Clic para editar';
      el.addEventListener('click', function (e) {
        if (el.getAttribute('contenteditable') === 'true') return;
        if (e.target.closest('.bl-color-btn')) return;
        e.preventDefault();
        e.stopPropagation();
        el.setAttribute('contenteditable', 'true');
        el.focus();
        showTextToolbar(el);
      });
      el.addEventListener('blur', function () {
        // Si el foco se movió a la barra de herramientas (clic en un botón),
        // los botones ya hacen preventDefault en mousedown, así que este
        // blur solo ocurre al salir de verdad del texto.
        el.removeAttribute('contenteditable');
        hideTextToolbar(el);
        saveText(el.getAttribute('data-edit'), limpiarControlesInyectados(el.innerHTML.trim()));
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
    notifySaving();
    fetch('/api/save-text', {
      method: 'POST',
      headers: BL_API.authHeaders(),
      body: JSON.stringify({ id: id, text: text })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        // Si falla, se limpia el guard: si no, reescribir exactamente el
        // mismo texto tras un fallo no reintentaría el guardado (savingText
        // seguiría marcando ese texto como "ya guardado" aunque el POST
        // nunca tuvo éxito).
        if (!d.ok && savingText[id] === text) delete savingText[id];
        toast(d.ok ? 'Guardado ✓' : ('Error: ' + d.error), d.ok);
      })
      .catch(function () {
        if (savingText[id] === text) delete savingText[id];
        toast('Error de conexión', false);
      });
  }

  // ── COLORES ──────────────────────────────────────────────────────────
  function wireColors() {
    document.querySelectorAll('[data-color-bg], [data-color-text]').forEach(function (el) {
      if (el.querySelector(':scope > .bl-color-btn')) return;
      var btn = document.createElement('input');
      btn.type = 'color';
      btn.className = 'bl-color-btn';
      var bgId = el.getAttribute('data-color-bg');
      var textId = el.getAttribute('data-color-text');
      btn.value = toHex(getComputedStyle(el)[bgId ? 'backgroundColor' : 'color']) || '#000000';
      btn.addEventListener('click', function (e) { e.stopPropagation(); });
      btn.addEventListener('input', function () {
        if (bgId) el.style.backgroundColor = btn.value;
        if (textId) el.style.color = btn.value;
      });
      btn.addEventListener('change', function () {
        if (bgId) saveColor(bgId, btn.value);
        if (textId) saveColor(textId, btn.value);
      });
      el.appendChild(btn);
    });
  }

  function toHex(rgbStr) {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgbStr || '');
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(function (n) {
      return ('0' + parseInt(n, 10).toString(16)).slice(-2);
    }).join('');
  }

  function saveColor(id, value) {
    notifySaving();
    fetch('/api/save-color', {
      method: 'POST',
      headers: BL_API.authHeaders(),
      body: JSON.stringify({ id: id, value: value })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { toast(d.ok ? 'Color guardado ✓' : ('Error: ' + d.error), d.ok); })
      .catch(function () { toast('Error de conexión', false); });
  }

  // ── ENLACES (redes sociales y similares) ────────────────────────────────
  function wireLinks() {
    document.querySelectorAll('[data-link-id]').forEach(function (a) {
      if (a.parentElement && a.parentElement.classList.contains('bl-link-wrap')) return;
      var wrap = document.createElement('span');
      wrap.className = 'bl-link-wrap';
      a.parentElement.insertBefore(wrap, a);
      wrap.appendChild(a);

      var id = a.getAttribute('data-link-id');
      if (CONTENT.links[id] && CONTENT.links[id].hidden) {
        a.style.display = '';
        a.setAttribute('data-link-hidden', '');
      }

      var toolbar = document.createElement('span');
      toolbar.className = 'bl-link-toolbar';

      var editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = '🔗';
      editBtn.title = 'Cambiar URL';
      editBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var current = a.getAttribute('href') || '';
        var next = prompt('Nueva URL para «' + id + '»:', current);
        if (next === null) return;
        next = next.trim();
        if (!next) return;
        a.setAttribute('href', next);
        saveLink(id, { url: next });
      });
      toolbar.appendChild(editBtn);

      var toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      var setToggleLabel = function () {
        toggleBtn.textContent = a.hasAttribute('data-link-hidden') ? '👁' : '🙈';
        toggleBtn.title = a.hasAttribute('data-link-hidden') ? 'Mostrar' : 'Ocultar';
      };
      setToggleLabel();
      toggleBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var nowHidden = !a.hasAttribute('data-link-hidden');
        if (nowHidden) a.setAttribute('data-link-hidden', '');
        else a.removeAttribute('data-link-hidden');
        setToggleLabel();
        saveLink(id, { hidden: nowHidden });
      });
      toolbar.appendChild(toggleBtn);

      wrap.appendChild(toolbar);
    });
  }

  function saveLink(id, patch) {
    if (!id) return;
    notifySaving();
    fetch('/api/save-color', {
      method: 'POST',
      headers: BL_API.authHeaders(),
      body: JSON.stringify(Object.assign({ id: id }, patch))
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { toast(d.ok ? 'Enlace guardado ✓' : ('Error: ' + d.error), d.ok); })
      .catch(function () { toast('Error de conexión', false); });
  }

  // Tamaño recomendado = el hueco visible en pantalla, escalado a píxeles
  // reales de pantalla (devicePixelRatio) para que la foto se vea nítida.
  function recommendedSize(img) {
    var rect = img.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    return {
      w: Math.max(1, Math.round(rect.width * dpr)),
      h: Math.max(1, Math.round(rect.height * dpr))
    };
  }

  // ── IMÁGENES: cambiar foto + encuadre (zoom/posición) ──────────────────
  function wireImages() {
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    var targetImg = null;
    var reframeBtnBySlot = {};

    document.querySelectorAll('img[data-slot]').forEach(function (img) {
      img.draggable = false;
      var canReframe = hasClippingAncestor(img);

      var toolbar = document.createElement('div');
      toolbar.className = 'bl-toolbar';
      var replaceBtn = document.createElement('button');
      replaceBtn.type = 'button';
      replaceBtn.textContent = '📤 Cambiar';
      toolbar.appendChild(replaceBtn);
      var reframeBtn = null;
      if (canReframe) {
        reframeBtn = document.createElement('button');
        reframeBtn.type = 'button';
        reframeBtn.textContent = '⤢ Encuadre';
        toolbar.appendChild(reframeBtn);
      }

      // El toolbar se posiciona con position:absolute respecto al contenedor
      // más cercano; si la imagen no tiene un contenedor con position, se le
      // envuelve en un span relative sin cambiar su layout.
      var host = img.parentElement;
      if (getComputedStyle(host).position === 'static') {
        var wrap = document.createElement('span');
        wrap.className = 'bl-img-wrap';
        host.insertBefore(wrap, img);
        wrap.appendChild(img);
        host = wrap;
      } else {
        host.style.position = host.style.position || 'relative';
      }
      host.appendChild(toolbar);

      var badge = document.createElement('div');
      badge.className = 'bl-size-badge';
      host.appendChild(badge);
      var updateBadge = function () {
        var size = recommendedSize(img);
        badge.textContent = 'Tamaño ideal: ' + size.w + '×' + size.h + ' px';
      };
      updateBadge();
      window.addEventListener('resize', updateBadge);

      var cropFrame = null;
      if (canReframe) {
        cropFrame = document.createElement('div');
        cropFrame.className = 'bl-crop-frame';
        host.appendChild(cropFrame);
        img._cropFrame = cropFrame;
      }

      host.addEventListener('mouseenter', function () { toolbar.classList.add('on'); badge.classList.add('on'); });
      host.addEventListener('mouseleave', function () {
        if (!img.hasAttribute('data-reframing')) { toolbar.classList.remove('on'); badge.classList.remove('on'); }
      });

      // En móvil no hay mouseenter/mouseleave, así que el toolbar (Cambiar/
      // Encuadre) nunca aparecía: tocar la imagen lo muestra u oculta. Se
      // filtra por pointerType==='touch' para no interferir con el hover
      // normal en ratón (si no, un click con el toolbar ya visible por
      // hover lo ocultaría de golpe aunque el ratón siguiera encima).
      img.addEventListener('pointerup', function (e) {
        if (e.pointerType !== 'touch') return;
        if (img.hasAttribute('data-reframing')) return; // ya encuadrando: el toque hace pan, no toggle
        e.preventDefault(); e.stopPropagation();
        var showing = toolbar.classList.toggle('on');
        badge.classList.toggle('on', showing);
      });

      replaceBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        targetImg = img;
        fileInput.click();
      });

      if (reframeBtn) {
        reframeBtnBySlot[img.getAttribute('data-slot')] = reframeBtn;
        reframeBtn.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          if (img.hasAttribute('data-reframing')) exitReframe(img, true);
          else enterReframe(img);
        });
      }
    });

    fileInput.addEventListener('change', async function () {
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file || !targetImg) return;
      var img = targetImg;
      var slot = img.getAttribute('data-slot');
      var prevSrc = img.src;
      var canReframe = hasClippingAncestor(img);
      var needed = recommendedSize(img);
      img.style.opacity = '.5';
      try {
        var bitmap = await createImageBitmap(file);
        var tooSmall = bitmap.width < needed.w || bitmap.height < needed.h;
        var oversized = canReframe && (bitmap.width > needed.w * 1.05 || bitmap.height > needed.h * 1.05);
        if (bitmap.close) bitmap.close();

        var dataUrl = await resizeImageToDataUrl(file);
        notifySaving();
        var r = await fetch('/api/upload-image', {
          method: 'POST',
          headers: BL_API.authHeaders(),
          body: JSON.stringify({ path: slot, dataUrl: dataUrl })
        });
        var d = await r.json();
        if (!d.ok) throw new Error(d.error || 'Error al subir');
        img.src = d.url;

        // La foto nueva no tiene por qué encajar con el zoom/posición que se
        // hubiera guardado para la foto anterior en este mismo hueco — sin
        // este reseteo, se seguía aplicando el encuadre viejo sobre la
        // imagen nueva y se veía descuadrada o "rota". El reseteo en sí ya
        // lo hace /api/upload-image en la misma escritura (ver ahí el porqué
        // de no lanzar aquí una segunda petición a /api/save-image-view).
        img.style.transform = '';
        delete CONTENT.imageView[slot];

        if (tooSmall) {
          toast('Imagen actualizada, pero es más pequeña de lo ideal (' + needed.w + '×' + needed.h + ' px) y puede verse borrosa', true);
        } else if (oversized) {
          toast('Imagen actualizada ✓ — es más grande de lo necesario, elige qué parte mostrar', true);
          if (reframeBtnBySlot[slot]) reframeBtnBySlot[slot].click();
        } else {
          toast('Imagen actualizada ✓', true);
        }
      } catch (err) {
        img.src = prevSrc;
        toast('Error: ' + err.message, false);
      } finally {
        img.style.opacity = '';
      }
    });
  }

  var reframeState = {};
  function enterReframe(img) {
    var slot = img.getAttribute('data-slot');
    var saved = CONTENT.imageView[slot];
    var view = saved ? { s: saved.s, x: saved.x, y: saved.y } : { s: 1, x: 0, y: 0 };
    reframeState[slot] = view;
    img.setAttribute('data-reframing', '');
    applyViewTransform(img, view);
    if (img._cropFrame) img._cropFrame.classList.add('on');
    var badgeEl = img.parentElement && img.parentElement.querySelector('.bl-size-badge');
    if (badgeEl) badgeEl.classList.add('on');

    var rect;
    var start;
    function onWheel(e) {
      e.preventDefault();
      var v = reframeState[slot];
      v.s = Math.max(1, Math.min(3, v.s * Math.pow(1.0015, -e.deltaY)));
      applyViewTransform(img, v);
    }
    function onDown(e) {
      e.preventDefault();
      img.setAttribute('data-panning', '');
      rect = img.getBoundingClientRect();
      start = { px: e.clientX, py: e.clientY, x: reframeState[slot].x, y: reframeState[slot].y };
      img.setPointerCapture(e.pointerId);
    }
    function onMove(e) {
      if (!start) return;
      var v = reframeState[slot];
      v.x = Math.max(-60, Math.min(60, start.x + (e.clientX - start.px) / rect.width * 100));
      v.y = Math.max(-60, Math.min(60, start.y + (e.clientY - start.py) / rect.height * 100));
      applyViewTransform(img, v);
    }
    function onUp(e) {
      start = null;
      img.removeAttribute('data-panning');
      try { img.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    function onKey(e) { if (e.key === 'Escape') exitReframe(img, true); }
    function onOutside(e) { if (e.target !== img) exitReframe(img, true); }

    img._reframeHandlers = { onWheel: onWheel, onDown: onDown, onMove: onMove, onUp: onUp, onKey: onKey, onOutside: onOutside };
    img.addEventListener('wheel', onWheel, { passive: false });
    img.addEventListener('pointerdown', onDown);
    img.addEventListener('pointermove', onMove);
    img.addEventListener('pointerup', onUp);
    document.addEventListener('keydown', onKey);
    setTimeout(function () { document.addEventListener('pointerdown', onOutside, true); }, 0);
    toast('Arrastra para mover, rueda del ratón para hacer zoom · Esc para salir', true);
  }

  function exitReframe(img, commit) {
    var slot = img.getAttribute('data-slot');
    var h = img._reframeHandlers;
    if (h) {
      img.removeEventListener('wheel', h.onWheel);
      img.removeEventListener('pointerdown', h.onDown);
      img.removeEventListener('pointermove', h.onMove);
      img.removeEventListener('pointerup', h.onUp);
      document.removeEventListener('keydown', h.onKey);
      document.removeEventListener('pointerdown', h.onOutside, true);
      img._reframeHandlers = null;
    }
    img.removeAttribute('data-reframing');
    img.removeAttribute('data-panning');
    var toolbar = img.parentElement && img.parentElement.querySelector('.bl-toolbar');
    if (toolbar) toolbar.classList.remove('on');
    if (img._cropFrame) img._cropFrame.classList.remove('on');
    var badgeEl2 = img.parentElement && img.parentElement.querySelector('.bl-size-badge');
    if (badgeEl2) badgeEl2.classList.remove('on');
    if (commit && reframeState[slot]) {
      var v = reframeState[slot];
      CONTENT.imageView[slot] = v;
      notifySaving();
      fetch('/api/save-image-view', {
        method: 'POST',
        headers: BL_API.authHeaders(),
        body: JSON.stringify({ path: slot, s: v.s, x: v.x, y: v.y })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) { toast(d.ok ? 'Encuadre guardado ✓' : ('Error: ' + d.error), d.ok); })
        .catch(function () { toast('Error de conexión', false); });
    }
  }
})();
