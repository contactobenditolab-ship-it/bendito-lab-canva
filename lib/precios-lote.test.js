// node --test lib/precios-lote.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularPreciosDesdeAPIBatch } = require('../api/catalogo');

// Responde como /api/catalog/pricing/calculate-batch de bendito-os
function simularBendito() {
  const llamadas = [];
  global.fetch = async (url, opt) => {
    const body = JSON.parse(opt.body);
    llamadas.push(body);
    if (!Array.isArray(body.articulos) || !body.articulos.length || body.articulos.length > 100) {
      return new Response(JSON.stringify({ success: false, error: 'articulos array requerido' }), { status: 400 });
    }
    const resultados = body.articulos.map((a) =>
      a.articulo_id === 'sin-precio'
        ? { articulo_id: a.articulo_id, error: 'Sin precio calculable' }
        : { articulo_id: a.articulo_id, cantidad: a.cantidad, precioUnitario: 4.95, precioTotal: 4.95 * a.cantidad }
    );
    return new Response(JSON.stringify({ success: true, data: { resultados } }), { status: 200 });
  };
  return llamadas;
}

test('manda el formato que espera bendito-os y lee sus resultados', async () => {
  const llamadas = simularBendito();
  const precios = await calcularPreciosDesdeAPIBatch([
    { articulo_id: 'a', cantidad: 5, canal: 'b2c' },
    { articulo_id: 'sin-precio', cantidad: 5, canal: 'b2c' },
  ]);
  assert.deepEqual(llamadas[0], { articulos: [{ articulo_id: 'a', cantidad: 5 }, { articulo_id: 'sin-precio', cantidad: 5 }], canal: 'b2c' });
  assert.equal(precios.get('a'), 4.95);
  assert.equal(precios.get('sin-precio'), null);
});

test('parte en lotes de 100', async () => {
  const llamadas = simularBendito();
  const items = Array.from({ length: 230 }, (_, i) => ({ articulo_id: 'a' + i, cantidad: 5, canal: 'b2c' }));
  const precios = await calcularPreciosDesdeAPIBatch(items);
  assert.deepEqual(llamadas.map((l) => l.articulos.length), [100, 100, 30]);
  assert.equal(precios.size, 230);
});
