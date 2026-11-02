import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../src/services/api.client.js';
import { createPurchasesService, purchaseFromDto } from '../src/services/purchases.service.js';
import { preparePurchaseIntent, purchaseTotal } from '../src/utils/purchaseIntent.js';
import { authMock } from '../src/services/auth.mock.js';

const session = () => authMock.getSession('comprador-1');
const event = () => ({ id: 'event', tiposEntrada: [{ id: 'general', nombre: 'General', precio: 0.1, cupo: 5 }] });
const intent = () => preparePurchaseIntent(event(), 'general', 3);
const dto = (data = intent(), buyer = 'comprador-1') => ({ id: 'purchase', compradorId: buyer, eventoId: data.eventoId,
  tipoEntradaId: data.tipoEntradaId, tipoEntradaNombre: 'General', cantidad: data.cantidad,
  precioUnitario: data.precioUnitarioEsperado, total: purchaseTotal(data.precioUnitarioEsperado, data.cantidad), estado: 'PENDIENTE', diasRestantes: null, puedeCancelar: false, reembolso: null, puedeReseniar: false,
  evento: { id: data.eventoId, nombre: 'Evento de prueba', fecha: '2026-12-01T20:00:00Z', organizadorId: 'organizador-1' } });

test('C12: selección válida envía IDs, cantidad y precio esperado, sin total ni comprador controlados por el cliente', () => {
  assert.deepEqual(intent(), { eventoId: 'event', tipoEntradaId: 'general', cantidad: 3, precioUnitarioEsperado: 0.1 });
  assert.equal(purchaseTotal(0.1, 3), 0.3);
  for (const quantity of [0, -1, 1.5, '3', 6]) assert.throws(() => preparePurchaseIntent(event(), 'general', quantity));
  assert.throws(() => preparePurchaseIntent(event(), 'ajeno', 1));
  assert.equal(event().tiposEntrada[0].cupo, 5);
});

test('C12: comprueba consistencia del comprobante y distingue una compra gratuita de datos inválidos', () => {
  assert.equal(purchaseFromDto(dto()).total, 0.3);
  assert.equal(purchaseFromDto({ ...dto(), precioUnitario: 0, total: 0 }).total, 0);
  for (const changes of [{ cantidad: 0 }, { total: 0.1 }, { precioUnitario: -1 }, { estado: 'PAGADA' }, { tipoEntradaNombre: '' }]) {
    assert.throws(() => purchaseFromDto({ ...dto(), ...changes }), { code: 'INVALID_RESPONSE' });
  }
});

test('C12: dos pulsaciones comparten una solicitud y el intento expuesto no modifica los datos internos', async () => {
  let finish;
  const calls = [];
  const service = createPurchasesService({ post: (path, data, options) => {
    calls.push({ path, data, options });
    return new Promise((resolve) => { finish = resolve; });
  } });
  const first = service.create(intent(), session());
  const second = service.create(intent(), session());
  await Promise.resolve();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.usuarioId, 'comprador-1');
  assert.match(calls[0].options.idempotencyKey, /^[a-zA-Z0-9-]{1,100}$/);
  service.getPending(session(), 'event').cantidad = 999;
  assert.equal(service.getPending(session(), 'event').cantidad, 3);
  finish(dto());
  assert.deepEqual(await first, await second);
  assert.equal(service.getPending(session(), 'event'), null);
});

test('C12: una respuesta incierta conserva la clave al volver al evento y bloquea cambiar esa compra', async () => {
  const calls = [];
  const service = createPurchasesService({ post: async (_path, data, options) => {
    calls.push(options);
    if (calls.length === 1) throw new ApiError('Red interrumpida', { code: 'NETWORK' });
    return dto(data, options.usuarioId);
  } });
  await assert.rejects(service.create(intent(), session()), { code: 'NETWORK' });
  const recovered = service.getPending(session(), 'event');
  assert.deepEqual(recovered, intent());
  await assert.rejects(service.create({ ...intent(), cantidad: 1 }, session()), { code: 'PENDING_PURCHASE' });
  await service.create(recovered, session());
  assert.equal(calls[0].idempotencyKey, calls[1].idempotencyKey);
  await service.create(intent(), session());
  assert.notEqual(calls[1].idempotencyKey, calls[2].idempotencyKey);
});

test('C12: errores definitivos liberan el intento para corregir cantidades y los perfiles no comparten pendientes', async () => {
  let fail = true;
  const service = createPurchasesService({ post: async (_path, data, options) => {
    if (fail) throw new ApiError('No hay cupo', { status: 409 });
    return dto(data, options.usuarioId);
  } });
  await assert.rejects(service.create(intent(), session()), { status: 409 });
  assert.equal(service.getPending(session(), 'event'), null);
  fail = false;
  await service.create({ ...intent(), cantidad: 1 }, session());
  const unknown = createPurchasesService({ post: async () => { throw new ApiError('Tiempo agotado', { code: 'TIMEOUT' }); } });
  await assert.rejects(unknown.create(intent(), session()), { code: 'TIMEOUT' });
  assert.equal(unknown.getPending(authMock.getSession('organizador-1'), 'event'), null);
  assert.deepEqual(unknown.getPending(session(), 'event'), intent());
});

test('C12: una respuesta inválida mantiene el intento y no permite mostrar un comprobante de otra persona', async () => {
  let corrupt = true;
  const service = createPurchasesService({ post: async () => corrupt ? { ...dto(), compradorId: 'otro' } : dto(),
    get: async () => ({ ...dto(), compradorId: 'otro' }) });
  await assert.rejects(service.create(intent(), session()), { code: 'INVALID_RESPONSE' });
  assert.deepEqual(service.getPending(session(), 'event'), intent());
  corrupt = false;
  assert.equal((await service.create(intent(), session())).compradorId, 'comprador-1');
  await assert.rejects(service.get('purchase', session()), { status: 403 });
});

test('C12: consulta privada lleva identidad y un perfil sin capacidad de comprar no puede iniciar la operación', async () => {
  const calls = [];
  const service = createPurchasesService({ get: async (path, options) => { calls.push({ path, options }); return dto(); } });
  await service.get('id/con espacio', session());
  assert.equal(calls[0].path, '/compras/id%2Fcon%20espacio');
  assert.equal(calls[0].options.usuarioId, session().usuario.id);
  const organizerOnly = { ...session(), roles: ['ORGANIZADOR'] };
  assert.throws(() => service.create(intent(), organizerOnly), { status: 403 });
});
