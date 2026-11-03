import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../../backend/src/app.js';
import { createRepositories } from '../../backend/src/repositories/index.js';
import { seedDemoData } from '../../backend/test/fixtures/demo.js';
import { createServices } from '../../backend/src/services/index.js';
import { createApiClient } from '../src/services/api.client.js';
import { createCatalogService } from '../src/services/catalog.service.js';
import { Evento } from '../../backend/src/domain/Evento.js';
import { TipoEntrada } from '../../backend/src/domain/TipoEntrada.js';
import { Resenia } from '../../backend/src/domain/Resenia.js';
import { priceRange } from '../src/utils/mockPresentation.js';

async function setup(t, { seeded = true } = {}) {
  const now = () => new Date('2026-11-01T12:00:00Z');
  const repositories = createRepositories();
  if (seeded) seedDemoData(repositories, { now });
  const server = createApp({ repositories, now }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const calls = [];
  const client = createApiClient({ baseUrl: `http://127.0.0.1:${server.address().port}/api`, fetchImpl: (url, options) => {
    calls.push({ url, options });
    return fetch(url, options);
  } });
  return { service: createCatalogService(client), repositories, services: createServices(repositories, { now }), calls };
}

test('C3 punta a punta: categorías reales y catálogo público sin autenticación ni eventos pasados', async (t) => {
  const s = await setup(t);
  const categories = await s.service.getCategories();
  const events = await s.service.getEvents();
  assert.equal(categories.length, 5);
  assert.equal(events.length, 5);
  assert.equal(events.some((event) => event.id === 'demo-pasado'), false);
  assert.ok(events.every((event) => categories.some((category) => category.id === event.categoriaId)));
  assert.equal(events.find((event) => event.id === 'demo-concierto').organizador.nombre, 'Equipo Encuentro');
  assert.equal(events.find((event) => event.id === 'demo-teatro').organizador.nombre, 'Compañía Umbral');
  assert.ok(s.calls.every(({ options }) => !Object.hasOwn(options.headers, 'X-Usuario-Id')));
  assert.ok(s.calls.every(({ options }) => options.signal instanceof AbortSignal));
});

test('C3 punta a punta: búsqueda por nombre, descripción y categoría, acentos y filtros combinados', async (t) => {
  const s = await setup(t);
  assert.deepEqual((await s.service.getEvents({ search: '  CONCIERTO  ' })).map((event) => event.id), ['demo-concierto']);
  assert.deepEqual((await s.service.getEvents({ search: 'guitarras' })).map((event) => event.id), ['demo-concierto']);
  assert.deepEqual((await s.service.getEvents({ search: 'musica' })).map((event) => event.id), ['demo-concierto']);
  assert.deepEqual((await s.service.getEvents({ category: 'demo-categoria-2' })).map((event) => event.id), ['demo-teatro']);
  assert.deepEqual(await s.service.getEvents({ search: 'concierto', category: 'demo-categoria-2' }), []);
  assert.deepEqual(await s.service.getEvents({ search: 'sin coincidencias' }), []);
  const reset = await s.service.getEvents({ search: '', category: 'Todos' });
  assert.equal(reset.length, 5);
});

test('C3 punta a punta: cambios del backend y categorías nuevas aparecen sin tocar los mocks del frontend', async (t) => {
  const s = await setup(t);
  const category = s.services.categorias.create({ nombre: 'Cursos & talleres' });
  assert.ok((await s.service.getCategories()).some((item) => item.id === category.id));
  assert.deepEqual(await s.service.getEvents({ category: category.id }), []);
  const organizer = s.repositories.usuarios.findById('demo-organizador');
  const created = s.services.eventos.create({ nombre: 'Café + código & música', descripcion: 'Programación en comunidad',
    categoriaId: category.id, fecha: '2026-12-01T20:00:00Z', tiposEntrada: [{ nombre: 'General', precio: 100, cupo: 10 }] }, organizer.id);
  const found = await s.service.getEvents({ search: 'Café + código & música', category: category.id });
  assert.deepEqual(found.map((item) => item.id), [created.id]);
  assert.equal(found[0].categoria, 'Cursos & talleres');
  assert.equal(found[0].nombre, 'Café + código & música');
  assert.equal(found[0].posterTitle, 'CAFÉ + CÓDIGO & MÚSICA');
});

test('C3 punta a punta: detalle con ID real, evento borrado y categoría inexistente dan respuestas coherentes', async (t) => {
  const s = await setup(t);
  const event = await s.service.getEvent('demo-teatro');
  assert.equal(event.nombre, 'El umbral');
  assert.equal(event.tiposEntrada.length, 2);
  s.repositories.eventos.delete(event.id);
  await assert.rejects(s.service.getEvent(event.id), { status: 404 });
  await assert.rejects(s.service.getEvents({ category: 'no-existe' }), { status: 404 });
  await assert.rejects(s.service.getEvents({ search: 'x'.repeat(201) }), { status: 400 });
});

test('C3 punta a punta: servidor vacío devuelve listas vacías y no datos de demostración implícitos', async (t) => {
  const s = await setup(t, { seeded: false });
  assert.deepEqual(await s.service.getCategories(), []);
  assert.deepEqual(await s.service.getEvents(), []);
});

test('C11 punta a punta: ordena por fecha, precio mínimo y promedio, con cero antes de sin reseñas', async (t) => {
  const s = await setup(t);
  const byDate = await s.service.getEvents({ sort: 'fecha' });
  assert.deepEqual(byDate.map((event) => event.id), ['demo-conferencia', 'demo-concierto', 'demo-teatro', 'demo-deporte', 'demo-festival']);
  const byPrice = await s.service.getEvents({ sort: 'precio' });
  assert.deepEqual(byPrice.map((event) => event.id), ['demo-deporte', 'demo-conferencia', 'demo-concierto', 'demo-festival', 'demo-teatro']);
  const byScore = await s.service.getEvents({ sort: 'puntaje' });
  assert.deepEqual(byScore.map((event) => event.id), ['demo-concierto', 'demo-festival', 'demo-teatro', 'demo-conferencia', 'demo-deporte']);
  assert.deepEqual(byScore.map((event) => event.organizador.puntaje), [4.5, 4.5, 0, null, null]);
  assert.deepEqual(byScore.map((event) => event.organizador.cantidadResenias), [2, 2, 1, 0, 0]);
  const detail = await s.service.getEvent('demo-teatro');
  assert.equal(detail.organizador.puntaje, 0);
  assert.equal(detail.organizador.cantidadResenias, 1);
});

test('C11 punta a punta: ordena por el tipo más barato, incluso agotado, y combina todos los filtros', async (t) => {
  const s = await setup(t);
  const draft = { descripcion: 'Oferta especial', categoriaId: 'demo-categoria-1', fecha: '2026-12-01T21:00:00Z' };
  const expensive = s.services.eventos.create({ ...draft, nombre: 'Oferta estándar',
    tiposEntrada: [{ nombre: 'General', precio: 10.5, cupo: 10 }] }, 'demo-organizador');
  const cheap = s.services.eventos.create({ ...draft, nombre: 'Oferta con varios tipos', tiposEntrada: [
    { nombre: 'General', precio: 10.25, cupo: 0 }, { nombre: 'Preferencial', precio: 900, cupo: 10 },
  ] }, 'demo-organizador');
  const filters = { search: 'OFERTA', category: 'demo-categoria-1', sort: 'precio' };
  const result = await s.service.getEvents(filters);
  assert.deepEqual(result.map((event) => event.id), [cheap.id, expensive.id]);
  assert.deepEqual(priceRange(result[0]), { min: 10.25, max: 900 });
  assert.equal(result[0].tiposEntrada[0].cupo, 0);
  assert.equal((await s.service.getEvents({ ...filters, category: 'demo-categoria-2' })).length, 0);
  for (const sort of ['fecha', 'puntaje']) {
    const changedOrder = await s.service.getEvents({ ...filters, sort });
    assert.deepEqual(new Set(changedOrder.map((event) => event.id)), new Set([cheap.id, expensive.id]));
  }
  await assert.rejects(s.service.getEvents({ sort: 'no-valido' }), { status: 400 });
});

test('C11 punta a punta: promedia reseñas de todos los eventos del organizador y refleja sus cambios', async (t) => {
  const s = await setup(t);
  const base = s.repositories.eventos.findById('demo-pasado');
  const historical = s.repositories.eventos.save(new Evento({ ...base, id: 'historico-otra-categoria',
    categoria: s.repositories.categorias.findById('demo-categoria-2'),
    tiposEntrada: [new TipoEntrada({ nombre: 'General', descripcion: '', precio: 100, cupo: 0 })] }));
  const extra = s.repositories.resenias.save(new Resenia({ comprador: s.repositories.usuarios.findById('demo-asistente'),
    evento: historical, detalle: 'Otra experiencia', puntuacion: 0 }));
  let result = await s.service.getEvents({ search: 'concierto', category: 'demo-categoria-1', sort: 'puntaje' });
  assert.equal(result[0].organizador.puntaje, 3);
  assert.equal(result[0].organizador.cantidadResenias, 3);
  s.services.resenias.update('demo-resenia-2', { puntuacion: 1 }, 'demo-asistente');
  result = await s.service.getEvents({ sort: 'puntaje' });
  const organizer = result.find((event) => event.id === 'demo-concierto').organizador;
  assert.equal(organizer.puntaje, 5 / 3);
  assert.equal(organizer.cantidadResenias, 3);
  assert.equal((await s.service.getEvent('demo-concierto')).organizador.puntaje, 5 / 3);
  s.services.resenias.delete(extra.id, 'demo-asistente');
  assert.equal((await s.service.getEvent('demo-concierto')).organizador.puntaje, 2.5);
});

test('C11 punta a punta: los empates se resuelven por fecha y luego ID de forma estable', async (t) => {
  const s = await setup(t);
  const base = s.repositories.eventos.findById('demo-concierto');
  for (const [id, fecha] of [['empate-z', '2026-12-01T21:00:00Z'], ['empate-a', '2026-12-01T21:00:00Z'],
    ['empate-primero', '2026-11-20T21:00:00Z']]) {
    s.repositories.eventos.save(new Evento({ ...base, id, nombre: 'Empate', fecha: new Date(fecha), fechaFin: null,
      tiposEntrada: [new TipoEntrada({ nombre: 'General', descripcion: '', precio: 100, cupo: 1 })] }));
  }
  for (const sort of ['fecha', 'precio', 'puntaje']) {
    const events = await s.service.getEvents({ search: 'Empate', sort });
    assert.deepEqual(events.map((event) => event.id), ['empate-primero', 'empate-a', 'empate-z']);
  }
});

test('C10 punta a punta: cada evento muestra experiencias del mismo organizador con autor, origen y puntaje real', async (t) => {
  const s = await setup(t);
  const concert = await s.service.getPreviousReviews('demo-concierto');
  assert.deepEqual(concert.map((review) => review.id), ['demo-resenia-1', 'demo-resenia-2']);
  assert.deepEqual(await s.service.getPreviousReviews('demo-festival'), concert);
  assert.ok(concert.every((review) => review.autor === 'Asistente Demo' && review.evento.nombre === 'Noche de vinilos'
    && review.evento.organizadorId === 'demo-organizador' && review.detalle === 'Experiencia de demostración'));
  const theater = await s.service.getPreviousReviews('demo-teatro');
  assert.equal(theater.length, 1);
  assert.equal(theater[0].puntuacion, 0);
  assert.equal(theater[0].evento.nombre, 'La primera función');
  assert.ok(s.calls.every(({ options }) => !Object.hasOwn(options.headers, 'X-Usuario-Id')));
  assert.ok(s.calls.every(({ options }) => options.signal instanceof AbortSignal));
});

test('C10 punta a punta: vacío, evento ausente y error de carga se distinguen sin fixtures de respaldo', async (t) => {
  const s = await setup(t);
  assert.deepEqual(await s.service.getPreviousReviews('demo-conferencia'), []);
  assert.deepEqual(await s.service.getPreviousReviews('demo-pasado'), []);
  // Promedio global con reseñas del propio evento, pero ninguna experiencia anterior a él.
  assert.equal((await s.service.getEvent('demo-pasado')).organizador.cantidadResenias, 2);
  await assert.rejects(s.service.getPreviousReviews('inexistente'), { status: 404 });
  s.repositories.eventos.delete('demo-deporte');
  await assert.rejects(s.service.getPreviousReviews('demo-deporte'), { status: 404 });
});

test('C10 punta a punta: volver a consultar refleja edición y borrado reales sin recalcular promedio con la lista visible', async (t) => {
  const s = await setup(t);
  await s.service.getPreviousReviews('demo-concierto');
  s.services.resenias.update('demo-resenia-1', { detalle: 'Comentario actualizado', puntuacion: 3.5 }, 'demo-asistente');
  const [updated] = await s.service.getPreviousReviews('demo-concierto');
  assert.equal(updated.detalle, 'Comentario actualizado');
  assert.equal(updated.puntuacion, 3.5);
  s.services.resenias.delete('demo-resenia-2', 'demo-asistente');
  assert.equal((await s.service.getPreviousReviews('demo-concierto')).length, 1);
  assert.equal((await s.service.getEvent('demo-concierto')).organizador.puntaje, 3.5);
  s.services.resenias.delete('demo-resenia-1', 'demo-asistente');
  assert.deepEqual(await s.service.getPreviousReviews('demo-concierto'), []);
});
