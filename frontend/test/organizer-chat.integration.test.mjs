import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../../backend/src/app.js';
import { createRepositories } from '../../backend/src/repositories/index.js';
import { seedReferenceData } from '../../backend/src/data/reference.js';
import { Usuario } from '../../backend/src/domain/Usuario.js';
import { createApiClient } from '../src/services/api.client.js';
import { createEventsService } from '../src/services/events.service.js';
import { createPurchasesService } from '../src/services/purchases.service.js';
import { createSalesService } from '../src/services/sales.service.js';
import { createChatService } from '../src/services/chat.service.js';
import { authMock } from '../src/services/auth.mock.js';
import { preparePurchaseIntent } from '../src/utils/purchaseIntent.js';

async function setup(t, organizerOnly = false) {
  let now = new Date('2026-11-01T12:00:00Z');
  const repositories = seedReferenceData(createRepositories());
  repositories.usuarios.save(new Usuario({ id: 'comprador-2', nombre: 'Otra', apellido: 'Compradora' }));
  repositories.usuarios.save(new Usuario({ id: 'otro-organizador', nombre: 'Otro', apellido: 'Organizador', roles: ['ORGANIZADOR'] }));
  const organizer = authMock.getSession('organizador-1');
  if (organizerOnly) { organizer.roles = ['ORGANIZADOR']; repositories.usuarios.findById('organizador-1').roles = ['ORGANIZADOR']; }
  const server = createApp({ repositories, now: () => new Date(now) }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const client = createApiClient({ baseUrl });
  const buyer = authMock.getSession('comprador-1');
  const otherBuyer = { usuario: { id: 'comprador-2' }, roles: ['COMPRADOR'] };
  const otherOrganizer = { usuario: { id: 'otro-organizador' }, roles: ['ORGANIZADOR'] };
  const draft = { nombre: 'Chat C6', descripcion: 'Conversación compartida', categoriaId: 'demo-categoria-1',
    fecha: '2026-12-01T20:00:00Z', fechaFin: '2026-12-01T22:00:00Z', tiposEntrada: [{ nombre: 'General', precio: 10.25, cupo: 10 }] };
  const events = createEventsService(client);
  const event = await events.create(draft, organizer);
  const otherEvent = await events.create({ ...draft, nombre: 'Otro evento propio' }, organizer);
  const purchases = createPurchasesService(client);
  const buy = (session = buyer) => purchases.create(preparePurchaseIntent(event, event.tiposEntrada[0].id, 1), session);
  const purchase = await buy();
  return { repositories, client, baseUrl, event, otherEvent, purchase, buyer, otherBuyer, organizer, otherOrganizer, purchases, buy,
    context: { role: 'organizador', eventId: event.id }, chat: createChatService(client), sales: createSalesService(client),
    advance: (value) => { now = new Date(value); } };
}

test('C6 punta a punta: desde ventas responde al mensaje C5 y comprador recupera el mismo historial tras recarga', async (t) => {
  const s = await setup(t);
  const question = await s.chat.send(s.purchase.id, '¿A qué hora abren?', s.buyer);
  const sales = await s.sales.getEventSales(s.event.id, s.organizer);
  const id = sales.compras[0].id;
  const conversation = await s.chat.getConversation(id, s.organizer, s.context);
  assert.deepEqual(conversation.messages, [question]);
  const stored = s.repositories.compras.findById(id);
  const cupo = stored.tipoEntrada.cupo;
  const history = stored.historial.length;
  const reply = await s.chat.send(id, ' Abrimos a las 19:00. ', s.organizer, s.context);
  assert.equal(reply.usuarioId, 'organizador-1');
  assert.equal(reply.mensaje, 'Abrimos a las 19:00.');
  assert.equal(reply.enviado, '2026-11-01T12:00:00.000Z');
  const reloaded = createChatService(s.client);
  assert.deepEqual((await reloaded.getConversation(id, s.buyer)).messages, [question, reply]);
  assert.deepEqual((await reloaded.getConversation(id, s.organizer, s.context)).messages, [question, reply]);
  const another = await s.buy(s.otherBuyer);
  assert.deepEqual((await s.chat.getConversation(another.id, s.organizer, s.context)).messages, []);
  assert.equal(stored.tipoEntrada.cupo, cupo - 1); // Solo la segunda compra descuenta.
  assert.equal(stored.historial.length, history);
  assert.equal(stored.estado, 'PENDIENTE');
  assert.deepEqual(await s.purchases.listOwn(s.organizer), []);
});

test('C6 punta a punta: organizador sin rol comprador responde en todos los estados y tras finalizar el evento', async (t) => {
  const s = await setup(t, true);
  await s.chat.send(s.purchase.id, 'Consulta inicial', s.buyer);
  const stored = s.repositories.compras.findById(s.purchase.id);
  s.advance('2026-12-02T12:00:00Z');
  for (const estado of ['PENDIENTE', 'CONFIRMADA', 'UTILIZADA', 'CANCELADA', 'REEMBOLSADA']) {
    stored.estado = estado; // Históricos de prueba, sin agregar transiciones.
    const reply = await s.chat.send(s.purchase.id, `Respuesta en ${estado}`, s.organizer, s.context);
    assert.equal(reply.usuarioId, 'organizador-1');
    assert.equal(reply.enviado, '2026-12-02T12:00:00.000Z');
    assert.equal((await s.chat.getConversation(s.purchase.id, s.buyer)).messages.at(-1).id, reply.id);
    assert.equal((await s.chat.getConversation(s.purchase.id, s.organizer, s.context)).purchase.estado, estado);
  }
  assert.deepEqual(await s.client.get('/eventos'), []);
  assert.equal((await s.sales.getEventSales(s.event.id, s.organizer)).compras.length, 1);
  assert.equal(stored.mensajes.length, 6);
  assert.equal(stored.tipoEntrada.cupo, 9);
  assert.equal(stored.historial.length, 1);
});

test('C6 punta a punta: bloquea compradores, organizadores ajenos, otro evento y pérdida de rol almacenado', async (t) => {
  const s = await setup(t);
  const forged = { ...s.buyer, roles: ['ORGANIZADOR'] };
  await assert.rejects(s.chat.getConversation(s.purchase.id, forged, s.context), { status: 403 });
  await assert.rejects(s.chat.send(s.purchase.id, 'Intruso', forged, s.context), { status: 403 });
  await assert.rejects(s.chat.getConversation(s.purchase.id, s.otherOrganizer, s.context), { status: 403 });
  await assert.rejects(s.chat.send(s.purchase.id, 'Intruso', s.otherOrganizer, s.context), { status: 403 });
  await assert.rejects(s.chat.getConversation(s.purchase.id, s.organizer, { ...s.context, eventId: s.otherEvent.id }), { status: 403 });
  await assert.rejects(s.chat.send(s.purchase.id, 'Otro evento', s.organizer, { ...s.context, eventId: s.otherEvent.id }), { status: 403 });
  await assert.rejects(s.chat.getConversation('inexistente', s.organizer, s.context), { status: 404 });
  s.repositories.usuarios.findById('organizador-1').roles = ['COMPRADOR'];
  await assert.rejects(s.chat.getConversation(s.purchase.id, s.organizer, s.context), { status: 403 });
  await assert.rejects(s.chat.send(s.purchase.id, 'Sin rol', s.organizer, s.context), { status: 403 });
  assert.deepEqual((await s.chat.getConversation(s.purchase.id, s.buyer)).messages, []);
});

test('C6 punta a punta: respuesta perdida mantiene intento al volver y no duplica la respuesta que recibió el comprador', async (t) => {
  const s = await setup(t);
  let loseResponse = true;
  const client = createApiClient({ baseUrl: s.baseUrl, fetchImpl: async (url, options) => {
    const response = await fetch(url, options);
    if (options.method === 'POST' && loseResponse) { loseResponse = false; await response.text(); throw new TypeError('Respuesta perdida después de guardar'); }
    return response;
  } });
  const chat = createChatService(client);
  await assert.rejects(chat.send(s.purchase.id, 'Respuesta del organizador', s.organizer, s.context), { code: 'NETWORK' });
  const [received] = (await s.chat.getConversation(s.purchase.id, s.buyer)).messages;
  const refreshed = await chat.getConversation(s.purchase.id, s.organizer, s.context);
  assert.deepEqual(refreshed.messages, [received]);
  const pending = chat.getPending(s.organizer, s.purchase.id, s.context);
  assert.equal(pending, 'Respuesta del organizador');
  const recovered = await chat.send(s.purchase.id, pending, s.organizer, s.context);
  assert.equal(recovered.id, received.id);
  assert.equal(chat.getPending(s.organizer, s.purchase.id, s.context), null);
  assert.equal(s.repositories.compras.findById(s.purchase.id).mensajes.length, 1);
});

test('C6 punta a punta: clave compartida entre autores y compras no mezcla mensajes; doble POST de respuesta guarda una sola', async (t) => {
  const s = await setup(t);
  const path = `/compras/${s.purchase.id}/mensajes`;
  const key = 'misma-clave';
  const options = { usuarioId: 'organizador-1', idempotencyKey: key };
  const [question, first, repeated] = await Promise.all([
    s.client.post(path, { mensaje: 'Consulta' }, { usuarioId: 'comprador-1', idempotencyKey: key }),
    s.client.post(path, { mensaje: 'Respuesta' }, options), s.client.post(path, { mensaje: 'Respuesta' }, options),
  ]);
  assert.equal(first.id, repeated.id);
  assert.notEqual(first.id, question.id);
  const messages = (await s.chat.getConversation(s.purchase.id, s.buyer)).messages;
  assert.deepEqual(new Set(messages.map((message) => message.id)), new Set([question.id, first.id]));
  const another = await s.buy();
  const separate = await s.client.post(`/compras/${another.id}/mensajes`, { mensaje: 'Respuesta' }, options);
  assert.notEqual(separate.id, first.id);
  assert.deepEqual((await s.chat.getConversation(another.id, s.organizer, s.context)).messages, [separate]);
});
