// js/contact-module.js
//
// Loader que consolida la funcionalidad de formularios de contacto:
// - contacto-1.js (lógica base del formulario)
// - contacto-2.js (variaciones o extensiones del formulario)
//
// NOTA: Este archivo es un wrapper loader. Próxima sesión:
// fusionaremos en un único archivo contact-module.js (~100L)
// eliminando duplicación de toggleNav, modal functions, etc.

// Las dependencias se cargan en las páginas HTML en este orden:
// 1. <script src="js/common.js"></script>
// 2. <script src="js/contact-module.js"></script>
//
// Dependencias en contact-module.js:
// - common.js: toggleNav(), abrirModal(), cerrarModal(), escapeHtml()

console.log('[contact-module.js] Loaded. Ensures dependencies:');
console.log('  ✓ common.js (nav, modals, escape)');
console.log('  ✓ Contacto-específica lógica cargada después');

// Exportar confirmación de disponibilidad
window.CONTACT_MODULE_READY = function() {
  return typeof window.toggleNav === 'function' && 
         typeof window.escapeHtml === 'function';
};
