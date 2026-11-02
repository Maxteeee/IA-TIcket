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
import { createCatalogService } from '../src/services/catalog.service.js';
import { createSalesService } from '../src/services/sales.service.js';
import { createChatService } from '../src/services/chat.service.js';
import { authMock } from '../src/services/auth.mock.js';
import { preparePurchaseIntent } from '../src/utils/purchaseIntent.js';

async function setup(t) {
  let instant = new Date('2026-11-02T12:00:00Z');
  const repositories = seedReferenceData(createRepositories());
  repositories.usuarios.save(new Usuario({ id: 'comprador-2', nombre: 'Otra', apellido: 'Persona' }));
  const server = createApp({ repositories, now: () => new Date(instant) }).listen(0, '127.0.0.1');
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
  const event = await createEventsService(client).create({ nombre: 'Encuentro C7', descripcion: 'Simulación sin dinero real',
    categoriaId: 'demo-categoria-1', fecha: '2026-12-01T20:00:00Z', fechaFin: '2026-12-01T22:00:00Z',
    tiposEntrada: [{ nombre: 'General', precio: 10.25, cupo: 3 }, { nombre: 'VIP', precio: 20, cupo: 5 }] }, organizer);
  const purchases = createPurchasesService(client);
  const buy = (session = buyer, cantidad = 2) => purchases.create(preparePurchaseIntent(event, event.tiposEntrada[0].id, cantidad), session);
  const purchase = await buy();
  const patch = async (path, data) => {
    const response = await fetch(`${baseUrl}${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Usuario-Id': 'organizador-1' }, body: JSON.stringify(data) });
    assert.equal(response.status, 200);
    return response.json();
  };
  return { repositories, baseUrl, client, buyer, organizer, otherBuyer, event, purchase, purchases, buy, patch,
    catalog: createCatalogService(client), advance: (value) => { instant = new Date(value); } };
}

test('C7 punta a punta: cancelar pendiente actualiza comprobante, mis compras y ventas/cupo, sin inventar reembolso', async (t) => {
  const s = await setup(t);
  assert.equal(s.purchase.puedeCancelar, true);
  const canceled = await s.purchases.cancel(s.purchase.id, s.buyer);
  assert.equal(canceled.estado, 'CANCELADA');
  assert.equal(canceled.reembolso, null);
  assert.equal(canceled.puedeCancelar, false);
  assert.deepEqual(await createPurchasesService(s.client).get(canceled.id, s.buyer), canceled);
  assert.deepEqual(await s.purchases.listOwn(s.buyer), [canceled]);
  assert.deepEqual(await s.purchases.listOwn(s.organizer), []);
  const sales = await createSalesService(s.client).getEventSales(s.event.id, s.organizer);
  assert.equal(sales.compras[0].estado, 'CANCELADA');
  assert.deepEqual(sales.evento.tiposEntrada.map((ticket) => ticket.cupo), [3, 5]);
  assert.deepEqual((await s.catalog.getEvent(s.event.id)).tiposEntrada.map((ticket) => ticket.cupo), [3, 5]);
});

test('C7 punta a punta: confirmada reembolsa el total histórico simulado y conserva autor, fecha e historial', async (t) => {
  const s = await setup(t);
  await s.patch(`/compras/${s.purchase.id}/estado`, { estado: 'CONFIRMADA' });
  await s.patch(`/eventos/${s.event.id}/tipos-entrada/${s.event.tiposEntrada[0].id}`, { precio: 99, nombre: 'Renombrada' });
  const refunded = await s.purchases.cancel(s.purchase.id, s.buyer);
  assert.equal(refunded.estado, 'REEMBOLSADA');
  assert.equal(refunded.tipoEntradaNombre, 'General');
  assert.equal(refunded.total, 20.5);
  assert.deepEqual(refunded.reembolso, { importe: 20.5, fecha: '2026-11-02T12:00:00.000Z', simulado: true });
  assert.equal(refunded.diasRestantes, null);
  assert.equal(refunded.puedeReseniar, false);
  const history = await s.client.get(`/compras/${s.purchase.id}/historial`, { usuarioId: 'comprador-1' });
  assert.deepEqual(history.map((change) => change.estado), ['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'REEMBOLSADA']);
  assert.ok(history.slice(-2).every((change) => change.quienId === 'comprador-1' && change.fechaHora === refunded.reembolso.fecha));
  assert.deepEqual((await createPurchasesService(s.client).get(refunded.id, s.buyer)).reembolso, refunded.reembolso);
});

test('C7 punta a punta: permisos, contenido, utilizada y comienzo del evento se comprueban al confirmar', async (t) => {
  const s = await setup(t);
  const path = `/compras/${s.purchase.id}/cancelacion`;
  await assert.rejects(s.client.post(path, {}), { status: 401 });
  for (const usuarioId of ['comprador-2', 'organizador-1']) await assert.rejects(s.client.post(path, {}, { usuarioId }), { status: 403 });
  for (const data of [{ importe: 0 }, { estado: 'CANCELADA' }, { compradorId: 'comprador-2' }]) {
    await assert.rejects(s.client.post(path, data, { usuarioId: 'comprador-1' }), { status: 400 });
  }
  await assert.rejects(s.purchases.cancel('inexistente', s.buyer), { status: 404 });
  const used = await s.buy(s.otherBuyer, 1);
  await s.patch(`/compras/${used.id}/estado`, { estado: 'CONFIRMADA' });
  await s.patch(`/compras/${used.id}/estado`, { estado: 'UTILIZADA' });
  await assert.rejects(s.purchases.cancel(used.id, s.otherBuyer), { status: 409 });
  assert.equal(s.purchase.puedeCancelar, true); // Lo visto antes puede haber quedado desactualizado.
  s.advance(s.event.fecha);
  await assert.rejects(s.purchases.cancel(s.purchase.id, s.buyer), { status: 409 });
  assert.equal((await s.purchases.get(s.purchase.id, s.buyer)).puedeCancelar, false);
  assert.equal((await s.catalog.getEvent(s.event.id)).tiposEntrada[0].cupo, 0);
  assert.equal(s.repositories.compras.findById(s.purchase.id).historial.length, 1);
});

test('C7 punta a punta: respuesta perdida se recupera tras recarga e inicio sin doble reembolso ni liberar cupo revendido', async (t) => {
  const s = await setup(t);
  await s.patch(`/compras/${s.purchase.id}/estado`, { estado: 'CONFIRMADA' });
  let lose = true;
  const flaky = createPurchasesService(createApiClient({ baseUrl: s.baseUrl, fetchImpl: async (url, options) => {
    const response = await fetch(url, options);
    if (lose && options.method === 'POST') { lose = false; await response.text(); throw new TypeError('Respuesta perdida'); }
    return response;
  } }));
  await assert.rejects(flaky.cancel(s.purchase.id, s.buyer), { code: 'NETWORK' });
  const recovered = await createPurchasesService(s.client).get(s.purchase.id, s.buyer);
  assert.equal(recovered.estado, 'REEMBOLSADA');
  await s.buy(s.otherBuyer, 3);
  s.advance('2026-12-02T00:00:00Z');
  assert.deepEqual(await flaky.cancel(s.purchase.id, s.buyer), recovered);
  assert.equal((await s.catalog.getEvent(s.event.id)).tiposEntrada[0].cupo, 0);
  assert.equal(s.repositories.compras.findById(s.purchase.id).historial.length, 4);
  s.repositories.usuarios.findById('comprador-1').roles = ['ORGANIZADOR'];
  await assert.rejects(flaky.cancel(s.purchase.id, s.buyer), { status: 403 });
});

test('C7 punta a punta: solicitudes simultáneas cancelan una vez y el chat sigue disponible después', async (t) => {
  const s = await setup(t);
  await s.patch(`/compras/${s.purchase.id}/estado`, { estado: 'CONFIRMADA' });
  const path = `/compras/${s.purchase.id}/cancelacion`;
  const options = { usuarioId: 'comprador-1' };
  const [a, b] = await Promise.all([s.client.post(path, {}, options), s.client.post(path, {}, options)]);
  assert.deepEqual(a, b);
  assert.equal(s.repositories.compras.findById(s.purchase.id).historial.length, 4);
  assert.equal((await s.catalog.getEvent(s.event.id)).tiposEntrada[0].cupo, 3);
  const chat = createChatService(s.client);
  await chat.send(s.purchase.id, 'Consulta sobre mi reembolso simulado', s.buyer);
  const history = await chat.getConversation(s.purchase.id, s.buyer);
  assert.equal(history.messages.at(-1).mensaje, 'Consulta sobre mi reembolso simulado');
});

test('C8 punta a punta: organizador ve cancelación, reembolso simulado y devolución por tipo sin alterar compras utilizadas', async (t) => {
  const s = await setup(t);
  const vip = await s.purchases.create(preparePurchaseIntent(s.event, s.event.tiposEntrada[1].id, 2), s.otherBuyer);
  const used = await s.buy(s.otherBuyer, 1);
  for (const id of [vip.id, used.id]) await s.patch(`/compras/${id}/estado`, { estado: 'CONFIRMADA' });
  await s.patch(`/compras/${used.id}/estado`, { estado: 'UTILIZADA' });
  const sales = createSalesService(s.client);
  assert.deepEqual((await sales.getEventSales(s.event.id, s.organizer)).evento.tiposEntrada.map((ticket) => ticket.cupo), [0, 3]);
  await s.purchases.cancel(s.purchase.id, s.buyer);
  await s.purchases.cancel(vip.id, s.otherBuyer);
  const updated = await sales.getEventSales(s.event.id, s.organizer);
  assert.deepEqual(updated.evento.tiposEntrada.map((ticket) => ticket.cupo), [2, 5]);
  assert.deepEqual(updated.compras.map((purchase) => purchase.estado), ['CANCELADA', 'REEMBOLSADA', 'UTILIZADA']);
  assert.equal(updated.compras[0].reembolso, null);
  assert.deepEqual(updated.compras[1].reembolso, { importe: 40, fecha: '2026-11-02T12:00:00.000Z', simulado: true });
  assert.equal(updated.compras[1].comprador.id, s.otherBuyer.usuario.id);
  assert.ok(updated.compras.every((purchase) => !purchase.puedeCancelar));
  await assert.rejects(s.purchases.cancel(used.id, s.otherBuyer), { status: 409 });
  assert.deepEqual(await sales.getEventSales(s.event.id, s.organizer), updated);
});

test('C8 punta a punta: utilización y cancelación concurrentes completan solo una transición con cupo e historial consistentes', async (t) => {
  const s = await setup(t);
  await s.patch(`/compras/${s.purchase.id}/estado`, { estado: 'CONFIRMADA' });
  const [cancel, use] = await Promise.all([
    s.purchases.cancel(s.purchase.id, s.buyer).then(() => ({ status: 200 }), (cause) => ({ status: cause.status })),
    fetch(`${s.baseUrl}/compras/${s.purchase.id}/estado`, { method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Usuario-Id': s.organizer.usuario.id },
      body: JSON.stringify({ estado: 'UTILIZADA' }) }).then(async (response) => {
      await response.json();
      return { status: response.status };
    }),
  ]);
  assert.deepEqual([cancel.status, use.status].sort(), [200, 409]);
  const updated = await createSalesService(s.client).getEventSales(s.event.id, s.organizer);
  const [purchase] = updated.compras;
  const history = await s.client.get(`/compras/${purchase.id}/historial`, { usuarioId: s.organizer.usuario.id });
  assert.equal(purchase.puedeCancelar, false);
  if (cancel.status === 200) {
    assert.equal(purchase.estado, 'REEMBOLSADA');
    assert.equal(updated.evento.tiposEntrada[0].cupo, 3);
    assert.equal(purchase.reembolso.importe, 20.5);
    assert.deepEqual(history.map((change) => change.estado), ['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'REEMBOLSADA']);
  } else {
    assert.equal(purchase.estado, 'UTILIZADA');
    assert.equal(updated.evento.tiposEntrada[0].cupo, 1);
    assert.equal(purchase.reembolso, null);
    assert.deepEqual(history.map((change) => change.estado), ['PENDIENTE', 'CONFIRMADA', 'UTILIZADA']);
  }
  assert.equal(updated.evento.tiposEntrada[1].cupo, 5);
});
