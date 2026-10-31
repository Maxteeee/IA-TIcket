import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../../backend/src/app.js';
import { createRepositories } from '../../backend/src/repositories/index.js';
import { seedDemoData } from '../../backend/src/data/demo.js';
import { createServices } from '../../backend/src/services/index.js';
import { createApiClient } from '../src/services/api.client.js';
import { createCatalogService } from '../src/services/catalog.service.js';

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
  assert.ok(events.every((event) => event.organizador.nombre === 'Equipo Encuentro'));
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
