// js/bl-images.js — Sustituye las imágenes estáticas por las subidas desde
// el panel admin. Lee el mapa slot -> URL de Vercel Blob en /api/content y
// reescribe cualquier <img src="..."> cuyo src coincida con un slot conocido.
(function () {
  function normalize(src) {
    return (src || '').replace(/^\.?\//, '').split('?')[0];
  }

  function apply(map) {
    if (!map) return;
    document.querySelectorAll('img[src]').forEach(function (img) {
      var key = normalize(img.getAttribute('src'));
      if (map[key]) img.src = map[key];
    });
    document.querySelectorAll('[data-bg-slot]').forEach(function (el) {
      var key = el.getAttribute('data-bg-slot');
      if (map[key]) el.style.backgroundImage = "url('" + map[key] + "')";
    });
  }

  fetch('/api/content', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) { if (data) apply(data.images || {}); })
    .catch(function () {});
})();
