import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/services/api.client.js';
import { createCatalogService, eventFromDto, previousReviewFromDto } from '../src/services/catalog.service.js';
import { money, rating } from '../src/utils/mockPresentation.js';

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
  assert.equal(url.searchParams.get('orden'), 'fecha');
  assert.equal(calls[0].options.signal, controller.signal);
  await service.getEvents({ search: '  ', category: 'Todos' });
  assert.equal(calls[1].path, '/eventos?orden=fecha');
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

test('C11: envía el criterio junto al texto y categoría y conserva el orden recibido del servidor', async () => {
  const calls = [];
  const service = createCatalogService({ get: async (path) => {
    calls.push(path);
    return [{ ...event(), id: 'z' }, { ...event(), id: 'a' }];
  } });
  for (const sort of ['precio', 'fecha', 'puntaje']) {
    const result = await service.getEvents({ search: 'Música & amigos', category: 'categoria-real', sort });
    const query = new URL(calls.at(-1), 'http://local').searchParams;
    assert.equal(query.get('orden'), sort);
    assert.equal(query.get('q'), 'Música & amigos');
    assert.equal(query.get('categoriaId'), 'categoria-real');
    assert.deepEqual(result.map((item) => item.id), ['z', 'a']);
  }
});

test('C11: distingue promedio cero de ausencia y conserva puntaje/cantidad sin inventar reseñas', () => {
  for (const [puntaje, cantidadResenias] of [[0, 1], [4.5, 2], [null, 0]]) {
    const dto = event();
    Object.assign(dto.organizador, { puntaje, cantidadResenias });
    const organizer = eventFromDto(dto).organizador;
    assert.equal(rating(organizer), puntaje);
    assert.equal(organizer.cantidadResenias, cantidadResenias);
    assert.deepEqual(organizer.resenias, []);
  }
  for (const reputation of [{ puntaje: 6, cantidadResenias: 1 }, { puntaje: 0, cantidadResenias: 0 },
    { puntaje: null, cantidadResenias: 2 }, { puntaje: 4, cantidadResenias: -1 }]) {
    const dto = event();
    Object.assign(dto.organizador, reputation);
    assert.throws(() => eventFromDto(dto), { code: 'INVALID_RESPONSE' });
  }
  assert.equal(rating({ resenias: [{ puntuacion: 4 }, { puntuacion: 5 }] }), 4.5);
});

test('C11: los precios muestran centavos para distinguir importes próximos al ordenar', () => {
  assert.equal(money(10.25), '$10,25');
  assert.equal(money(10.5), '$10,5');
  assert.equal(money(5000), '$5.000');
  assert.equal(money(0), '$0');
});

const previousReview = () => ({ id: 'review-api', compradorId: 'autor-api', eventoId: 'pasado-api', compraId: 'compra-api',
  puntuacion: 0, detalle: 'Una experiencia real', comprador: { id: 'autor-api', nombre: 'Ana', apellido: 'Pérez' },
  evento: { id: 'pasado-api', nombre: 'Edición anterior', organizadorId: 'organizador-api',
    fecha: '2026-10-20T20:00:00Z', fechaFin: '2026-10-20T22:00:00Z' } });

test('C10: consulta pública codifica ID y conserva autor, evento, comentario, cero y fracciones', async () => {
  const calls = [];
  const service = createCatalogService({ get: async (path, options) => { calls.push({ path, options }); return [previousReview()]; } });
  const controller = new AbortController();
  const [result] = await service.getPreviousReviews('evento/con espacio', { signal: controller.signal });
  assert.equal(calls[0].path, '/eventos/evento%2Fcon%20espacio/experiencias-anteriores');
  assert.deepEqual(calls[0].options, { signal: controller.signal });
  assert.equal(result.autor, 'Ana Pérez');
  assert.equal(result.evento.nombre, 'Edición anterior');
  assert.equal(result.puntuacion, 0);
  assert.equal(result.detalle, 'Una experiencia real');
  assert.equal(previousReviewFromDto({ ...previousReview(), puntuacion: 4.5 }).puntuacion, 4.5);
  const dto = previousReview();
  previousReviewFromDto(dto).evento.nombre = 'Cambio local';
  assert.equal(dto.evento.nombre, 'Edición anterior');
});

test('C10: vacío no inventa reseñas y rechaza respuestas sin identidad, contenido o fechas válidas', async () => {
  assert.deepEqual(await createCatalogService({ get: async () => [] }).getPreviousReviews('evento'), []);
  for (const bad of [null, {}, [null], [{ id: 'x' }]]) {
    await assert.rejects(createCatalogService({ get: async () => bad }).getPreviousReviews('evento'), { code: 'INVALID_RESPONSE' });
  }
  for (const change of [{ puntuacion: 6 }, { puntuacion: -1 }, { puntuacion: '5' }, { detalle: ' ' },
    { compradorId: 'otro' }, { eventoId: 'otro' }, { comprador: null },
    { evento: { ...previousReview().evento, fecha: 'inválida' } },
    { evento: { ...previousReview().evento, fechaFin: null } }]) {
    assert.throws(() => previousReviewFromDto({ ...previousReview(), ...change }), { code: 'INVALID_RESPONSE' });
  }
});

test('C10: falla de reseñas conserva el error para reintentar sin datos de respaldo', async () => {
  let attempts = 0;
  const cause = new Error('Sin conexión');
  const service = createCatalogService({ get: async () => { if (++attempts === 1) throw cause; return [previousReview()]; } });
  await assert.rejects(service.getPreviousReviews('evento'), cause);
  assert.equal((await service.getPreviousReviews('evento')).length, 1);
});
