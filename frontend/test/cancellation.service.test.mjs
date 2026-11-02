import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../src/services/api.client.js';
import { createPurchasesService, purchaseFromDto } from '../src/services/purchases.service.js';
import { authMock } from '../src/services/auth.mock.js';

const buyer = authMock.getSession('comprador-1');
const dto = (changes = {}) => ({ id: 'compra/con espacio', compradorId: 'comprador-1', eventoId: 'evento',
  tipoEntradaId: 'general', tipoEntradaNombre: 'General', cantidad: 2, precioUnitario: 10.25, total: 20.5,
  estado: 'CANCELADA', diasRestantes: null, puedeReseniar: false, puedeCancelar: false, reembolso: null,
  evento: { id: 'evento', nombre: 'Encuentro', fecha: '2026-12-01T20:00:00Z', organizadorId: 'organizador-1' }, ...changes });

test('C7: envía cancelación de una compra por identidad y señal sin estado, autor ni cupo elegidos por cliente', async () => {
  const calls = [];
  const controller = new AbortController();
  const service = createPurchasesService({ post: async (...args) => { calls.push(args); return dto(); } });
  assert.deepEqual(await service.cancel(dto().id, buyer, { signal: controller.signal }), dto());
  assert.deepEqual(calls, [['/compras/compra%2Fcon%20espacio/cancelacion', {}, { usuarioId: buyer.usuario.id, signal: controller.signal }]]);
  assert.throws(() => service.cancel(dto().id, { ...buyer, roles: ['ORGANIZADOR'] }), { status: 403 });
});

test('C7: doble pulsación comparte un POST y un error incierto permite reintentar la misma compra', async () => {
  let finish;
  let calls = 0;
  const service = createPurchasesService({ post: () => {
    calls++;
    return calls === 1 ? new Promise((resolve, reject) => { finish = reject; }) : Promise.resolve(dto());
  } });
  const first = service.cancel(dto().id, buyer);
  const second = service.cancel(dto().id, buyer);
  assert.equal(first, second);
  const rejected = assert.rejects(first, { code: 'NETWORK' });
  await Promise.resolve();
  finish(new ApiError('Sin respuesta', { code: 'NETWORK' }));
  await rejected;
  assert.equal(calls, 1);
  assert.equal((await service.cancel(dto().id, buyer)).estado, 'CANCELADA');
  assert.equal(calls, 2);
});

test('C7: no presenta cancelación exitosa con respuesta de otra compra, autor o estado', async () => {
  for (const changes of [{ id: 'otra' }, { compradorId: 'otro' }, { estado: 'PENDIENTE' }, { puedeCancelar: true }]) {
    const service = createPurchasesService({ post: async () => dto(changes) });
    await assert.rejects(service.cancel(dto().id, buyer), { code: 'INVALID_RESPONSE' });
  }
});

test('C7: elegibilidad exige booleano del servidor y un estado activo, sin inferirla con el reloj del teléfono', () => {
  for (const estado of ['PENDIENTE', 'CONFIRMADA']) {
    const input = dto({ estado, diasRestantes: estado === 'CONFIRMADA' ? 0 : null, puedeCancelar: true });
    assert.equal(purchaseFromDto(input).puedeCancelar, true);
    assert.equal(purchaseFromDto({ ...input, puedeCancelar: false }).puedeCancelar, false);
  }
  for (const puedeCancelar of [undefined, null, 0, 'true']) assert.throws(() => purchaseFromDto(dto({ puedeCancelar })), { code: 'INVALID_RESPONSE' });
  for (const estado of ['UTILIZADA', 'CANCELADA', 'REEMBOLSADA']) {
    assert.throws(() => purchaseFromDto(dto({ estado, puedeCancelar: true })), { code: 'INVALID_RESPONSE' });
  }
});

test('C7: valida importe original, fecha y simulación del reembolso, incluido cero, sin inventar devoluciones', async () => {
  const refund = (importe = 20.5) => ({ importe, fecha: '2026-11-02T12:00:00Z', simulado: true });
  const original = dto({ estado: 'REEMBOLSADA', reembolso: refund() });
  const service = createPurchasesService({ post: async () => original });
  const result = await service.cancel(original.id, buyer);
  assert.deepEqual(result.reembolso, refund());
  result.reembolso.importe = 0;
  assert.equal(original.reembolso.importe, 20.5);
  assert.equal(purchaseFromDto(dto({ estado: 'REEMBOLSADA', total: 0, precioUnitario: 0, reembolso: refund(0) })).reembolso.importe, 0);
  for (const reembolso of [undefined, {}, { ...refund(), simulado: false }, { ...refund(), importe: 1 },
    { ...refund(), importe: -1 }, { ...refund(), fecha: null }, { ...refund(), fecha: 'no-fecha' }]) {
    assert.throws(() => purchaseFromDto(dto({ estado: 'REEMBOLSADA', reembolso })), { code: 'INVALID_RESPONSE' });
  }
  assert.throws(() => purchaseFromDto(dto({ reembolso: refund() })), { code: 'INVALID_RESPONSE' });
  // Estados históricos sin registro de devolución no se convierten en un reembolso inventado.
  assert.equal(purchaseFromDto(dto({ estado: 'REEMBOLSADA' })).reembolso, null);
  await assert.rejects(createPurchasesService({ post: async () => dto({ estado: 'REEMBOLSADA' }) }).cancel(dto().id, buyer), { code: 'INVALID_RESPONSE' });
});

test('C7: cancelaciones en curso se separan por comprador y los rechazos definitivos permiten volver a consultar', async () => {
  let calls = 0;
  const other = authMock.getSession('organizador-1');
  const service = createPurchasesService({ post: async (_path, _body, { usuarioId }) => {
    calls++;
    if (usuarioId === buyer.usuario.id) throw new ApiError('El evento ya comenzó', { status: 409 });
    return dto({ compradorId: usuarioId });
  } });
  const results = await Promise.allSettled([service.cancel(dto().id, buyer), service.cancel(dto().id, other)]);
  assert.equal(calls, 2);
  assert.equal(results[0].reason.status, 409);
  assert.equal(results[1].value.compradorId, other.usuario.id);
  await assert.rejects(service.cancel(dto().id, buyer), { status: 409 });
  assert.equal(calls, 3);
});
