import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatService } from '../src/services/chat.service.js';
import { ApiError } from '../src/services/api.client.js';
import { authMock } from '../src/services/auth.mock.js';

const organizer = () => ({ ...authMock.getSession('organizador-1'), roles: ['ORGANIZADOR'] });
const context = { role: 'organizador', eventId: 'evento-1' };
const purchase = () => ({ id: 'compra-1', compradorId: 'comprador-1', eventoId: 'evento-1', tipoEntradaId: 'tipo-1', tipoEntradaNombre: 'General',
  precioUnitario: 10, cantidad: 1, total: 10, estado: 'PENDIENTE', diasRestantes: null, puedeCancelar: false, reembolso: null, puedeReseniar: false,
  evento: { id: 'evento-1', nombre: 'Chat C6', fecha: '2026-12-01T20:00:00Z', organizadorId: 'organizador-1' } });
const message = (changes = {}) => ({ id: 'mensaje-1', compraId: 'compra-1', usuarioId: 'comprador-1', mensaje: 'Consulta', enviado: '2026-11-01T12:00:00Z', ...changes });

test('C6: organizador sin rol comprador consulta detalle y mensajes con identidad y cancelación', async () => {
  const calls = [];
  const controller = new AbortController();
  const messages = [message(), message({ id: 'respuesta-1', usuarioId: 'organizador-1', mensaje: 'Respuesta' })];
  const service = createChatService({ get: async (path, options) => {
    calls.push({ path, options }); return path.endsWith('/mensajes') ? messages : purchase();
  } });
  const conversation = await service.getConversation('compra-1', organizer(), { ...context, signal: controller.signal });
  assert.deepEqual(conversation.messages, messages);
  assert.deepEqual(calls.map((call) => call.path), ['/compras/compra-1', '/compras/compra-1/mensajes']);
  assert.ok(calls.every((call) => call.options.usuarioId === 'organizador-1' && call.options.signal === controller.signal));
});

test('C6: perspectiva, evento y propietario deben coincidir antes de consultar mensajes o responder', async () => {
  const calls = [];
  let data = purchase();
  const service = createChatService({ get: async (path) => { calls.push(path); return data; }, post: async () => assert.fail('No debe enviar') });
  await assert.rejects(service.getConversation('compra-1', authMock.getSession('comprador-1'), context), { status: 403 });
  await assert.rejects(service.getConversation('compra-1', organizer(), { role: 'inexistente' }), { status: 400 });
  await assert.rejects(service.getConversation('compra-1', organizer(), { role: 'organizador' }), { status: 400 });
  assert.equal(calls.length, 0);
  await assert.rejects(service.getConversation('compra-1', organizer(), { ...context, eventId: 'otro-evento' }), { status: 403 });
  await assert.rejects(service.send('compra-1', 'Respuesta', organizer(), { ...context, eventId: 'otro-evento' }), { status: 403 });
  data = { ...purchase(), evento: { ...purchase().evento, organizadorId: 'otro-organizador' } };
  await assert.rejects(service.getConversation('compra-1', organizer(), context), { status: 403 });
  await assert.rejects(service.send('compra-1', 'Respuesta', organizer(), context), { status: 403 });
  assert.ok(calls.every((path) => path === '/compras/compra-1'));
});

test('C6: respuesta incierta conserva clave/autor por compra y perfil para recuperarla sin duplicar', async () => {
  const calls = [];
  const service = createChatService({ get: async () => purchase(), post: async (path, body, options) => {
    calls.push({ path, body, options });
    if (calls.length === 1) throw new ApiError('Tiempo agotado', { code: 'TIMEOUT' });
    return message({ usuarioId: 'organizador-1', mensaje: body.mensaje });
  } });
  await assert.rejects(service.send('compra-1', ' Respuesta ', organizer(), context), { code: 'TIMEOUT' });
  assert.equal(service.getPending(organizer(), 'compra-1', context), 'Respuesta');
  assert.equal(service.getPending(authMock.getSession('comprador-1'), 'compra-1'), null);
  assert.equal(service.getPending(organizer(), 'otra-compra', context), null);
  await assert.rejects(service.send('compra-1', 'Otra respuesta', organizer(), context), { code: 'PENDING_MESSAGE' });
  const sent = await service.send('compra-1', 'Respuesta', organizer(), context);
  assert.equal(sent.usuarioId, 'organizador-1');
  assert.deepEqual(calls[1].body, { mensaje: 'Respuesta' });
  assert.equal(calls[0].options.idempotencyKey, calls[1].options.idempotencyKey);
  assert.equal(service.getPending(organizer(), 'compra-1', context), null);
});

test('C6: no muestra mensajes de terceros ni acepta respuestas atribuidas a otro autor', async () => {
  const service = createChatService({ get: async (path) => path.endsWith('/mensajes') ? [message({ usuarioId: 'tercero' })] : purchase(),
    post: async () => message({ mensaje: 'Respuesta' }) });
  await assert.rejects(service.getConversation('compra-1', organizer(), context), { code: 'INVALID_RESPONSE' });
  await assert.rejects(service.send('compra-1', 'Respuesta', organizer(), context), { code: 'INVALID_RESPONSE' });
  assert.equal(service.getPending(organizer(), 'compra-1', context), 'Respuesta');
});
