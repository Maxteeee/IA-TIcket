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
import { authMock } from '../src/services/auth.mock.js';
import { prepareEventDraft } from '../src/utils/eventDraft.js';

async function setup(t) {
  const now = new Date('2026-11-01T00:00:00Z');
  const repositories = seedReferenceData(createRepositories());
  const server = createApp({ repositories, now: () => new Date(now) }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const client = createApiClient({ baseUrl });
  const catalog = createCatalogService(client);
  const categories = await catalog.getCategories();
  const draft = prepareEventDraft({ name: 'Encuentro C4', description: 'Música y experiencias para todos',
    categoryId: categories[0].id, date: '01/12/2026', time: '20:30', tickets: [
      { id: 'draft-1', nombre: 'General', descripcion: 'Acceso al encuentro', precio: '1200,50', cupo: '50' },
      { id: 'draft-2', nombre: 'VIP', descripcion: 'Ubicación preferencial', precio: '5000', cupo: '10' },
    ] }, now);
  return { repositories, baseUrl, client, catalog, draft, service: createEventsService(client), session: authMock.getSession('organizador-1') };
}

test('C4 punta a punta: publicar varios tipos desde la sesión activa y encontrar el evento en C3/C11', async (t) => {
  const s = await setup(t);
  assert.deepEqual(await s.catalog.getEvents(), []);
  const created = await s.service.create(s.draft, s.session, { idempotencyKey: 'formulario-1' });
  assert.equal(created.nombre, 'Encuentro C4');
  assert.equal(created.organizadorId, 'organizador-1');
  assert.equal(created.organizador.nombre, 'Organizador 1');
  assert.equal(created.tiposEntrada.length, 2);
  assert.deepEqual(created.tiposEntrada.map(({ precio, cupo }) => ({ precio, cupo })), [{ precio: 1200.5, cupo: 50 }, { precio: 5000, cupo: 10 }]);
  assert.equal(new Set(created.tiposEntrada.map((ticket) => ticket.id)).size, 2);
  assert.ok(created.tiposEntrada.every((ticket) => !ticket.id.startsWith('draft-')));
  assert.equal(s.repositories.compras.findAll().length, 0);
  for (const sort of ['fecha', 'precio', 'puntaje']) {
    const found = await s.catalog.getEvents({ search: 'ENCUENTRO C4', category: s.draft.categoriaId, sort });
    assert.deepEqual(found.map((event) => event.id), [created.id]);
  }
  assert.deepEqual(await s.catalog.getEvent(created.id), created);
  // Una nueva instancia del servicio representa recargar la app: no depende de estado React.
  assert.deepEqual((await createEventsService(s.client).listOwn(s.session)).map((event) => event.id), [created.id]);
});

test('C4 punta a punta: el servidor rechaza comprador aunque el frontend declare un rol falso', async (t) => {
  const s = await setup(t);
  const forged = { ...s.session, usuario: authMock.getSession('comprador-1').usuario };
  await assert.rejects(s.service.create(s.draft, forged), { status: 403 });
  await assert.rejects(s.client.post('/eventos', s.draft), { status: 401 });
  await assert.rejects(s.client.post('/usuarios', { nombre: 'A', apellido: 'B', roles: ['ORGANIZADOR'] }), { status: 400 });
  assert.deepEqual(s.repositories.eventos.findAll(), []);
});

test('C4 punta a punta: un segundo tipo inválido no deja datos parciales y puede corregirse sin perder el borrador', async (t) => {
  const s = await setup(t);
  const original = structuredClone(s.draft);
  const invalid = { ...s.draft, tiposEntrada: [s.draft.tiposEntrada[0], { ...s.draft.tiposEntrada[1], cupo: 1.5 }] };
  await assert.rejects(s.service.create(invalid, s.session, { idempotencyKey: 'correccion' }), { status: 400 });
  assert.deepEqual(await s.service.listOwn(s.session), []);
  assert.deepEqual(s.draft, original);
  const created = await s.service.create(s.draft, s.session, { idempotencyKey: 'correccion' });
  assert.equal(created.tiposEntrada.length, 2);
});

test('C4 punta a punta: publicaciones simultáneas y reintento tras respuesta perdida no duplican eventos', async (t) => {
  const s = await setup(t);
  const options = { idempotencyKey: 'doble-pulsacion' };
  const [first, second] = await Promise.all([s.service.create(s.draft, s.session, options), s.service.create(s.draft, s.session, options)]);
  assert.equal(first.id, second.id);
  assert.equal(s.repositories.eventos.findAll().length, 1);
  let loseResponse = true;
  const client = createApiClient({ baseUrl: s.baseUrl, fetchImpl: async (...args) => {
    const response = await fetch(...args);
    if (loseResponse) { loseResponse = false; await response.text(); throw new TypeError('Respuesta perdida después de guardar'); }
    return response;
  } });
  const service = createEventsService(client);
  const retryOptions = { idempotencyKey: 'respuesta-perdida' };
  await assert.rejects(service.create(s.draft, s.session, retryOptions), { code: 'NETWORK' });
  assert.equal(s.repositories.eventos.findAll().length, 2);
  await service.create(s.draft, s.session, retryOptions);
  assert.equal(s.repositories.eventos.findAll().length, 2);
  await assert.rejects(service.create({ ...s.draft, nombre: 'Otro contenido' }, s.session, retryOptions), { status: 409 });
});

test('C4 punta a punta: lista del organizador solo incluye sus publicaciones y cada tipo conserva su cupo', async (t) => {
  const s = await setup(t);
  s.repositories.usuarios.save(new Usuario({ id: 'otro-organizador', nombre: 'Otro', apellido: 'Organizador', roles: [RolUsuario.ORGANIZADOR] }));
  const otherSession = { ...s.session, usuario: { id: 'otro-organizador' } };
  const own = await s.service.create(s.draft, s.session);
  const other = await s.service.create(s.draft, otherSession);
  assert.deepEqual((await s.service.listOwn(s.session)).map((event) => event.id), [own.id]);
  assert.deepEqual((await s.service.listOwn(otherSession)).map((event) => event.id), [other.id]);
  const detail = await s.catalog.getEvent(own.id);
  assert.deepEqual(detail.tiposEntrada.map((ticket) => ticket.cupo), [50, 10]);
});
