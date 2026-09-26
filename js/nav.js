// Menú móvil compartido: abre/cierra la navegación con el botón hamburguesa.
// Se carga antes del script propio de cada página, que es quien engancha
// toggleNav al botón. index.html tiene su propia versión (en index-1.js).
function toggleNav(){ document.body.classList.toggle('nav-open'); }
