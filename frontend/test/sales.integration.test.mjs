import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../../backend/src/app.js';
import { createRepositories } from '../../backend/src/repositories/index.js';
import { seedReferenceData } from '../../backend/src/data/reference.js';
import { Usuario } from '../../backend/src/domain/Usuario.js';
import { RolUsuario } from '../../backend/src/domain/RolUsuario.js';
import { createApiClient } from '../src/services/api.client.js';
import { createEventsService } from '../src/services/events.service.js';
import { createPurchasesService } from '../src/services/purchases.service.js';
import { createSalesService } from '../src/services/sales.service.js';
import { authMock } from '../src/services/auth.mock.js';
import { preparePurchaseIntent } from '../src/utils/purchaseIntent.js';

async function setup(t, generalCupo = 3) {
  let now = new Date('2026-11-01T12:00:00Z');
  const repositories = seedReferenceData(createRepositories());
  repositories.usuarios.save(new Usuario({ id: 'comprador-2', nombre: 'Otra', apellido: 'Compradora' }));
  repositories.usuarios.save(new Usuario({ id: 'otro-organizador', nombre: 'Otro', apellido: 'Organizador', roles: [RolUsuario.ORGANIZADOR] }));
  const server = createApp({ repositories, now: () => new Date(now) }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const client = createApiClient({ baseUrl });
  const events = createEventsService(client);
  const purchases = createPurchasesService(client);
  const sales = createSalesService(client);
  const organizer = authMock.getSession('organizador-1');
  const buyer = authMock.getSession('comprador-1');
  const otherBuyer = { usuario: { id: 'comprador-2' }, roles: ['COMPRADOR'] };
  const otherOrganizer = { usuario: { id: 'otro-organizador' }, roles: ['ORGANIZADOR'] };
  const draft = { nombre: 'Encuentro C2', descripcion: 'Compras por evento', fecha: '2026-12-01T20:00:00Z', categoriaId: 'demo-categoria-1',
    tiposEntrada: [{ nombre: 'General', precio: 10.25, cupo: generalCupo }, { nombre: 'VIP', precio: 20, cupo: 2 }, { nombre: 'Sin cupo', precio: 0, cupo: 0 }] };
  const event = await events.create(draft, organizer);
  const anotherOwn = await events.create({ ...draft, nombre: 'Otro evento propio' }, organizer);
  const foreign = await events.create({ ...draft, nombre: 'Evento ajeno' }, otherOrganizer);
  const buy = (session = buyer, chosen = event, type = 0, quantity = 1) => purchases.create(preparePurchaseIntent(chosen, chosen.tiposEntrada[type].id, quantity), session);
  const patch = async (path, data) => {
    const response = await fetch(`${baseUrl}${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Usuario-Id': organizer.usuario.id }, body: JSON.stringify(data) });
    assert.equal(response.status, 200);
  };
  return { repositories, client, events, purchases, sales, organizer, buyer, otherBuyer, otherOrganizer, event, anotherOwn, foreign, buy, patch,
    advance: (value) => { now = new Date(value); } };
}

test('C2 punta a punta: evento recién publicado y compras C12 de distintos compradores, sin mezclar otros eventos', async (t) => {
  const s = await setup(t);
  const empty = await s.sales.getEventSales(s.event.id, s.organizer);
  assert.deepEqual(empty.compras, []);
  assert.deepEqual(empty.evento.tiposEntrada.map((ticket) => ticket.cupo), [3, 2, 0]);
  const general = await s.buy(s.buyer, s.event, 0, 2);
  const vip = await s.buy(s.otherBuyer, s.event, 1);
  await s.buy(s.buyer, s.anotherOwn);
  await s.buy(s.buyer, s.foreign);
  const result = await createSalesService(s.client).getEventSales(s.event.id, s.organizer);
  assert.deepEqual(result.compras.map((purchase) => purchase.id), [general.id, vip.id]);
  assert.deepEqual(result.compras.map((purchase) => `${purchase.comprador.nombre} ${purchase.comprador.apellido}`.trim()), ['Comprador 1', 'Otra Compradora']);
  assert.deepEqual(result.evento.tiposEntrada.map((ticket) => ticket.cupo), [1, 1, 0]);
  assert.equal(result.compras[0].cantidad, 2);
  assert.equal(result.compras[0].total, 20.5);
  assert.equal((await s.purchases.listOwn(s.buyer)).length, 3);
  assert.deepEqual(await s.purchases.listOwn(s.organizer), []);
  assert.deepEqual((await s.events.listOwn(s.organizer)).map((event) => event.id).sort(), [s.event.id, s.anotherOwn.id].sort());
});

test('C2 punta a punta: cinco estados y todos los tipos agotados, sin confundirlos con un evento sin compras', async (t) => {
  const s = await setup(t);
  const purchases = [];
  for (let i = 0; i < 3; i++) purchases.push(await s.buy());
  for (let i = 0; i < 2; i++) purchases.push(await s.buy(s.otherBuyer, s.event, 1));
  await s.patch(`/compras/${purchases[1].id}/estado`, { estado: 'CONFIRMADA' });
  await s.patch(`/compras/${purchases[2].id}/estado`, { estado: 'CONFIRMADA' });
  await s.patch(`/compras/${purchases[2].id}/estado`, { estado: 'UTILIZADA' });
  // Históricos de prueba; C2 no implementa transiciones ni devolución de cupo.
  s.repositories.compras.findById(purchases[3].id).estado = 'CANCELADA';
  s.repositories.compras.findById(purchases[4].id).estado = 'REEMBOLSADA';
  const result = await s.sales.getEventSales(s.event.id, s.organizer);
  assert.deepEqual(result.compras.map((purchase) => purchase.estado), ['PENDIENTE', 'CONFIRMADA', 'UTILIZADA', 'CANCELADA', 'REEMBOLSADA']);
  assert.deepEqual(result.evento.tiposEntrada.map((ticket) => ticket.cupo), [0, 0, 0]);
  const other = await s.sales.getEventSales(s.anotherOwn.id, s.organizer);
  assert.deepEqual(other.compras, []);
  assert.deepEqual(other.evento.tiposEntrada.map((ticket) => ticket.cupo), [3, 2, 0]);
});

test('C2 punta a punta: confirmar/utilizar no descuentan de nuevo y la consulta mantiene precios históricos y eventos pasados', async (t) => {
  const s = await setup(t);
  const purchase = await s.buy(s.buyer, s.event, 0, 2);
  await s.patch(`/eventos/${s.event.id}/tipos-entrada/${s.event.tiposEntrada[0].id}`, { nombre: 'General nueva', precio: 99 });
  for (const estado of ['CONFIRMADA', 'UTILIZADA']) {
    await s.patch(`/compras/${purchase.id}/estado`, { estado });
    const result = await s.sales.getEventSales(s.event.id, s.organizer);
    assert.equal(result.compras[0].estado, estado);
    assert.equal(result.compras[0].tipoEntradaNombre, 'General');
    assert.equal(result.compras[0].precioUnitario, 10.25);
    assert.equal(result.compras[0].total, 20.5);
    assert.equal(result.evento.tiposEntrada[0].nombre, 'General nueva');
    assert.equal(result.evento.tiposEntrada[0].precio, 99);
    assert.deepEqual(result.evento.tiposEntrada.map((ticket) => ticket.cupo), [1, 2, 0]);
  }
  s.advance('2026-12-02T00:00:00Z');
  assert.deepEqual(await s.client.get('/eventos'), []);
  assert.equal((await s.events.listOwn(s.organizer)).length, 2);
  assert.equal((await s.sales.getEventSales(s.event.id, s.organizer)).compras[0].estado, 'UTILIZADA');
});

test('C2 punta a punta: lectura concurrente con compras de última entrada nunca combina cupos y ventas de momentos distintos', async (t) => {
  const s = await setup(t, 1);
  const results = await Promise.allSettled([
    s.buy(), s.buy(s.otherBuyer),
    s.sales.getEventSales(s.event.id, s.organizer), s.sales.getEventSales(s.event.id, s.organizer),
  ]);
  assert.equal(results.slice(0, 2).filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.slice(0, 2).find((result) => result.status === 'rejected').reason.status, 409);
  for (const result of results.slice(2)) {
    assert.equal(result.status, 'fulfilled');
    assert.equal(result.value.evento.tiposEntrada[0].cupo + result.value.compras.reduce((total, purchase) => total + purchase.cantidad, 0), 1);
  }
  const final = await s.sales.getEventSales(s.event.id, s.organizer);
  assert.equal(final.evento.tiposEntrada[0].cupo, 0);
  assert.equal(final.compras.length, 1);
});

test('C2 punta a punta: comprador participante y organizador ajeno no pueden leer ventas ni saltar el rol almacenado', async (t) => {
  const s = await setup(t);
  await s.buy();
  const path = `/eventos/${s.event.id}/ventas`;
  await assert.rejects(s.client.get(path), { status: 401 });
  await assert.rejects(s.client.get(path, { usuarioId: 'inexistente' }), { status: 404 });
  await assert.rejects(s.client.get(path, { usuarioId: 'comprador-1' }), { status: 403 });
  await assert.rejects(s.sales.getEventSales(s.event.id, s.otherOrganizer), { status: 403 });
  await assert.rejects(s.sales.getEventSales(s.foreign.id, s.organizer), { status: 403 });
  await assert.rejects(s.sales.getEventSales(s.event.id, { ...s.buyer, roles: ['ORGANIZADOR'] }), { status: 403 });
  await assert.rejects(s.sales.getEventSales('inexistente', s.organizer), { status: 404 });
  await assert.rejects(s.client.get(`${path}?eventoId=${s.foreign.id}`, { usuarioId: 'organizador-1' }), { status: 400 });
  // La ruta anterior también sigue privada, y el resumen no filtra campos públicos al catálogo.
  await assert.rejects(s.client.get(`/eventos/${s.event.id}/compras`, { usuarioId: 'comprador-1' }), { status: 403 });
  const publicEvent = await s.client.get(`/eventos/${s.event.id}`);
  assert.equal(Object.hasOwn(publicEvent, 'compras'), false);
});
