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
import { createReviewsService } from '../src/services/reviews.service.js';
import { createCatalogService } from '../src/services/catalog.service.js';
import { authMock } from '../src/services/auth.mock.js';
import { preparePurchaseIntent } from '../src/utils/purchaseIntent.js';

async function setup(t) {
  let now = new Date('2026-11-02T12:00:00Z');
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
  const events = createEventsService(client);
  const draft = { nombre: 'Reseñas C9', descripcion: 'Experiencias de asistentes', categoriaId: 'demo-categoria-1',
    fecha: '2026-11-04T20:00:00Z', fechaFin: '2026-11-04T22:00:00Z', tiposEntrada: [{ nombre: 'General', precio: 10.25, cupo: 10 }] };
  const event = await events.create(draft, organizer);
  const nextEvent = await events.create({ ...draft, nombre: 'Próxima edición', fecha: '2026-11-10T20:00:00Z', fechaFin: '2026-11-10T22:00:00Z' }, organizer);
  const purchases = createPurchasesService(client);
  const buy = (session = buyer) => purchases.create(preparePurchaseIntent(event, event.tiposEntrada[0].id, 1), session);
  const purchase = await buy();
  const patch = async (path, data) => {
    const response = await fetch(`${baseUrl}${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Usuario-Id': 'organizador-1' }, body: JSON.stringify(data) });
    assert.equal(response.status, 200);
  };
  const use = async (id = purchase.id) => {
    await patch(`/compras/${id}/estado`, { estado: 'CONFIRMADA' });
    await patch(`/compras/${id}/estado`, { estado: 'UTILIZADA' });
  };
  const finish = async () => { await use(); now = new Date('2026-11-04T22:00:00Z'); };
  return { repositories, baseUrl, client, buyer, organizer, otherBuyer, event, nextEvent, purchase, purchases, buy, patch, use, finish,
    reviews: createReviewsService(client), catalog: createCatalogService(client), advance: (value) => { now = new Date(value); } };
}

test('C9 punta a punta: compra utilizada y evento finalizado permiten publicar cero, recuperar reseña y actualizar reputación C11', async (t) => {
  const s = await setup(t); await s.finish();
  assert.equal((await s.reviews.load(s.purchase.id, s.buyer)).purchase.puedeReseniar, true);
  const original = s.repositories.compras.findById(s.purchase.id);
  const before = { cupo: original.tipoEntrada.cupo, historial: original.historial.length, estado: original.estado };
  const review = await s.reviews.create(s.purchase.id, { puntuacion: '0', detalle: '  No fue la experiencia esperada.  ' }, s.buyer);
  assert.equal(review.puntuacion, 0);
  assert.equal(review.detalle, 'No fue la experiencia esperada.');
  assert.equal(review.compraId, s.purchase.id);
  assert.equal(review.compradorId, 'comprador-1');
  assert.equal(review.eventoId, s.event.id);
  assert.deepEqual((await createReviewsService(s.client).load(s.purchase.id, s.buyer)).reviews, [review]);
  const next = await s.catalog.getEvent(s.nextEvent.id);
  assert.equal(next.organizador.puntaje, 0);
  assert.equal(next.organizador.cantidadResenias, 1);
  const [experience] = await s.catalog.getPreviousReviews(s.nextEvent.id);
  assert.equal(experience.id, review.id);
  assert.equal(experience.puntuacion, 0);
  assert.equal(experience.detalle, review.detalle);
  assert.equal(experience.evento.nombre, s.event.nombre);
  assert.equal(experience.compradorId, s.buyer.usuario.id);
  assert.deepEqual(await s.catalog.getPreviousReviews(s.event.id), []);
  assert.deepEqual({ cupo: original.tipoEntrada.cupo, historial: original.historial.length, estado: original.estado }, before);
});

test('C9 punta a punta: servidor decide habilitación, incluye frontera de fechaFin y rechaza un estado desactualizado', async (t) => {
  const s = await setup(t);
  const body = { puntuacion: 4.5, detalle: 'Comentario' };
  assert.equal((await s.reviews.load(s.purchase.id, s.buyer)).purchase.puedeReseniar, false);
  await assert.rejects(s.reviews.create(s.purchase.id, body, s.buyer), { status: 409 });
  await s.use();
  s.advance('2026-11-04T21:59:59Z');
  assert.equal((await s.purchases.get(s.purchase.id, s.buyer)).puedeReseniar, false);
  await assert.rejects(s.reviews.create(s.purchase.id, body, s.buyer), { status: 409 });
  s.advance('2026-11-04T22:00:00Z');
  assert.equal((await s.purchases.get(s.purchase.id, s.buyer)).puedeReseniar, true);
  await s.patch(`/eventos/${s.event.id}`, { fechaFin: null });
  assert.equal((await s.purchases.get(s.purchase.id, s.buyer)).puedeReseniar, false);
  await assert.rejects(s.reviews.create(s.purchase.id, body, s.buyer), { status: 409 });
  await s.patch(`/eventos/${s.event.id}`, { fechaFin: '2026-11-04T22:00:00Z' });
  assert.equal((await s.reviews.load(s.purchase.id, s.buyer)).purchase.puedeReseniar, true);
  s.repositories.compras.findById(s.purchase.id).estado = 'CONFIRMADA'; // Cambio de datos entre consulta y confirmación.
  await assert.rejects(s.reviews.create(s.purchase.id, body, s.buyer), { status: 409 });
  assert.deepEqual(s.repositories.resenias.findAll(), []);
  assert.equal(s.reviews.getPending(s.purchase.id, s.buyer), null);
});

test('C9 punta a punta: solo comprador propietario, contenido validado y sin autor o evento elegidos por cliente', async (t) => {
  const s = await setup(t); await s.finish();
  const data = { compraId: s.purchase.id, puntuacion: 5, detalle: 'Comentario' };
  await assert.rejects(s.client.post('/resenias', data), { status: 401 });
  for (const usuarioId of ['comprador-2', 'organizador-1']) await assert.rejects(s.client.post('/resenias', data, { usuarioId }), { status: 403 });
  await assert.rejects(s.reviews.load(s.purchase.id, s.otherBuyer), { status: 403 });
  await assert.rejects(s.reviews.create(s.purchase.id, { puntuacion: 5, detalle: 'Ajena' }, s.organizer), { status: 403 });
  for (const changes of [{ puntuacion: -1 }, { puntuacion: 6 }, { puntuacion: '5' }, { detalle: ' ' }, { detalle: 'a'.repeat(1501) }, { compradorId: 'comprador-2' }, { eventoId: s.nextEvent.id }]) {
    await assert.rejects(s.client.post('/resenias', { ...data, ...changes }, { usuarioId: 'comprador-1' }), { status: 400 });
  }
  s.repositories.usuarios.findById('comprador-1').roles = ['ORGANIZADOR'];
  await assert.rejects(s.client.post('/resenias', data, { usuarioId: 'comprador-1' }), { status: 403 });
  assert.deepEqual(s.repositories.resenias.findAll(), []);
});

test('C9 punta a punta: respuesta perdida recupera la misma reseña sin duplicar ni inflar el promedio', async (t) => {
  const s = await setup(t); await s.finish();
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
  const reviews = createReviewsService(client);
  const data = { puntuacion: '4,5', detalle: 'Muy buena experiencia' };
  await assert.rejects(reviews.create(s.purchase.id, data, s.buyer), { code: 'NETWORK' });
  const [saved] = (await reviews.load(s.purchase.id, s.buyer)).reviews;
  const recovered = await reviews.create(s.purchase.id, reviews.getPending(s.purchase.id, s.buyer), s.buyer);
  assert.equal(recovered.id, saved.id);
  assert.equal(keys[0], keys[1]);
  assert.equal(s.repositories.resenias.findAll().length, 1);
  const organizer = (await s.catalog.getEvent(s.nextEvent.id)).organizador;
  assert.equal(organizer.puntaje, 4.5);
  assert.equal(organizer.cantidadResenias, 1);
});

test('C9 punta a punta: POST concurrentes reservan una publicación y el filtro por compra separa a sus autores', async (t) => {
  const s = await setup(t);
  const other = await s.buy(s.otherBuyer);
  await s.use(other.id);
  await s.finish();
  const data = { compraId: s.purchase.id, puntuacion: 5, detalle: 'Comentario propio' };
  const options = { usuarioId: 'comprador-1', idempotencyKey: 'resenia-concurrente' };
  const [first, second] = await Promise.all([s.client.post('/resenias', data, options), s.client.post('/resenias', data, options)]);
  assert.equal(first.id, second.id);
  await assert.rejects(s.client.post('/resenias', { ...data, puntuacion: 1 }, options), { status: 409 });
  const otherReview = await s.reviews.create(other.id, { puntuacion: '3,5', detalle: 'Otra experiencia' }, s.otherBuyer);
  assert.deepEqual((await s.reviews.load(s.purchase.id, s.buyer)).reviews, [first]);
  assert.deepEqual((await s.reviews.load(other.id, s.otherBuyer)).reviews, [otherReview]);
  assert.equal((await s.catalog.getEvent(s.nextEvent.id)).organizador.puntaje, 4.25);
  await assert.rejects(s.client.get('/resenias?compraId=inexistente'), { status: 404 });
});
