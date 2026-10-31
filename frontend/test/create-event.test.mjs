import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareEventDraft, createPublicationKey } from '../src/utils/eventDraft.js';
import { createApiClient } from '../src/services/api.client.js';
import { createEventsService } from '../src/services/events.service.js';
import { authMock } from '../src/services/auth.mock.js';

const now = new Date('2026-11-01T00:00:00Z');
const form = () => ({ name: ' Concierto ', description: ' Música en vivo ', date: '01/12/2026', time: '20:30', categoryId: 'categoria-real', tickets: [
  { id: 'draft-1', nombre: ' General ', descripcion: ' Acceso general ', precio: '1200,50', cupo: '50' },
  { id: 'draft-2', nombre: 'VIP', descripcion: '', precio: '5000', cupo: '10' },
] });

test('C4: prepara múltiples tipos con decimales, fecha/hora local e IDs solo de categoría', () => {
  const data = form();
  const original = structuredClone(data);
  const result = prepareEventDraft(data, now);
  assert.equal(result.nombre, 'Concierto');
  assert.equal(result.descripcion, 'Música en vivo');
  assert.equal(result.categoriaId, 'categoria-real');
  assert.equal(result.fecha, new Date(2026, 11, 1, 20, 30).toISOString());
  assert.deepEqual(result.tiposEntrada, [
    { nombre: 'General', descripcion: 'Acceso general', precio: 1200.5, cupo: 50 },
    { nombre: 'VIP', descripcion: '', precio: 5000, cupo: 10 },
  ]);
  assert.deepEqual(data, original);
  assert.equal(Object.hasOwn(result, 'organizadorId'), false);
});

test('C4: rechaza fechas imposibles, pasadas, horas inválidas y campos obligatorios incompletos', () => {
  for (const changes of [{ date: '30/02/2027' }, { date: '01/01/2020' }, { date: '2027-12-01' },
    { time: '24:00' }, { time: '12:60' }, { time: '' }, { name: ' ' }, { description: '' }, { categoryId: '' }, { tickets: [] }]) {
    assert.throws(() => prepareEventDraft({ ...form(), ...changes }, now));
  }
});

test('C4: valida cada precio y cupo antes de enviar y permite valores cero compatibles con el backend', () => {
  for (const precio of ['', '-1', '1.123', '1e3', 'NaN', '1,234.50', '900719925474100']) {
    const data = form(); data.tickets[1].precio = precio;
    assert.throws(() => prepareEventDraft(data, now));
  }
  for (const cupo of ['', '-1', '1.5', '1e3', 'NaN', '9007199254740992']) {
    const data = form(); data.tickets[1].cupo = cupo;
    assert.throws(() => prepareEventDraft(data, now));
  }
  const data = form(); data.tickets[0].precio = '0'; data.tickets[0].cupo = '0';
  assert.equal(prepareEventDraft(data, now).tiposEntrada[0].precio, 0);
  assert.equal(prepareEventDraft(data, now).tiposEntrada[0].cupo, 0);
  data.tickets[1].nombre = ' ';
  assert.throws(() => prepareEventDraft(data, now));
});

test('C4: las claves de publicación son aptas para el encabezado y distintas para cada borrador', () => {
  const first = createPublicationKey();
  assert.match(first, /^[a-zA-Z0-9-]{1,100}$/);
  assert.notEqual(first, createPublicationKey());
});

test('C4: comprador no puede invocar publicación ni lista propia desde el servicio del frontend', async () => {
  let calls = 0;
  const service = createEventsService({ post: async () => { calls++; }, get: async () => { calls++; } });
  const buyer = authMock.getSession('comprador-1');
  await assert.rejects(service.create(prepareEventDraft(form(), now), buyer), { status: 403 });
  await assert.rejects(service.listOwn(buyer), { status: 403 });
  assert.equal(calls, 0);
});

test('C4: el cliente envía POST JSON, identidad y clave de reintento sin mezclar los encabezados del catálogo', async () => {
  const calls = [];
  const client = createApiClient({ baseUrl: 'http://local/api', fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response('{}', { status: 201 });
  } });
  const draft = prepareEventDraft(form(), now);
  await client.post('/eventos', draft, { usuarioId: 'organizador-1', idempotencyKey: 'evento-1' });
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].options.headers['X-Usuario-Id'], 'organizador-1');
  assert.equal(calls[0].options.headers['Idempotency-Key'], 'evento-1');
  assert.deepEqual(JSON.parse(calls[0].options.body), draft);
  await client.get('/eventos');
  assert.equal(calls[1].options.headers['X-Usuario-Id'], undefined);
  assert.equal(calls[1].options.headers['Idempotency-Key'], undefined);
  assert.equal(calls[1].options.body, undefined);
});

test('C4: la lista propia conserva el filtro de identidad y rechaza datos de otro organizador', async () => {
  const calls = [];
  const session = authMock.getSession('organizador-1');
  const service = createEventsService({ get: async (path) => { calls.push(path); return []; } });
  assert.deepEqual(await service.listOwn(session), []);
  const query = new URL(calls[0], 'http://local').searchParams;
  assert.equal(query.get('organizadorId'), session.usuario.id);
  assert.equal(query.get('incluirPasados'), 'true');
  const broken = createEventsService({ get: async () => [{ organizadorId: 'otro' }] });
  await assert.rejects(broken.listOwn(session), { code: 'INVALID_RESPONSE' });
  const wrongOwner = createEventsService({ post: async () => ({ id: 'event', nombre: 'Evento', descripcion: 'Detalle',
    fecha: '2026-12-01T21:00:00Z', categoriaId: 'cat', categoria: { nombre: 'Música' }, organizadorId: 'otro', organizador: { nombre: 'Otro' },
    tiposEntrada: [{ id: 'type', nombre: 'General', precio: 100, cupo: 1 }] }) });
  await assert.rejects(wrongOwner.create(prepareEventDraft(form(), now), session), { code: 'INVALID_RESPONSE' });
});
