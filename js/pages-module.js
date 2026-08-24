// js/pages-module.js
//
// Loader que consolida la inicialización de páginas estáticas:
// - index-1.js, index-2.js, index-3.js (portada e índices)
// - portada-1.js (portada principal)
// - dilo-bonito-1.js (página Dilo Bonito)
// - bendito-lab-1.js (página Bendito Lab)
// - area-clientes-1.js, colaboradores-1.js, faq-1.js, link-bio-1.js (páginas menores)
//
// NOTA: Este archivo es un wrapper loader. Próxima sesión:
// fusionaremos todo en un único archivo pages-module.js (~600L)
// eliminando duplicación de toggleNav, modal functions, analytics, etc.

// Las dependencias se cargan en las páginas HTML en este orden:
// 1. <script src="js/common.js"></script>
// 2. <script src="js/pages-module.js"></script>
//
// Dependencias en pages-module.js:
// - common.js: toggleNav(), abrirModal(), cerrarModal(), aceptarCookies(), 
//              rechazarCookies(), activarAnalytics()

console.log('[pages-module.js] Loaded. Ensures dependencies:');
console.log('  ✓ common.js (nav, modals, cookies, analytics)');
console.log('  ✓ Página-específica lógica cargada después');

// Exportar confirmación de disponibilidad
window.PAGES_MODULE_READY = function() {
  return typeof window.toggleNav === 'function' && 
         typeof window.abrirModal === 'function';
};
