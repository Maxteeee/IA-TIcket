import test from 'node:test';
import assert from 'node:assert/strict';
import { createPurchasesService, purchaseFromDto } from '../src/services/purchases.service.js';
import { authMock } from '../src/services/auth.mock.js';
import { remainingDaysLabel } from '../src/utils/purchasePresentation.js';

const session = () => authMock.getSession('comprador-1');
const dto = (changes = {}) => ({ id: 'compra-1', compradorId: 'comprador-1', eventoId: 'evento-1', tipoEntradaId: 'tipo-1',
  tipoEntradaNombre: 'General', cantidad: 2, precioUnitario: 10.25, total: 20.5, estado: 'CONFIRMADA', diasRestantes: 2,
  evento: { id: 'evento-1', nombre: 'Concierto', fecha: '2026-12-01T21:00:00Z', organizadorId: 'organizador-1' }, ...changes });

test('C1: lista propia envía identidad y cancelación, sin filtros de ventas ni consultas al catálogo', async () => {
  const controller = new AbortController();
  const calls = [];
  const original = dto();
  const service = createPurchasesService({ get: async (path, options) => { calls.push({ path, options }); return [original]; } });
  const result = await service.listOwn(session(), { signal: controller.signal });
  assert.deepEqual(calls, [{ path: '/compras', options: { usuarioId: 'comprador-1', signal: controller.signal } }]);
  assert.deepEqual(result, [original]);
  result[0].evento.nombre = 'Modificación local';
  assert.equal(original.evento.nombre, 'Concierto');
});

test('C1: respuesta vacía permanece vacía y datos ajenos, duplicados o incompletos no se muestran como propios', async () => {
  let response = [];
  const service = createPurchasesService({ get: async () => response });
  assert.deepEqual(await service.listOwn(session()), []);
  for (const invalid of [{ compras: [] }, [dto(), dto()], [dto({ compradorId: 'otro' })], [dto({ evento: undefined })], [null]]) {
    response = invalid;
    await assert.rejects(service.listOwn(session()), { code: 'INVALID_RESPONSE' });
  }
  await assert.rejects(service.listOwn({ ...session(), roles: ['ORGANIZADOR'] }), { status: 403 });
});

test('C1: días son un entero del servidor solo para confirmadas, incluido cero; no se calculan con el reloj del teléfono', () => {
  for (const [days, label] of [[0, '0 días restantes'], [1, '1 día restante'], [2, '2 días restantes']]) {
    const purchase = purchaseFromDto(dto({ diasRestantes: days }));
    assert.equal(remainingDaysLabel(purchase), label);
  }
  for (const estado of ['PENDIENTE', 'UTILIZADA', 'CANCELADA', 'REEMBOLSADA']) {
    assert.equal(remainingDaysLabel(purchaseFromDto(dto({ estado, diasRestantes: null }))), null);
    assert.throws(() => purchaseFromDto(dto({ estado })), { code: 'INVALID_RESPONSE' });
  }
  for (const diasRestantes of [null, undefined, -1, 1.5, '2', NaN]) {
    assert.throws(() => purchaseFromDto(dto({ diasRestantes })), { code: 'INVALID_RESPONSE' });
  }
});

test('C1: el resumen debe corresponder al evento de la compra y tener una fecha válida', () => {
  for (const evento of [{ id: 'otro', nombre: 'Otro', fecha: '2026-12-01T00:00:00Z' },
    { id: 'evento-1', nombre: '', fecha: '2026-12-01T00:00:00Z' },
    { id: 'evento-1', nombre: 'Evento', fecha: 'fecha inválida' }]) {
    assert.throws(() => purchaseFromDto(dto({ evento })), { code: 'INVALID_RESPONSE' });
  }
});
