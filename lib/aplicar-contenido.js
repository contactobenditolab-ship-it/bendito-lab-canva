// lib/aplicar-contenido.js — Aplica en el servidor, sobre el HTML estático
// de una página, los cambios del editor visual: fotos, textos, colores,
// enlaces, secciones ocultas y tipografías. Es lo mismo que hace
// js/bl-images.js en el navegador, pero sin JavaScript en el cliente.
//
// Hace falta para los EMAILS: las newsletter-*.html se mandan como cuerpo
// del email (api/contact.js) quitando los <script>, así que bl-images.js
// nunca llega a ejecutarse y el cliente recibía las fotos y textos de
// ejemplo del HTML en vez de los editados. No aplica el zoom/encuadre de
// las fotos (los clientes de correo no soportan transform).
//
// Trabaja sobre cadenas, sin parser: las páginas newsletter-*.html son
// maquetación de email controlada por nosotros (tablas con estilos inline).

function escAttr(v) {
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// Igual que normalize() en bl-images.js: clave de una <img> sin data-slot.
function normalizarSrc(src) {
  return (src || '').replace(/^\.?\//, '').split('?')[0];
}

function leerAttr(tag, nombre) {
  const m = new RegExp('\\s' + nombre + '\\s*=\\s*"([^"]*)"', 'i').exec(tag);
  return m ? m[1] : null;
}

function ponerAttr(tag, nombre, valor) {
  const re = new RegExp('(\\s' + nombre + '\\s*=\\s*)"[^"]*"', 'i');
  if (re.test(tag)) return tag.replace(re, '$1"' + escAttr(valor) + '"');
  return tag.replace(/\s*(\/?)>$/, ' ' + nombre + '="' + escAttr(valor) + '"$1>');
}

// Añade (o sustituye) una propiedad CSS en el style inline de la etiqueta.
function ponerEstilo(tag, prop, valor) {
  const actual = leerAttr(tag, 'style') || '';
  const sinProp = actual
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d && d.split(':')[0].trim().toLowerCase() !== prop)
    .join(';');
  return ponerAttr(tag, 'style', (sinProp ? sinProp + ';' : '') + prop + ':' + valor);
}

// Recorre cada etiqueta de apertura que tenga el atributo y la reescribe.
function reescribirEtiquetas(html, atributo, fn) {
  const re = new RegExp('<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*\\s' + atributo + '\\s*=\\s*"[^"]*"[^>]*>', 'g');
  return html.replace(re, (tag) => fn(tag) || tag);
}

// Posición del cierre del elemento que empieza en `inicio` (índice justo
// después de su etiqueta de apertura), contando anidamiento del mismo tag.
function finDeElemento(html, nombreTag, inicio) {
  const re = new RegExp('<(/?)' + nombreTag + '\\b[^>]*>', 'gi');
  re.lastIndex = inicio;
  let nivel = 1;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].endsWith('/>')) continue;
    nivel += m[1] ? -1 : 1;
    if (nivel === 0) return { inicioCierre: m.index, finCierre: re.lastIndex };
  }
  return null;
}

// Sustituye el contenido interior (o el elemento entero) de cada elemento
// cuyo atributo cumpla `decidir`. decidir(tagApertura) → { interior } para
// cambiar el contenido, { quitar: true } para borrar el elemento, o null.
function reescribirElementos(html, atributo, decidir) {
  const re = new RegExp('<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*\\s' + atributo + '\\s*=\\s*"[^"]*"[^>]*>', 'g');
  let salida = '';
  let desde = 0;
  let m;
  while ((m = re.exec(html))) {
    const accion = decidir(m[0]);
    if (!accion) continue;
    const finApertura = m.index + m[0].length;
    const fin = finDeElemento(html, m[1], finApertura);
    if (!fin) continue;
    if (accion.quitar) {
      salida += html.slice(desde, m.index);
    } else {
      salida += html.slice(desde, finApertura) + accion.interior + html.slice(fin.inicioCierre, fin.finCierre);
    }
    desde = fin.finCierre;
    re.lastIndex = fin.finCierre;
  }
  return salida + html.slice(desde);
}

// Restos de controles del editor que pudieran haber quedado guardados
// dentro de un texto (mismo criterio que limpiarControlesInyectados).
function limpiarTexto(texto) {
  return String(texto)
    .replace(/<input\b[^>]*>/gi, '')
    .replace(/<(div|span|button)\b[^>]*class="[^"]*\bbl-(color-btn|toolbar|size-badge|crop-frame|link-toolbar|text-toolbar)\b[^"]*"[^>]*>[\s\S]*?<\/\1>/gi, '');
}

/**
 * @param {string} html  HTML estático de la página.
 * @param {object} contenido  { images, colors, texts, links, textFonts } como
 *   los devuelve GET /api/content.
 */
function aplicarContenido(html, contenido) {
  const images = (contenido && contenido.images) || {};
  const colors = (contenido && contenido.colors) || {};
  const texts = (contenido && contenido.texts) || {};
  const links = (contenido && contenido.links) || {};
  const textFonts = (contenido && contenido.textFonts) || {};

  // Secciones ocultas: en un email se quitan del todo.
  let out = reescribirElementos(html, 'data-section', (tag) => {
    const cfg = links['seccion:' + leerAttr(tag, 'data-section')];
    return cfg && cfg.hidden ? { quitar: true } : null;
  });

  // Textos (antes que el resto: sustituyen el interior del elemento).
  out = reescribirElementos(out, 'data-edit', (tag) => {
    const id = leerAttr(tag, 'data-edit');
    return Object.prototype.hasOwnProperty.call(texts, id) ? { interior: limpiarTexto(texts[id]) } : null;
  });

  // Fotos.
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    const key = leerAttr(tag, 'data-slot') || normalizarSrc(leerAttr(tag, 'src'));
    return images[key] ? ponerAttr(tag, 'src', images[key]) : tag;
  });
  out = reescribirEtiquetas(out, 'data-bg-slot', (tag) => {
    const url = images[leerAttr(tag, 'data-bg-slot')];
    return url ? ponerEstilo(tag, 'background-image', "url('" + url + "')") : null;
  });

  // Colores: además del style, bgcolor para los clientes de correo que lo leen.
  out = reescribirEtiquetas(out, 'data-color-bg', (tag) => {
    const color = colors[leerAttr(tag, 'data-color-bg')];
    if (!color) return null;
    const conEstilo = ponerEstilo(tag, 'background-color', color);
    return /\sbgcolor\s*=/i.test(conEstilo) ? ponerAttr(conEstilo, 'bgcolor', color) : conEstilo;
  });
  out = reescribirEtiquetas(out, 'data-color-text', (tag) => {
    const color = colors[leerAttr(tag, 'data-color-text')];
    return color ? ponerEstilo(tag, 'color', color) : null;
  });

  // Enlaces (url o botón oculto).
  out = reescribirEtiquetas(out, 'data-link-id', (tag) => {
    const cfg = links[leerAttr(tag, 'data-link-id')];
    if (!cfg) return null;
    let t = tag;
    if (cfg.url) t = ponerAttr(t, 'href', cfg.url);
    if (cfg.hidden) t = ponerEstilo(t, 'display', 'none');
    return t;
  });

  // Tipografía elegida para un bloque de texto.
  out = reescribirEtiquetas(out, 'data-edit', (tag) => {
    const font = textFonts[leerAttr(tag, 'data-edit')];
    return font ? ponerEstilo(tag, 'font-family', font) : null;
  });

  return out;
}

module.exports = { aplicarContenido };
