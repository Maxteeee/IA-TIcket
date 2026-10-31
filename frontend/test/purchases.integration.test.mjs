import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../../backend/src/app.js';
import { createRepositories } from '../../backend/src/repositories/index.js';
import { seedReferenceData } from '../../backend/src/data/reference.js';
import { Usuario } from '../../backend/src/domain/Usuario.js';
import { RolUsuario } from '../../backend/src/domain/RolUsuario.js';
import { createApiClient } from '../src/services/api.client.js';
import { createCatalogService } from '../src/services/catalog.service.js';
import { createEventsService } from '../src/services/events.service.js';
import { createPurchasesService } from '../src/services/purchases.service.js';
import { authMock } from '../src/services/auth.mock.js';
import { preparePurchaseIntent } from '../src/utils/purchaseIntent.js';

async function setup(t, cupo = 3) {
  let now = new Date('2026-11-01T00:00:00Z');
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
  const catalog = createCatalogService(client);
  const organizer = authMock.getSession('organizador-1');
  const buyer = authMock.getSession('comprador-1');
  const otherBuyer = { usuario: { id: 'comprador-2' }, roles: ['COMPRADOR'] };
  const event = await createEventsService(client).create({ nombre: 'Encuentro C12', descripcion: 'Compra de entradas',
    fecha: '2026-12-01T20:30:00Z', categoriaId: 'demo-categoria-1', tiposEntrada: [
      { nombre: 'General', descripcion: '', precio: 10.25, cupo },
      { nombre: 'VIP', descripcion: '', precio: 20, cupo: 2 },
    ] }, organizer);
  return { repositories, baseUrl, client, catalog, organizer, buyer, otherBuyer, event,
    purchases: createPurchasesService(client), advance: (value) => { now = new Date(value); } };
}

test('C12 punta a punta: compra un tipo publicado en C4, reserva su cupo y recupera el comprobante privado', async (t) => {
  const s = await setup(t);
  const event = await s.catalog.getEvent(s.event.id);
  const intent = preparePurchaseIntent(event, event.tiposEntrada[0].id, 2);
  const purchase = await s.purchases.create(intent, s.buyer);
  assert.equal(purchase.estado, 'PENDIENTE');
  assert.equal(purchase.compradorId, 'comprador-1');
  assert.equal(purchase.total, 20.5);
  assert.equal(purchase.precioUnitario, 10.25);
  assert.equal(purchase.tipoEntradaNombre, 'General');
  const refreshed = await s.catalog.getEvent(event.id);
  assert.deepEqual(refreshed.tiposEntrada.map((ticket) => ticket.cupo), [1, 2]);
  assert.deepEqual((await s.catalog.getEvents())[0].tiposEntrada.map((ticket) => ticket.cupo), [1, 2]);
  assert.deepEqual(await createPurchasesService(s.client).get(purchase.id, s.buyer), purchase);
  const history = s.repositories.compras.findById(purchase.id).historial;
  assert.equal(history.length, 1);
  assert.equal(history[0].quien.id, 'comprador-1');
  await assert.rejects(s.purchases.get(purchase.id, s.otherBuyer), { status: 403 });
});

