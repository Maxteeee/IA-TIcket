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
import { authMock } from '../src/services/auth.mock.js';
import { preparePurchaseIntent } from '../src/utils/purchaseIntent.js';
import { remainingDaysLabel } from '../src/utils/purchasePresentation.js';

async function setup(t) {
  let now = new Date('2026-11-01T12:00:00Z');
  const repositories = seedReferenceData(createRepositories());
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
  const event = await createEventsService(client).create({ nombre: 'Encuentro C1', descripcion: 'Seguimiento de compras',
    fecha: '2026-11-03T06:00:00Z', categoriaId: 'demo-categoria-1', tiposEntrada: [
      { nombre: 'General', precio: 10.25, cupo: 20 },
    ] }, organizer);
  const service = createPurchasesService(client);
  const buy = (session = buyer) => service.create(preparePurchaseIntent(event, event.tiposEntrada[0].id, 1), session);
  const state = async (id, estado) => {
    const response = await fetch(`${baseUrl}/compras/${id}/estado`, { method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Usuario-Id': organizer.usuario.id }, body: JSON.stringify({ estado }) });
    assert.equal(response.status, 200);
  };
  return { repositories, client, service, buyer, organizer, event, buy, state, advance: (value) => { now = new Date(value); } };
}

test('C1 punta a punta: recupera compras de C12 después de recargar y separa ambos perfiles', async (t) => {
  const s = await setup(t);
  assert.deepEqual(await s.service.listOwn(s.buyer), []);
  const buyerPurchase = await s.buy();
  const organizerPurchase = await s.buy(s.organizer);
  const reloaded = createPurchasesService(s.client);
  assert.deepEqual(await reloaded.listOwn(s.buyer), [buyerPurchase]);
  assert.deepEqual(await reloaded.listOwn(s.organizer), [organizerPurchase]);
  assert.deepEqual(await reloaded.get(buyerPurchase.id, s.buyer), buyerPurchase);
  await assert.rejects(reloaded.get(buyerPurchase.id, s.organizer), { status: 403 });
  assert.deepEqual(buyerPurchase.evento, { id: s.event.id, nombre: s.event.nombre, fecha: s.event.fecha, organizadorId: s.organizer.usuario.id });
});

test('C1 punta a punta: diferencia los cinco estados y solo la confirmada lleva días restantes', async (t) => {
  const s = await setup(t);
  const purchases = [];
  for (let i = 0; i < 5; i++) purchases.push(await s.buy());
  await s.state(purchases[1].id, 'CONFIRMADA');
  await s.state(purchases[2].id, 'CONFIRMADA');
  await s.state(purchases[2].id, 'UTILIZADA');
  // Estados históricos de prueba: no se agrega un flujo de cancelación/reembolso a la API.
  s.repositories.compras.findById(purchases[3].id).estado = 'CANCELADA';
  s.repositories.compras.findById(purchases[4].id).estado = 'REEMBOLSADA';
  const result = await s.service.listOwn(s.buyer);
  assert.deepEqual(result.map((purchase) => purchase.estado), ['PENDIENTE', 'CONFIRMADA', 'UTILIZADA', 'CANCELADA', 'REEMBOLSADA']);
  assert.deepEqual(result.map((purchase) => purchase.diasRestantes), [null, 2, null, null, null]);
  assert.deepEqual((await s.client.get('/compras?estado=CONFIRMADA', { usuarioId: 'comprador-1' })).map((purchase) => purchase.id), [purchases[1].id]);
  assert.equal((await s.service.get(purchases[1].id, s.buyer)).diasRestantes, 2);
});

test('C1 punta a punta: recalcula días con el reloj del servidor y conserva eventos pasados fuera del catálogo', async (t) => {
  const s = await setup(t);
  const purchase = await s.buy();
  await s.state(purchase.id, 'CONFIRMADA');
  for (const [now, days] of [['2026-11-01T12:00:00Z', 2], ['2026-11-02T06:00:00Z', 1],
    ['2026-11-03T05:59:59Z', 1], ['2026-11-03T06:00:00Z', 0], ['2026-11-04T12:00:00Z', 0]]) {
    s.advance(now);
    const [listed] = await s.service.listOwn(s.buyer);
    const detail = await s.service.get(purchase.id, s.buyer);
    assert.equal(listed.diasRestantes, days);
    assert.equal(detail.diasRestantes, days);
    assert.equal(remainingDaysLabel(listed), `${days} ${days === 1 ? 'día restante' : 'días restantes'}`);
  }
  assert.deepEqual(await s.client.get('/eventos'), []);
  const [past] = await s.service.listOwn(s.buyer);
  assert.equal(past.evento.nombre, s.event.nombre);
  assert.equal(past.evento.fecha, s.event.fecha);
});

test('C1 punta a punta: identidad y rol se verifican en servidor y no se puede pedir la lista de otro comprador', async (t) => {
  const s = await setup(t);
  await s.buy();
  s.repositories.usuarios.save(new Usuario({ id: 'solo-organizador', nombre: 'Solo', apellido: 'Organiza', roles: [RolUsuario.ORGANIZADOR] }));
  await assert.rejects(s.client.get('/compras'), { status: 401 });
  await assert.rejects(s.client.get('/compras', { usuarioId: 'inexistente' }), { status: 404 });
  await assert.rejects(s.service.listOwn({ usuario: { id: 'solo-organizador' }, roles: ['COMPRADOR'] }), { status: 403 });
  await assert.rejects(s.client.get('/compras?compradorId=comprador-1', { usuarioId: 'organizador-1' }), { status: 400 });
  assert.deepEqual(await s.service.listOwn(s.organizer), []);
});
