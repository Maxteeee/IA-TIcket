import test from 'node:test';
import assert from 'node:assert/strict';
import { createSalesService } from '../src/services/sales.service.js';
import { createApiClient, ApiError } from '../src/services/api.client.js';
import { authMock } from '../src/services/auth.mock.js';

const organizer = () => authMock.getSession('organizador-1');
const dto = (estado = 'PENDIENTE', changes = {}) => ({
  id: 'compra/1', compradorId: 'comprador-1', eventoId: 'evento-1', tipoEntradaId: 'tipo-1', tipoEntradaNombre: 'General',
  precioUnitario: 10.25, cantidad: 2, total: 20.5, estado, diasRestantes: estado === 'CONFIRMADA' ? 2 : null,
  puedeCancelar: ['PENDIENTE', 'CONFIRMADA'].includes(estado), puedeReseniar: estado === 'UTILIZADA', reembolso: null,
  evento: { id: 'evento-1', nombre: 'Evento', fecha: '2026-12-01T20:00:00Z', organizadorId: 'organizador-1' }, ...changes,
});

test('pagos simulados: PATCH usa identidad, señal, estado e ID codificado sin campos arbitrarios', async () => {
  const calls = [];
  const controller = new AbortController();
  const service = createSalesService({
    get: async (path, options) => { calls.push({ method: 'GET', path, options }); return dto(); },
    patch: async (path, body, options) => { calls.push({ method: 'PATCH', path, body, options }); return dto('CONFIRMADA'); },
  });
  const result = await service.updatePurchaseState('evento-1', 'compra/1', 'CONFIRMADA', organizer(), { signal: controller.signal });
  assert.equal(result.estado, 'CONFIRMADA');
  const options = { usuarioId: 'organizador-1', signal: controller.signal };
  assert.deepEqual(calls, [
    { method: 'GET', path: '/compras/compra%2F1', options },
    { method: 'PATCH', path: '/compras/compra%2F1/estado', body: { estado: 'CONFIRMADA' }, options },
  ]);
});

test('pagos simulados: comprador, IDs y transiciones inválidas no envían solicitudes', async () => {
  let calls = 0;
  const service = createSalesService({ get: async () => { calls++; return dto(); } });
  await assert.rejects(async () => service.updatePurchaseState('evento-1', 'compra/1', 'CONFIRMADA', authMock.getSession('comprador-1')), { status: 403 });
  for (const state of ['PENDIENTE', 'CANCELADA', 'REEMBOLSADA', 'toString', null]) {
    await assert.rejects(async () => service.updatePurchaseState('evento-1', 'compra/1', state, organizer()), { status: 400 });
  }
  for (const [eventId, purchaseId] of [['', 'compra/1'], ['evento-1', ' '], [null, 'compra/1']]) {
    await assert.rejects(async () => service.updatePurchaseState(eventId, purchaseId, 'CONFIRMADA', organizer()), { status: 400 });
  }
  assert.equal(calls, 0);
});

test('pagos simulados: propiedad y estado actual se verifican antes del PATCH', async () => {
  for (const current of [dto('CANCELADA'), dto('REEMBOLSADA'), dto('UTILIZADA')]) {
    const service = createSalesService({ get: async () => current, patch: async () => assert.fail('No debe modificar una compra terminal') });
    await assert.rejects(service.updatePurchaseState('evento-1', 'compra/1', 'CONFIRMADA', organizer()), { status: 409 });
  }
  for (const current of [dto('PENDIENTE', { eventoId: 'otro', evento: { ...dto().evento, id: 'otro' } }),
    dto('PENDIENTE', { evento: { ...dto().evento, organizadorId: 'otro' } })]) {
    const service = createSalesService({ get: async () => current, patch: async () => assert.fail('No debe modificar una compra ajena') });
    await assert.rejects(service.updatePurchaseState('evento-1', 'compra/1', 'CONFIRMADA', organizer()), { status: 403 });
  }
});

test('pagos simulados: doble pulsación comparte operación y otra transición espera', async () => {
  let release;
  let writes = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const service = createSalesService({ get: async () => { await gate; return dto(); },
    patch: async () => { writes++; return dto('CONFIRMADA'); } });
  const first = service.updatePurchaseState('evento-1', 'compra/1', 'CONFIRMADA', organizer());
  const second = service.updatePurchaseState('evento-1', 'compra/1', 'CONFIRMADA', organizer());
  assert.equal(first, second);
  await assert.rejects(async () => service.updatePurchaseState('evento-1', 'compra/1', 'UTILIZADA', organizer()), { status: 409 });
  release();
  await Promise.all([first, second]);
  assert.equal(writes, 1);
});

test('pagos simulados: respuesta perdida se recupera por estado sin repetir PATCH ni avanzar a utilizada', async () => {
  let current = dto();
  let writes = 0;
  const service = createSalesService({ get: async () => current, patch: async () => {
    writes++; current = dto('CONFIRMADA'); throw new ApiError('Respuesta perdida', { code: 'NETWORK' });
  } });
  await assert.rejects(service.updatePurchaseState('evento-1', 'compra/1', 'CONFIRMADA', organizer()), { code: 'NETWORK' });
  assert.equal((await service.updatePurchaseState('evento-1', 'compra/1', 'CONFIRMADA', organizer())).estado, 'CONFIRMADA');
  assert.equal(writes, 1);
});

test('pagos simulados: respuestas de otra compra o con importes modificados no se presentan como éxito', async () => {
  for (const changed of [dto('CONFIRMADA', { id: 'otra-compra' }), dto('PENDIENTE'), dto('CONFIRMADA', { cantidad: 1, total: 10.25 })]) {
    const service = createSalesService({ get: async () => dto(), patch: async () => changed });
    await assert.rejects(service.updatePurchaseState('evento-1', 'compra/1', 'CONFIRMADA', organizer()), { code: 'INVALID_RESPONSE' });
  }
});

test('cliente HTTP: PATCH serializa JSON y propaga rechazos del servidor', async () => {
  const calls = [];
  const client = createApiClient({ baseUrl: 'http://api.local/api', fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ message: 'La compra fue cancelada' }), { status: 409 });
  } });
  await assert.rejects(client.patch('/compras/1/estado', { estado: 'UTILIZADA' }, { usuarioId: 'organizador-1' }), { status: 409, message: 'La compra fue cancelada' });
  assert.equal(calls[0].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0].options.body), { estado: 'UTILIZADA' });
  assert.equal(calls[0].options.headers['X-Usuario-Id'], 'organizador-1');
});
