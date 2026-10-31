import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatService, messageFromDto, prepareMessage } from '../src/services/chat.service.js';
import { ApiError } from '../src/services/api.client.js';
import { authMock } from '../src/services/auth.mock.js';

const buyer = () => authMock.getSession('comprador-1');
const purchase = (id = 'compra-1') => ({ id, compradorId: 'comprador-1', eventoId: 'evento-1', tipoEntradaId: 'tipo-1', tipoEntradaNombre: 'General',
  precioUnitario: 10, cantidad: 1, total: 10, estado: 'PENDIENTE', diasRestantes: null,
  evento: { id: 'evento-1', nombre: 'Chat C5', fecha: '2026-12-01T20:00:00Z', organizadorId: 'organizador-1' } });
const message = (changes = {}) => ({ id: 'mensaje-1', compraId: 'compra-1', usuarioId: 'comprador-1', mensaje: 'Hola', enviado: '2026-11-01T12:00:00Z', ...changes });

test('C5: contenido válido conserva saltos y caracteres, excluye vacío y supera como máximo 2000 caracteres', () => {
  assert.equal(prepareMessage('  Hola\n¿A qué hora? 🎟️  '), 'Hola\n¿A qué hora? 🎟️');
  assert.equal(prepareMessage('a'.repeat(2000)).length, 2000);
  for (const value of ['', '  ', null, 1, 'a'.repeat(2001)]) assert.throws(() => prepareMessage(value), { status: 400 });
  for (const changes of [{ compraId: 'otra' }, { usuarioId: '' }, { mensaje: ' ' }, { enviado: 'inválida' }]) {
    assert.throws(() => messageFromDto(message(changes), 'compra-1'), { code: 'INVALID_RESPONSE' });
  }
});

test('C5: consulta propiedad primero y envía identidad/señal a la conversación, preservando orden e historial vacío', async () => {
  const calls = [];
  const controller = new AbortController();
  let messages = [];
  const service = createChatService({ get: async (path, options) => { calls.push({ path, options }); return path.endsWith('/mensajes') ? messages : purchase('id/con espacio'); } });
  assert.deepEqual((await service.getConversation('id/con espacio', buyer(), { signal: controller.signal })).messages, []);
  assert.deepEqual(calls.map((call) => call.path), ['/compras/id%2Fcon%20espacio', '/compras/id%2Fcon%20espacio/mensajes']);
  assert.ok(calls.every((call) => call.options.usuarioId === 'comprador-1' && call.options.signal === controller.signal));
  messages = [message({ compraId: 'id/con espacio' }), message({ id: 'mensaje-2', compraId: 'id/con espacio', usuarioId: 'organizador-1', mensaje: 'Respuesta' })];
  assert.deepEqual((await service.getConversation('id/con espacio', buyer())).messages, messages);
  messages.push(messages[0]);
  await assert.rejects(service.getConversation('id/con espacio', buyer()), { code: 'INVALID_RESPONSE' });
});

test('C5: doble pulsación comparte un único POST sin autor ni fecha controlados por cliente', async () => {
  let finish;
  let entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const calls = [];
  const service = createChatService({ get: async () => purchase(), post: (path, data, options) => {
    calls.push({ path, data, options }); entered();
    return new Promise((resolve) => { finish = resolve; });
  } });
  const first = service.send('compra-1', ' Hola ', buyer());
  const second = service.send('compra-1', 'Hola', buyer());
  await started;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/compras/compra-1/mensajes');
  assert.deepEqual(calls[0].data, { mensaje: 'Hola' });
  assert.equal(calls[0].options.usuarioId, 'comprador-1');
  assert.match(calls[0].options.idempotencyKey, /^[a-zA-Z0-9-]{1,100}$/);
  finish(message());
  assert.deepEqual(await first, await second);
  assert.equal(service.getPending(buyer(), 'compra-1'), null);
});

test('C5: respuesta perdida conserva mensaje/clave por perfil y compra, y admite repetir texto tras un éxito', async () => {
  const keys = [];
  const service = createChatService({ get: async () => purchase(), post: async (_path, _body, options) => {
    keys.push(options.idempotencyKey);
    if (keys.length === 1) throw new ApiError('Red interrumpida', { code: 'NETWORK' });
    return message();
  } });
  await assert.rejects(service.send('compra-1', 'Hola', buyer()), { code: 'NETWORK' });
  assert.equal(service.getPending(buyer(), 'compra-1'), 'Hola');
  assert.equal(service.getPending(buyer(), 'otra-compra'), null);
  assert.equal(service.getPending(authMock.getSession('organizador-1'), 'compra-1'), null);
  await assert.rejects(service.send('compra-1', 'Otro texto', buyer()), { code: 'PENDING_MESSAGE' });
  await service.send('compra-1', service.getPending(buyer(), 'compra-1'), buyer());
  assert.equal(keys[0], keys[1]);
  await service.send('compra-1', 'Hola', buyer());
  assert.notEqual(keys[1], keys[2]);
});

test('C5: error definitivo permite corregir; respuesta inválida mantiene el intento pendiente', async () => {
  let response = 'bad-request';
  const service = createChatService({ get: async () => purchase(), post: async () => {
    if (response === 'bad-request') throw new ApiError('Mensaje inválido', { status: 400 });
    return message({ usuarioId: response === 'wrong-author' ? 'otra-persona' : 'comprador-1' });
  } });
  await assert.rejects(service.send('compra-1', 'Hola', buyer()), { status: 400 });
  assert.equal(service.getPending(buyer(), 'compra-1'), null);
  response = 'wrong-author';
  await assert.rejects(service.send('compra-1', 'Hola', buyer()), { code: 'INVALID_RESPONSE' });
  assert.equal(service.getPending(buyer(), 'compra-1'), 'Hola');
  response = 'ok';
  await service.send('compra-1', 'Hola', buyer());
  assert.equal(service.getPending(buyer(), 'compra-1'), null);
});

test('C5: un perfil sin capacidad de comprador o una compra ajena no habilitan mensajes ni envíos', async () => {
  const calls = [];
  const service = createChatService({ get: async (path) => { calls.push(path); return { ...purchase(), compradorId: 'otro' }; }, post: async () => assert.fail('No debe enviar') });
  await assert.rejects(service.getConversation('compra-1', { ...buyer(), roles: ['ORGANIZADOR'] }), { status: 403 });
  assert.equal(calls.length, 0);
  await assert.rejects(service.getConversation('compra-1', buyer()), { status: 403 });
  await assert.rejects(service.send('compra-1', 'Hola', buyer()), { status: 403 });
  assert.ok(calls.every((path) => path === '/compras/compra-1'));
});
