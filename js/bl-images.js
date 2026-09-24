// js/bl-images.js — Lee el contenido guardado en /api/content (fotos
// subidas, encuadres, colores, textos, enlaces y secciones ocultas) y lo
// aplica sobre la página estática. Se edita desde el editor visual
// (repo editorvisualbenditolabweb), que carga estas mismas páginas en un
// iframe; aquí ya no hay modo edición.
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
    // Los colores de la paleta global (deep, poppy, cream...) se guardan con
    // el mismo id que la variable CSS `--<id>` que ya usan casi todas las
    // secciones del sitio (`background:var(--deep)`, etc.) en su :root. Basta
    // con reaplicar esa variable en el elemento raíz para que todas las
    // secciones que la usan cambien de color a la vez, sin marcar cada una
    // con data-color-bg.
    Object.keys(colors).forEach(function (id) {
      if (colors[id]) document.documentElement.style.setProperty('--' + id, colors[id]);
    });
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
    // Secciones ocultas desde el editor visual. Se guardan en el mismo mapa
    // `links` (endpoint /api/save-color con { id, hidden }) con el prefijo
    // "seccion:" para no añadir otra Serverless Function (el plan está en el
    // límite). Si se vuelve a mostrar, hidden=false y se quita el display.
    document.querySelectorAll('[data-section]').forEach(function (el) {
      var cfg = links['seccion:' + el.getAttribute('data-section')];
      if (!cfg) return;
      el.style.display = cfg.hidden ? 'none' : '';
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

  fetch('/api/content', { cache: 'no-store' })
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
})();
