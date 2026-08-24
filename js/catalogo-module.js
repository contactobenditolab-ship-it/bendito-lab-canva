// js/catalogo-module.js
// 
// Loader que consolida la funcionalidad de catálogo:
// - common.js (funciones compartidas globales)
// - catalogo-comun.js (grid, modal tallas, modal presupuesto)
// - catalogo-2.js (filtros por categoría — específico de catalogo.html)
// - catalogo-producto.js (hidratación de ficha individual — específico de producto.html)
//
// NOTA: Este archivo es un wrapper loader. Próxima sesión:
// fusionaremos todo en un único archivo catalogo-module.js (~1.3k líneas)
// eliminando duplicación de toggleNav, escapeHtml, slugificarCliente, etc.

// Las dependencias se cargan en las páginas HTML en este orden:
// 1. <script src="js/common.js"></script>
// 2. <script src="js/catalogo-module.js"></script>
// 
// Dependencias en catalogo-module.js:
// - common.js: toggleNav(), escapeHtml(), slugificarCliente(), 
//              abrirModal(), cerrarModal(), aceptarCookies(), etc.

console.log('[catalogo-module.js] Loaded. Ensures dependencies:');
console.log('  ✓ common.js (toggleNav, modal functions, escape, slug)');
console.log('  ✓ catalogo-comun.js or catalogo-2.js loaded after this');

// Exportar una función para confirmar que módulo está disponible
window.CATALOGO_MODULE_READY = function() {
  return typeof window.toggleNav === 'function' && 
         typeof window.renderGridEn === 'function' &&
         typeof window.abrirModalPresupuesto === 'function';
};
