// node --test lib/baja.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('crypto');
const { urlBaja, ponerEnlaceBaja, BAJA_MAILTO } = require('./baja');

test('firma igual que generarTokenBaja de bendito-os', () => {
  const esperado = createHmac('sha256', 'clave').update('ana@x.es').digest('hex').slice(0, 32);
  assert.equal(
    urlBaja(' Ana@X.es ', 'clave'),
    'https://portal.benditolab.com/newsletter-baja?e=ana%40x.es&t=' + esperado
  );
});

test('sin clave o sin email, mailto para pedir la baja', () => {
  assert.equal(urlBaja('ana@x.es', ''), BAJA_MAILTO);
  assert.equal(urlBaja('', 'clave'), BAJA_MAILTO);
});

test('arregla el «Darse de baja» con href="#" y escapa la URL', () => {
  const html = '<p>x <a href="#" style="color:#5A6470">Darse de baja</a></p><a href="#">Otro</a>';
  const out = ponerEnlaceBaja(html, 'https://p/baja?e=a&t=b');
  assert.equal(out, '<p>x <a href="https://p/baja?e=a&amp;t=b" style="color:#5A6470">Darse de baja</a></p><a href="#">Otro</a>');
});

test('las newsletters con «Darse de baja» quedan enlazadas', () => {
  const fs = require('fs');
  const path = require('path');
  for (const f of ['club', 'colaboradores', 'empresas', 'eventos']) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'newsletter-' + f + '.html'), 'utf8');
    const out = ponerEnlaceBaja(html, 'https://p/baja');
    assert.ok(out.includes('href="https://p/baja"'), f);
  }
});
