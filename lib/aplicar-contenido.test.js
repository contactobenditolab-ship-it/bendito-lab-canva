// node --test lib/aplicar-contenido.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { aplicarContenido } = require('./aplicar-contenido');

test('cambia la foto de un data-slot', () => {
  const html = '<td><img src="images/bl-foto-1.webp" data-slot="newsletter-empresas/card1" alt="x"></td>';
  const out = aplicarContenido(html, { images: { 'newsletter-empresas/card1': 'https://cdn/x.jpg' } });
  assert.match(out, /src="https:\/\/cdn\/x\.jpg"/);
  assert.doesNotMatch(out, /bl-foto-1/);
});

test('sin data-slot usa el src normalizado como clave', () => {
  const out = aplicarContenido('<img src="./images/a.png?v=2">', { images: { 'images/a.png': 'https://cdn/a.png' } });
  assert.match(out, /src="https:\/\/cdn\/a\.png"/);
});

test('sustituye el texto de un data-edit y deja lo demás', () => {
  const html = '<h1 style="color:#17233F" data-edit="nl.h1">Hola</h1><p data-edit="nl.p">Sin tocar</p>';
  const out = aplicarContenido(html, { texts: { 'nl.h1': '¡Hola <b>equipo</b>!' } });
  assert.equal(out, '<h1 style="color:#17233F" data-edit="nl.h1">¡Hola <b>equipo</b>!</h1><p data-edit="nl.p">Sin tocar</p>');
});

test('respeta el anidamiento del mismo tag', () => {
  const html = '<p data-edit="a">x <p>dentro</p> y</p><p>fuera</p>';
  assert.equal(aplicarContenido(html, { texts: { a: 'nuevo' } }), '<p data-edit="a">nuevo</p><p>fuera</p>');
});

test('limpia controles del editor colados en un texto', () => {
  const out = aplicarContenido('<p data-edit="a">x</p>', {
    texts: { a: 'Hola<input type="color"><span class="bl-color-btn">●</span>' },
  });
  assert.equal(out, '<p data-edit="a">Hola</p>');
});

test('aplica colores de fondo (también bgcolor) y de texto', () => {
  const html = '<td style="padding:4px;background-color:#E2704A;" bgcolor="#E2704A" data-color-bg="h.bg"><p style="color:#111" data-color-text="t">x</p></td>';
  const out = aplicarContenido(html, { colors: { 'h.bg': '#000000', t: '#FFFFFF' } });
  assert.match(out, /bgcolor="#000000"/);
  assert.match(out, /style="padding:4px;background-color:#000000"/);
  assert.match(out, /style="color:#FFFFFF"/);
});

test('cambia la url de un enlace y oculta otro', () => {
  const html = '<a href="/a" data-link-id="l1">A</a><a href="/b" data-link-id="l2">B</a>';
  const out = aplicarContenido(html, { links: { l1: { url: 'https://x.com' }, l2: { hidden: true } } });
  assert.match(out, /href="https:\/\/x\.com"/);
  assert.match(out, /data-link-id="l2" style="display:none"/);
});

test('quita las secciones ocultas', () => {
  const html = '<table><tr data-section="s1"><td>fuera</td></tr><tr><td>queda</td></tr></table>';
  assert.equal(aplicarContenido(html, { links: { 'seccion:s1': { hidden: true } } }), '<table><tr><td>queda</td></tr></table>');
});

test('sin contenido devuelve el HTML igual', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'newsletter-empresas.html'), 'utf8');
  assert.equal(aplicarContenido(html, {}), html);
});

test('newsletter-empresas real: cambia las 5 fotos de las tarjetas', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'newsletter-empresas.html'), 'utf8');
  const images = {};
  for (let i = 1; i <= 5; i++) images['newsletter-empresas/card' + i] = 'https://cdn/card' + i + '.jpg';
  const out = aplicarContenido(html, { images });
  for (let i = 1; i <= 5; i++) assert.ok(out.includes('src="https://cdn/card' + i + '.jpg"'), 'card' + i);
  assert.equal(out.length > html.length - 200, true);
});
