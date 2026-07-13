
// Cargar colores personalizados desde localStorage (admin) y Sheets
(function() {
  var COLOR_VARS = ['cream','deep','captain','baby','sunshine','poppy','white','mid','gray'];
  var root = document.documentElement;

  // 1. Primero aplicar desde localStorage (guardado por el admin)
  try {
    var stored = localStorage.getItem('bl-portada-v1');
    if (stored) {
      var data = JSON.parse(stored);
      COLOR_VARS.forEach(function(id) {
        var val = data['color-' + id];
        if (val && val.startsWith('#')) {
          root.style.setProperty('--' + id, val);
        }
      });
    }
  } catch(e) {}

  // 2. Luego intentar Sheets (sobreescribe si hay datos más recientes)
  setTimeout(async function() {
    try {
      var r = await fetch('/api/proxy?scope=web&web=portada&t=' + Date.now());
      var d = await r.json();
      if (!d.ok || !d.data) return;
      var data = d.data;
      // Formato Sheets: colores.cream → --cream
      COLOR_VARS.forEach(function(id) {
        var val = data['colores.' + id] || data['color-' + id];
        if (val && val.startsWith('#')) {
          root.style.setProperty('--' + id, val);
        }
      });
    } catch(e) { /* sin conexión — se usan los del localStorage o los por defecto */ }
  }, 300);
})();
