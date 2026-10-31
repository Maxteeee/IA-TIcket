import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/services/api.client.js';
import { createCatalogService, eventFromDto } from '../src/services/catalog.service.js';

const event = () => ({
  id: 'evento-api', nombre: 'Concierto', descripcion: 'Música en vivo',
  categoriaId: 'musica-api', categoria: { id: 'musica-api', nombre: 'Música' },
  organizadorId: 'organizador-api', organizador: { id: 'organizador-api', nombre: 'Ana', apellido: 'Pérez' },
  fecha: '2027-12-01T21:00:00Z', fechaFin: null, finalizado: false, multimedia: [],
  tiposEntrada: [{ id: 'general-api', nombre: 'General', descripcion: 'Acceso general', precio: 10, cupo: 5 }],
});
const response = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
});

test('C3: envía texto y categoría como filtros HTTP, preservando caracteres especiales', async () => {
  const calls = [];
  const service = createCatalogService({ get: async (path, options) => { calls.push({ path, options }); return []; } });
  const controller = new AbortController();
  await service.getEvents({ search: '  música + teatro & amigos  ', category: 'categoria & 1' }, { signal: controller.signal });
  const url = new URL(calls[0].path, 'http://local');
  assert.equal(url.pathname, '/eventos');
  assert.equal(url.searchParams.get('q'), 'música + teatro & amigos');
  assert.equal(url.searchParams.get('categoriaId'), 'categoria & 1');
  assert.equal(url.searchParams.has('orden'), false);
  assert.equal(calls[0].options.signal, controller.signal);
  await service.getEvents({ search: '  ', category: 'Todos' });
  assert.equal(calls[1].path, '/eventos');
});

test('C3: transforma los DTOs del servidor sin depender de nombres ni IDs de la maqueta', () => {
  const dto = event();
  const result = eventFromDto(dto);
  assert.equal(result.id, 'evento-api');
  assert.equal(result.categoria, 'Música');
  assert.equal(result.organizador.nombre, 'Ana Pérez');
  assert.equal(result.organizador.initials, 'AP');
  assert.equal(result.lugar, 'Lugar a confirmar');
  assert.equal(result.posterTitle, 'CONCIERTO');
  result.tiposEntrada[0].cupo = 0;
  assert.equal(dto.tiposEntrada[0].cupo, 5);
});

test('C3: valida el contrato y conserva resultados vacíos como vacíos, sin fixtures de respaldo', async () => {
  const empty = createCatalogService({ get: async () => [] });
  assert.deepEqual(await empty.getCategories(), []);
  assert.deepEqual(await empty.getEvents(), []);
  for (const bad of [null, {}, [null], [{ id: '1' }]]) {
    const service = createCatalogService({ get: async () => bad });
    await assert.rejects(service.getCategories(), { code: 'INVALID_RESPONSE' });
    await assert.rejects(service.getEvents(), { code: 'INVALID_RESPONSE' });
  }
  for (const changes of [{ tiposEntrada: [] }, { fecha: null }, { fecha: 'no-fecha' }, { organizador: null }]) {
    assert.throws(() => eventFromDto({ ...event(), ...changes }), { code: 'INVALID_RESPONSE' });
  }
});

test('C3: las categorías se obtienen de la API y el detalle codifica el identificador', async () => {
  const calls = [];
  const categories = [{ id: 'nueva', nombre: 'Cursos' }];
  const service = createCatalogService({ get: async (path) => { calls.push(path); return path === '/categorias' ? categories : event(); } });
  assert.deepEqual(await service.getCategories(), categories);
  await service.getEvent('evento/con espacio');
  assert.deepEqual(calls, ['/categorias', '/eventos/evento%2Fcon%20espacio']);
});

test('C3: cliente diferencia configuración, error HTTP, respuesta inválida y fallo de red', async () => {
  await assert.rejects(createApiClient({ baseUrl: '' }).get('/eventos'), { code: 'CONFIGURATION' });
  const failed = createApiClient({ baseUrl: 'http://local/api', fetchImpl: async () => response({ message: 'Categoría no encontrada' }, 404) });
  await assert.rejects(failed.get('/eventos'), { status: 404, message: 'Categoría no encontrada' });
  const html = createApiClient({ baseUrl: 'http://local/api', fetchImpl: async () => new Response('<html>') });
  await assert.rejects(html.get('/eventos'), { code: 'INVALID_RESPONSE' });
  const offline = createApiClient({ baseUrl: 'http://local/api', fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(offline.get('/eventos'), { code: 'NETWORK' });
});

function delayedFetch(_url, { signal }) {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
  });
}

test('C3: cancelar una búsqueda pendiente no se transforma en error de conexión', async () => {
  const controller = new AbortController();
  const client = createApiClient({ baseUrl: 'http://local/api', fetchImpl: delayedFetch });
  const result = client.get('/eventos?q=viejo', { signal: controller.signal });
  const rejection = assert.rejects(result, { name: 'AbortError' });
  controller.abort();
  await rejection;
  await assert.rejects(client.get('/eventos', { signal: controller.signal }), { name: 'AbortError' });
});

test('C3: una respuesta tardía que ignora AbortSignal también se descarta al cancelarla', async () => {
  let finish;
  const controller = new AbortController();
  const client = createApiClient({ baseUrl: 'http://local/api', fetchImpl: () => new Promise((resolve) => { finish = resolve; }) });
  const result = client.get('/eventos', { signal: controller.signal });
  const rejection = assert.rejects(result, { name: 'AbortError' });
  controller.abort();
  finish(response([event()]));
  await rejection;
});

test('C3: el timeout aborta la solicitud y permite reintentar con el mismo cliente', async () => {
  let attempts = 0;
  const client = createApiClient({ baseUrl: 'http://local/api', timeoutMs: 5,
    fetchImpl: (...args) => ++attempts === 1 ? delayedFetch(...args) : Promise.resolve(response([])) });
  await assert.rejects(client.get('/eventos'), { code: 'TIMEOUT' });
  assert.deepEqual(await client.get('/eventos'), []);
});
