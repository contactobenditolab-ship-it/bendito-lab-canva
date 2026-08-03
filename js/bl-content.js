// js/bl-content.js — Aplica el contenido editado desde /admin sobre los
// elementos [data-edit="pagina.clave"] de la página pública actual.
// Detecta automáticamente qué página(s) hay marcadas y consulta
// /api/web-content?pagina=... (público, solo lectura). Si no hay contenido
// guardado para una clave, se deja el texto estático del HTML tal cual.
(function () {
  function aplicar(pagina, datos) {
    if (!datos) return;
    document.querySelectorAll('[data-edit^="' + pagina + '."]').forEach(function (el) {
      var attr = el.getAttribute('data-edit');
      var key = attr.slice(pagina.length + 1);
      var val = datos[key];
      if (val !== undefined && val !== null && val !== '') {
        el.textContent = val;
      }
    });
  }

  var paginas = {};
  document.querySelectorAll('[data-edit]').forEach(function (el) {
    var attr = el.getAttribute('data-edit');
    var dot = attr.indexOf('.');
    if (dot > 0) paginas[attr.slice(0, dot)] = true;
  });

  Object.keys(paginas).forEach(function (pagina) {
    fetch('/api/web-content?pagina=' + encodeURIComponent(pagina))
      .then(function (r) { return r.json(); })
      .then(function (d) { aplicar(pagina, d && d.data); })
      .catch(function () { /* sin conexión — se queda el texto estático */ });
  });
})();
