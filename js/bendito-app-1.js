// js/bendito-app-1.js — Lógica de /bendito-app: login, pestañas, generador
// con IA, feed de posts y galería de inspiración. Vanilla JS, usa BL_API
// (js/bl-api.js) para auth y llama a /api/bendito.
(function () {
  'use strict';

  var state = {
    imageInfo: null,   // { base64, mediaType, dataUrl }
    imageUrl: null,
    inspirationId: null,
    genResult: null,
    refreshKey: 0,
  };

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── LOGIN ──────────────────────────────────────────────
  async function checkLogin() {
    var pwd = el('pwd').value;
    var btn = document.querySelector('.login-btn');
    var err = el('login-err');
    err.style.display = 'none';
    if (btn) { btn.disabled = true; btn.textContent = 'Entrando…'; }
    try {
      var ok = await BL_API.login(pwd);
      if (ok) {
        el('login').style.display = 'none';
        enterApp();
      } else {
        err.textContent = 'Contraseña incorrecta';
        err.style.display = 'block';
        el('pwd').value = '';
      }
    } catch (e) {
      err.textContent = 'Error de conexión: ' + e.message;
      err.style.display = 'block';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'ENTRAR →'; }
    }
  }

  function logout() {
    BL_API.setToken(null);
    el('app').style.display = 'none';
    el('login').style.display = 'flex';
  }

  function enterApp() {
    el('app').style.display = 'block';
    loadFeeds();
    loadGallery();
  }

  // ── TABS ───────────────────────────────────────────────
  function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.panel').forEach(function (p) {
      p.classList.toggle('active', p.dataset.panel === tab);
    });
  }

  // ── FEEDS (IG / LI / WA) ──────────────────────────────
  async function loadFeeds() {
    ['ig', 'li', 'wa'].forEach(function (ch) {
      el('feed-' + ch).innerHTML = '<p class="feed-empty">Cargando…</p>';
    });
    var posts;
    try {
      var d = await BL_API.benditoGet('posts');
      posts = d.data || [];
    } catch (e) {
      ['ig', 'li', 'wa'].forEach(function (ch) {
        el('feed-' + ch).innerHTML = '<p class="feed-empty">Error cargando publicaciones: ' + esc(e.message) + '</p>';
      });
      return;
    }
    ['ig', 'li', 'wa'].forEach(function (ch) { renderFeed(ch, posts); });
  }

  function renderFeed(channel, posts) {
    var box = el('feed-' + channel);
    if (!posts.length) {
      box.innerHTML = '<p class="feed-empty">Todavía no hay publicaciones guardadas.</p>';
      return;
    }
    box.innerHTML = posts.map(function (p) { return postCardHtml(channel, p); }).join('');
    box.querySelectorAll('[data-del-id]').forEach(function (btn) {
      btn.addEventListener('click', function () { deletePost(btn.dataset.delId); });
    });
    box.querySelectorAll('[data-copy-text]').forEach(function (btn) {
      btn.addEventListener('click', function () { copyToClipboard(btn.dataset.copyText, btn); });
    });
  }

  function postCardHtml(channel, p) {
    var del = '<button class="post-del" data-del-id="' + p.id + '">×</button>';
    if (channel === 'wa') {
      return '<div class="post-card">' + del +
        '<div class="wa-head">' + esc(p.handle) + ' · Canal de difusión</div>' +
        '<div class="wa-wrap"><div class="wa-bubble">' +
        '<img src="' + esc(p.image_url) + '">' +
        '<p>' + esc(p.wa_text || '(sin copy de WhatsApp)') + '</p>' +
        '</div></div>' +
        '<div class="post-copy-row"><button class="copy-btn" data-copy-text="' + esc(p.wa_text || '') + '">Copiar copy</button></div>' +
        '</div>';
    }
    var isIg = channel === 'ig';
    var caption = isIg ? p.ig_caption : p.li_caption;
    var hashtags = isIg ? p.ig_hashtags : p.li_hashtags;
    var name = isIg ? p.handle : p.li_name;
    var full = (caption || '') + '\n\n' + (hashtags || '');
    return '<div class="post-card">' + del +
      '<div class="post-head">' + esc(name) + '</div>' +
      '<img class="post-img" src="' + esc(p.image_url) + '">' +
      '<div class="post-body"><p>' + esc(caption) + '</p><p class="post-tags">' + esc(hashtags) + '</p></div>' +
      '<div class="post-copy-row"><button class="copy-btn" data-copy-text="' + esc(full) + '">Copiar copy</button></div>' +
      '</div>';
  }

  async function deletePost(id) {
    if (!confirm('¿Eliminar esta publicación?')) return;
    try {
      await BL_API.benditoPost({ accion: 'eliminarPost', id: id });
      loadFeeds();
    } catch (e) {
      alert('Error al eliminar: ' + e.message);
    }
  }

  function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(function () {
      var orig = btn.textContent;
      btn.classList.add('copied');
      btn.textContent = '✓ Copiado';
      setTimeout(function () { btn.classList.remove('copied'); btn.textContent = orig; }, 1500);
    }).catch(function () {});
  }

  // ── GALLERY ────────────────────────────────────────────
  async function loadGallery() {
    var box = el('gallery');
    var items;
    try {
      var d = await BL_API.benditoGet('inspirations');
      items = d.data || [];
    } catch (e) {
      box.innerHTML = '<p class="feed-empty">Error cargando inspiración: ' + esc(e.message) + '</p>';
      return;
    }
    if (!items.length) {
      box.innerHTML = '<p class="feed-empty">Sube tu primera imagen desde el Generador IA.</p>';
      return;
    }
    box.innerHTML = '<p class="gallery-hint">✓ verde = ya usada para un post</p><div class="gallery-grid">' +
      items.map(function (i) {
        return '<div class="gallery-item"><img src="' + esc(i.image_url) + '">' +
          (i.used ? '<span class="gallery-used">✓</span>' : '') + '</div>';
      }).join('') + '</div>';
  }

  // ── GENERADOR IA ───────────────────────────────────────
  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = reader.result;
        resolve({ base64: dataUrl.split(',')[1], mediaType: file.type, dataUrl: dataUrl });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function setGenStatus(msg) { el('gen-status').textContent = msg || ''; }

  async function handleFileChange(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    var info = await fileToBase64(file);
    state.imageInfo = info;
    state.genResult = null;
    el('gen-result').style.display = 'none';
    el('gen-preview').src = info.dataUrl;
    el('gen-preview').style.display = 'block';
    setGenStatus('Subiendo imagen…');

    try {
      var up = await BL_API.benditoPost({ accion: 'subirImagen', base64: info.base64, mediaType: info.mediaType, filename: 'inspiracion' });
      state.imageUrl = up.url;

      var insp = await BL_API.benditoPost({ accion: 'crearInspiracion', image_url: up.url });
      state.inspirationId = insp.data.id;

      setGenStatus('Analizando imagen…');
      var prompt = await BL_API.benditoPost({ accion: 'sugerirPrompt', base64: info.base64, mediaType: info.mediaType });
      if (prompt.suggested_prompt) {
        el('gen-prompt').value = prompt.suggested_prompt;
        await BL_API.benditoPost({ accion: 'actualizarInspiracion', id: state.inspirationId, prompt: prompt.suggested_prompt });
      }
      setGenStatus('✓ Prompt sugerido — edítalo si quieres.');
    } catch (err) {
      setGenStatus('Error: ' + err.message);
    }
  }

  async function handleGenerate() {
    var prompt = el('gen-prompt').value.trim();
    if (!state.imageInfo || !prompt) {
      setGenStatus('Sube una imagen y escribe/revisa el prompt.');
      return;
    }
    var btn = el('gen-btn');
    btn.disabled = true; btn.textContent = 'Generando…';
    setGenStatus('');
    try {
      var result = await BL_API.benditoPost({
        accion: 'generarCopy',
        base64: state.imageInfo.base64,
        mediaType: state.imageInfo.mediaType,
        prompt: prompt,
        cuenta: el('gen-cuenta').value,
        formato: el('gen-formato').value,
      });
      state.genResult = result;
      renderGenResult(result);
    } catch (err) {
      setGenStatus('Error generando el copy: ' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Generar con IA';
    }
  }

  function renderGenResult(r) {
    var blocks = [
      { label: 'Instagram', value: r.caption_ig + '\n\n' + r.hashtags_ig },
      { label: 'LinkedIn', value: r.caption_li + '\n\n' + r.hashtags_li },
      { label: 'WhatsApp', value: r.caption_wa },
      { label: 'Stories', value: r.stories_text },
    ];
    el('gen-blocks').innerHTML = blocks.map(function (b) {
      return '<div class="result-block"><div class="rb-head"><span class="rb-label">' + esc(b.label) +
        '</span><button class="copy-btn" data-copy-text="' + esc(b.value) + '">Copiar</button></div>' +
        '<p>' + esc(b.value) + '</p></div>';
    }).join('');
    el('gen-blocks').querySelectorAll('[data-copy-text]').forEach(function (btn) {
      btn.addEventListener('click', function () { copyToClipboard(btn.dataset.copyText, btn); });
    });
    el('gen-result').style.display = 'block';
  }

  async function handleSavePost() {
    if (!state.genResult || !state.imageUrl) return;
    var cuenta = el('gen-cuenta').value;
    var isDilo = cuenta === 'dilobonito';
    var prompt = el('gen-prompt').value;
    var r = state.genResult;

    var post = {
      cuenta: cuenta,
      handle: isDilo ? 'dilobonito.es' : 'bendito_lab',
      sub: prompt.slice(0, 60),
      image_url: state.imageUrl,
      ig_caption: r.caption_ig,
      ig_hashtags: r.hashtags_ig,
      li_name: isDilo ? 'Dilo Bonito' : 'Bendito Lab',
      li_role: isDilo ? 'Personalización en directo para bodas y eventos' : 'Personalización de producto para empresas y eventos',
      li_caption: r.caption_li,
      li_hashtags: r.hashtags_li,
      wa_text: r.caption_wa,
      stories_text: r.stories_text,
      fecha: 'Generado con IA',
    };

    try {
      await BL_API.benditoPost({ accion: 'crearPost', post: post, inspiration_id: state.inspirationId });
      setGenStatus('✓ Guardado en el archivo.');
      resetGenForm();
      loadFeeds();
      loadGallery();
      switchTab('ig');
    } catch (e) {
      setGenStatus('Error al guardar el post: ' + e.message);
    }
  }

  function resetGenForm() {
    state.imageInfo = null;
    state.imageUrl = null;
    state.inspirationId = null;
    state.genResult = null;
    el('gen-file').value = '';
    el('gen-preview').style.display = 'none';
    el('gen-prompt').value = '';
    el('gen-result').style.display = 'none';
  }

  // ── WIRING ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelector('.login-btn').addEventListener('click', checkLogin);
    el('pwd').addEventListener('keydown', function (e) { if (e.key === 'Enter') checkLogin(); });
    document.querySelector('.app-logout').addEventListener('click', logout);
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.dataset.tab); });
    });
    el('gen-file').addEventListener('change', handleFileChange);
    el('gen-btn').addEventListener('click', handleGenerate);
    document.querySelector('[data-action="save-post"]').addEventListener('click', handleSavePost);

    if (BL_API.getToken()) {
      el('login').style.display = 'none';
      enterApp();
    }
  });
})();
