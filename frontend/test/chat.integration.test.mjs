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
import { createChatService } from '../src/services/chat.service.js';
import { authMock } from '../src/services/auth.mock.js';
import { preparePurchaseIntent } from '../src/utils/purchaseIntent.js';

async function setup(t) {
  let now = new Date('2026-11-01T12:00:00Z');
  const repositories = seedReferenceData(createRepositories());
  repositories.usuarios.save(new Usuario({ id: 'comprador-2', nombre: 'Otra', apellido: 'Persona' }));
  const server = createApp({ repositories, now: () => new Date(now) }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const client = createApiClient({ baseUrl });
  const buyer = authMock.getSession('comprador-1');
  const organizer = authMock.getSession('organizador-1');
  const otherBuyer = { usuario: { id: 'comprador-2' }, roles: ['COMPRADOR'] };
  const event = await createEventsService(client).create({ nombre: 'Chat C5', descripcion: 'Consultas sobre la compra',
    categoriaId: 'demo-categoria-1', fecha: '2026-12-01T20:00:00Z', fechaFin: '2026-12-01T22:00:00Z',
    tiposEntrada: [{ nombre: 'General', precio: 10.25, cupo: 10 }] }, organizer);
  const purchases = createPurchasesService(client);
  const buy = (session = buyer) => purchases.create(preparePurchaseIntent(event, event.tiposEntrada[0].id, 1), session);
  const purchase = await buy();
  return { repositories, baseUrl, client, buyer, organizer, otherBuyer, event, purchase, buy, purchases,
    chat: createChatService(client), advance: (value) => { now = new Date(value); } };
}

test('C5 punta a punta: compra real, mensajes con autor/fecha del servidor e historial al recargar sin mezclar compras', async (t) => {
  const s = await setup(t);
  const original = s.repositories.compras.findById(s.purchase.id);
  const cupo = original.tipoEntrada.cupo;
  const historyLength = original.historial.length;
  const initial = await s.chat.getConversation(s.purchase.id, s.buyer);
  assert.equal(initial.purchase.id, s.purchase.id);
  assert.deepEqual(initial.messages, []);
  const sent = await s.chat.send(s.purchase.id, '  Hola\n¿Dónde retiro mis entradas? 🎟️  ', s.buyer);
  assert.equal(sent.compraId, s.purchase.id);
  assert.equal(sent.usuarioId, 'comprador-1');
  assert.equal(sent.mensaje, 'Hola\n¿Dónde retiro mis entradas? 🎟️');
  assert.equal(sent.enviado, '2026-11-01T12:00:00.000Z');
  // El backend ya permitía respuestas; C5 conserva esa compatibilidad sin conectar la UI de C6.
  await s.client.post(`/compras/${s.purchase.id}/mensajes`, { mensaje: 'Te esperamos en el acceso.' }, { usuarioId: 'organizador-1' });
  const reloaded = await createChatService(s.client).getConversation(s.purchase.id, s.buyer);
  assert.deepEqual(reloaded.messages.map((message) => message.mensaje), [sent.mensaje, 'Te esperamos en el acceso.']);
  assert.deepEqual(reloaded.messages.map((message) => message.usuarioId), ['comprador-1', 'organizador-1']);
  const anotherPurchase = await s.buy();
  assert.deepEqual((await s.chat.getConversation(anotherPurchase.id, s.buyer)).messages, []);
  assert.equal(original.tipoEntrada.cupo, cupo - 1); // Solo la segunda compra descuenta, no el chat.
  assert.equal(original.estado, 'PENDIENTE');
  assert.equal(original.historial.length, historyLength);
});

test('C5 punta a punta: comprador puede escribir en cualquier estado y después del evento finalizado', async (t) => {
  const s = await setup(t);
  await s.chat.send(s.purchase.id, 'Consulta antes del evento', s.buyer);
  s.advance('2026-12-02T12:00:00Z');
  const original = s.repositories.compras.findById(s.purchase.id);
  for (const estado of ['PENDIENTE', 'CONFIRMADA', 'UTILIZADA', 'CANCELADA', 'REEMBOLSADA']) {
    original.estado = estado; // Estados históricos aislados, sin implementar cancelación/reembolso.
    const message = await s.chat.send(s.purchase.id, `Consulta en ${estado}`, s.buyer);
    const conversation = await s.chat.getConversation(s.purchase.id, s.buyer);
    assert.equal(conversation.purchase.estado, estado);
    assert.equal(conversation.messages.at(-1).id, message.id);
    assert.equal(message.enviado, '2026-12-02T12:00:00.000Z');
  }
  assert.deepEqual(await s.client.get('/eventos'), []);
  assert.equal(original.mensajes.length, 6);
});

test('C5 punta a punta: compra ajena, autor inyectado y texto inválido no permiten leer ni persistir mensajes', async (t) => {
  const s = await setup(t);
  await s.buy(s.otherBuyer); // Comprar el mismo evento no da acceso a otra conversación.
  const path = `/compras/${s.purchase.id}/mensajes`;
  await assert.rejects(s.client.get(path), { status: 401 });
  await assert.rejects(s.client.post(path, { mensaje: 'Intruso' }, { usuarioId: 'comprador-2' }), { status: 403 });
  await assert.rejects(s.chat.getConversation(s.purchase.id, s.otherBuyer), { status: 403 });
  await assert.rejects(s.chat.send(s.purchase.id, 'Intruso', s.otherBuyer), { status: 403 });
  await assert.rejects(s.chat.getConversation(s.purchase.id, s.organizer), { status: 403 });
  await assert.rejects(s.chat.getConversation('inexistente', s.buyer), { status: 404 });
  for (const body of [{ mensaje: ' ' }, { mensaje: 'x'.repeat(2001) }, { mensaje: 'Hola', usuarioId: 'organizador-1' }, { mensaje: 'Hola', enviado: '2025-01-01T00:00:00Z' }]) {
    await assert.rejects(s.client.post(path, body, { usuarioId: 'comprador-1' }), { status: 400 });
  }
  assert.deepEqual((await s.chat.getConversation(s.purchase.id, s.buyer)).messages, []);
});

test('C5 punta a punta: respuesta perdida se recupera al volver a la compra sin duplicar el mensaje', async (t) => {
  const s = await setup(t);
  let loseResponse = true;
  const keys = [];
  const client = createApiClient({ baseUrl: s.baseUrl, fetchImpl: async (url, options) => {
    const response = await fetch(url, options);
    if (options.method === 'POST') {
      keys.push(options.headers['Idempotency-Key']);
      if (loseResponse) { loseResponse = false; await response.text(); throw new TypeError('Respuesta perdida después de guardar'); }
    }
    return response;
  } });
  const chat = createChatService(client);
  await assert.rejects(chat.send(s.purchase.id, '¿A qué hora abren?', s.buyer), { code: 'NETWORK' });
  assert.equal(chat.getPending(s.buyer, s.purchase.id), '¿A qué hora abren?');
  const [stored] = (await chat.getConversation(s.purchase.id, s.buyer)).messages;
  const recovered = await chat.send(s.purchase.id, chat.getPending(s.buyer, s.purchase.id), s.buyer);
  assert.equal(recovered.id, stored.id);
  assert.equal(keys[0], keys[1]);
  assert.equal(s.repositories.compras.findById(s.purchase.id).mensajes.length, 1);
  assert.equal(chat.getPending(s.buyer, s.purchase.id), null);
  const repeatedText = await chat.send(s.purchase.id, '¿A qué hora abren?', s.buyer);
  assert.notEqual(repeatedText.id, stored.id);
  assert.equal(s.repositories.compras.findById(s.purchase.id).mensajes.length, 2);
});

test('C5 punta a punta: POST concurrentes con la misma clave generan un mensaje y rechazan otro contenido', async (t) => {
  const s = await setup(t);
  const path = `/compras/${s.purchase.id}/mensajes`;
  const options = { usuarioId: 'comprador-1', idempotencyKey: 'envio-concurrente' };
  const [first, second] = await Promise.all([
    s.client.post(path, { mensaje: 'Consulta' }, options), s.client.post(path, { mensaje: 'Consulta' }, options),
  ]);
  assert.equal(first.id, second.id);
  assert.equal(s.repositories.compras.findById(s.purchase.id).mensajes.length, 1);
  await assert.rejects(s.client.post(path, { mensaje: 'Otra consulta' }, options), { status: 409 });
  assert.deepEqual((await s.chat.getConversation(s.purchase.id, s.buyer)).messages, [first]);
});