test('C12 punta a punta: dos compradores compiten por la última entrada sin sobreventa', async (t) => {
  const s = await setup(t, 1);
  const intent = preparePurchaseIntent(s.event, s.event.tiposEntrada[0].id, 1);
  const results = await Promise.allSettled([
    s.purchases.create(intent, s.buyer),
    createPurchasesService(s.client).create(intent, s.otherBuyer),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.find((result) => result.status === 'rejected').reason.status, 409);
  assert.equal(s.repositories.compras.findAll().length, 1);
  assert.equal((await s.catalog.getEvent(s.event.id)).tiposEntrada[0].cupo, 0);
});

test('C12 punta a punta: POST concurrentes con la misma clave reservan una sola vez', async (t) => {
  const s = await setup(t, 1);
  const intent = preparePurchaseIntent(s.event, s.event.tiposEntrada[0].id, 1);
  const options = { usuarioId: 'comprador-1', idempotencyKey: 'ultima-entrada' };
  const [first, second] = await Promise.all([
    s.client.post('/compras', intent, options), s.client.post('/compras', intent, options),
  ]);
  assert.equal(first.id, second.id);
  assert.equal(s.repositories.compras.findAll().length, 1);
  assert.equal(s.repositories.eventos.findById(s.event.id).tiposEntrada[0].cupo, 0);
  await assert.rejects(s.client.post('/compras', { ...intent, cantidad: 2 }, options), { status: 409 });
});

test('C12 punta a punta: recupera una respuesta perdida aunque ya no quede cupo y el evento haya comenzado', async (t) => {
  const s = await setup(t, 1);
  let loseResponse = true;
  const service = createPurchasesService(createApiClient({ baseUrl: s.baseUrl, fetchImpl: async (...args) => {
    const response = await fetch(...args);
    if (loseResponse) { loseResponse = false; await response.text(); throw new TypeError('Respuesta perdida después de reservar'); }
    return response;
  } }));
  const intent = preparePurchaseIntent(s.event, s.event.tiposEntrada[0].id, 1);
  await assert.rejects(service.create(intent, s.buyer), { code: 'NETWORK' });
  assert.deepEqual(service.getPending(s.buyer, s.event.id), intent);
  const type = s.repositories.eventos.findById(s.event.id).tiposEntrada[0];
  assert.equal(type.cupo, 0);
  type.precio = 99;
  type.nombre = 'Precio nuevo';
  s.advance('2026-12-02T00:00:00Z');
  const recovered = await service.create(service.getPending(s.buyer, s.event.id), s.buyer);
  assert.equal(recovered.precioUnitario, 10.25);
  assert.equal(recovered.tipoEntradaNombre, 'General');
  assert.equal(recovered.total, 10.25);
  assert.equal(s.repositories.compras.findAll().length, 1);
  assert.equal(s.repositories.compras.findAll()[0].historial.length, 1);
  assert.equal(type.cupo, 0);
  assert.equal(service.getPending(s.buyer, s.event.id), null);
});

test('C12 punta a punta: cupo o precio desactualizados permiten refrescar y corregir sin compras parciales', async (t) => {
  const s = await setup(t);
  const stale = preparePurchaseIntent(s.event, s.event.tiposEntrada[0].id, 3);
  await s.purchases.create({ ...stale, cantidad: 2 }, s.otherBuyer);
  await assert.rejects(s.purchases.create(stale, s.buyer), { status: 409 });
  assert.equal(s.purchases.getPending(s.buyer, s.event.id), null);
  const fresh = await s.catalog.getEvent(s.event.id);
  assert.equal(fresh.tiposEntrada[0].cupo, 1);
  const revised = preparePurchaseIntent(fresh, fresh.tiposEntrada[0].id, 1);
  s.repositories.eventos.findById(s.event.id).tiposEntrada[0].precio = 0.1;
  await assert.rejects(s.purchases.create(revised, s.buyer), { status: 409 });
  assert.equal(s.repositories.compras.findAll().length, 1);
  const current = await s.catalog.getEvent(s.event.id);
  const purchase = await s.purchases.create(preparePurchaseIntent(current, current.tiposEntrada[0].id, 1), s.buyer);
  assert.equal(purchase.total, 0.1);
  assert.equal(s.repositories.compras.findAll().length, 2);
});

test('C12 punta a punta: servidor valida identidad, rol, campos, tipo y fecha sin confiar en el frontend', async (t) => {
  const s = await setup(t);
  s.repositories.usuarios.save(new Usuario({ id: 'solo-organizador', nombre: 'Solo', apellido: 'Organiza', roles: [RolUsuario.ORGANIZADOR] }));
  const intent = preparePurchaseIntent(s.event, s.event.tiposEntrada[0].id, 1);
  await assert.rejects(s.client.post('/compras', intent), { status: 401 });
  const forged = { usuario: { id: 'solo-organizador' }, roles: ['COMPRADOR'] };
  await assert.rejects(s.purchases.create(intent, forged), { status: 403 });
  for (const changed of [{ cantidad: 0 }, { cantidad: 1.5 }, { total: 0 }, { compradorId: 'comprador-2' }, { estado: 'CONFIRMADA' }]) {
    await assert.rejects(s.client.post('/compras', { ...intent, ...changed }, { usuarioId: 'comprador-1' }), { status: 400 });
  }
  await assert.rejects(s.purchases.create({ ...intent, tipoEntradaId: 'tipo-ajeno' }, s.buyer), { status: 404 });
  assert.equal(s.repositories.compras.findAll().length, 0);
  assert.equal(s.repositories.eventos.findById(s.event.id).tiposEntrada[0].cupo, 3);
  s.advance(s.event.fecha);
  await assert.rejects(s.purchases.create(intent, s.buyer), { status: 409 });
  assert.equal(s.repositories.compras.findAll().length, 0);
});
