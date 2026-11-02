import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewsService, prepareReview, reviewFromDto } from '../src/services/reviews.service.js';
import { purchaseFromDto } from '../src/services/purchases.service.js';
import { ApiError } from '../src/services/api.client.js';
import { authMock } from '../src/services/auth.mock.js';

const buyer = () => authMock.getSession('comprador-1');
const purchase = (id = 'compra-1') => ({ id, compradorId: 'comprador-1', eventoId: 'evento-1', tipoEntradaId: 'tipo-1', tipoEntradaNombre: 'General',
  precioUnitario: 10, cantidad: 1, total: 10, estado: 'UTILIZADA', diasRestantes: null, puedeCancelar: false, reembolso: null, puedeReseniar: true,
  evento: { id: 'evento-1', nombre: 'Reseñas C9', fecha: '2026-11-04T20:00:00Z', organizadorId: 'organizador-1' } });
const input = () => ({ puntuacion: '4,5', detalle: '  Muy buena experiencia  ' });
const dto = (changes = {}) => ({ id: 'resenia-1', compraId: 'compra-1', eventoId: 'evento-1', compradorId: 'comprador-1', puntuacion: 4.5, detalle: 'Muy buena experiencia', ...changes });

test('C9: puntuación numérica admite cero, cinco y fracciones con coma/punto y exige comentario', () => {
  assert.deepEqual(prepareReview(input()), { puntuacion: 4.5, detalle: 'Muy buena experiencia' });
  for (const puntuacion of [0, '0', '0,5', '0.5', 5, '5', 0.00000001]) assert.ok(prepareReview({ ...input(), puntuacion }).puntuacion >= 0);
  for (const puntuacion of ['', ' ', null, false, {}, -1, '5,1', NaN, Infinity]) assert.throws(() => prepareReview({ ...input(), puntuacion }), { status: 400 });
  for (const detalle of ['', ' ', null, 'a'.repeat(1501)]) assert.throws(() => prepareReview({ ...input(), detalle }), { status: 400 });
});

test('C9: carga compra propia y sus reseñas con señal, sin convertir datos vacíos en mocks', async () => {
  const calls = [];
  let reviews = [];
  const signal = new AbortController().signal;
  const service = createReviewsService({ get: async (path, options) => { calls.push({ path, options }); return path.startsWith('/compras/') ? purchase() : reviews; } });
  const result = await service.load('compra-1', buyer(), { signal });
  assert.equal(result.purchase.puedeReseniar, true);
  assert.deepEqual(result.reviews, []);
  assert.deepEqual(calls.map((call) => call.path), ['/compras/compra-1', '/resenias?compraId=compra-1']);
  assert.equal(calls[0].options.usuarioId, 'comprador-1');
  assert.ok(calls.every((call) => call.options.signal === signal));
  reviews = [dto()];
  assert.deepEqual((await service.load('compra-1', buyer())).reviews, reviews);
  for (const invalid of [[dto(), dto()], [dto({ compradorId: 'otra-persona' })], [dto({ compraId: 'otra-compra' })], [dto({ eventoId: 'otro-evento' })]]) {
    reviews = invalid;
    await assert.rejects(service.load('compra-1', buyer()), { code: 'INVALID_RESPONSE' });
  }
});

test('C9: contrato valida elegibilidad booleana del servidor y reseñas sin confundir cero con ausencia', () => {
  assert.equal(reviewFromDto(dto({ puntuacion: 0 })).puntuacion, 0);
  for (const changes of [{ puntuacion: 6 }, { detalle: '' }, { compraId: null }, { compradorId: '' }]) assert.throws(() => reviewFromDto(dto(changes)), { code: 'INVALID_RESPONSE' });
  for (const changes of [{ puedeReseniar: undefined }, { puedeReseniar: 'true' }, { estado: 'CONFIRMADA', diasRestantes: 0 }]) {
    assert.throws(() => purchaseFromDto({ ...purchase(), ...changes }), { code: 'INVALID_RESPONSE' });
  }
});

test('C9: publicaciones simultáneas comparten POST y solo envían compra, puntuación y comentario', async () => {
  let finish;
  let entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const calls = [];
  const service = createReviewsService({ get: async () => purchase(), post: (path, data, options) => {
    calls.push({ path, data, options }); entered(); return new Promise((resolve) => { finish = resolve; });
  } });
  const first = service.create('compra-1', input(), buyer());
  const second = service.create('compra-1', input(), buyer());
  await started;
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].data, { compraId: 'compra-1', puntuacion: 4.5, detalle: 'Muy buena experiencia' });
  assert.equal(calls[0].options.usuarioId, 'comprador-1');
  assert.match(calls[0].options.idempotencyKey, /^[a-zA-Z0-9-]{1,100}$/);
  finish(dto());
  assert.deepEqual(await first, await second);
  assert.equal(service.getPending('compra-1', buyer()), null);
});

test('C9: intento incierto conserva reseña y clave al volver, mientras error definitivo permite corregir', async () => {
  const keys = [];
  let fail = true;
  const service = createReviewsService({ get: async () => purchase(), post: async (_path, _data, options) => {
    keys.push(options.idempotencyKey);
    if (fail) throw new ApiError('Sin respuesta', { code: 'NETWORK' });
    return dto();
  } });
  await assert.rejects(service.create('compra-1', input(), buyer()), { code: 'NETWORK' });
  assert.deepEqual(service.getPending('compra-1', buyer()), prepareReview(input()));
  service.getPending('compra-1', buyer()).puntuacion = 0;
  assert.equal(service.getPending('compra-1', buyer()).puntuacion, 4.5);
  assert.equal(service.getPending('compra-1', authMock.getSession('organizador-1')), null);
  await assert.rejects(service.create('compra-1', { ...input(), puntuacion: 0 }, buyer()), { code: 'PENDING_REVIEW' });
  fail = false;
  await service.create('compra-1', service.getPending('compra-1', buyer()), buyer());
  assert.equal(keys[0], keys[1]);
  const rejected = createReviewsService({ get: async () => purchase(), post: async () => { throw new ApiError('No habilitada', { status: 409 }); } });
  await assert.rejects(rejected.create('compra-1', input(), buyer()), { status: 409 });
  assert.equal(rejected.getPending('compra-1', buyer()), null);
});

test('C9: rol o compra ajena bloquean publicación y respuesta de otro autor mantiene el intento incierto', async () => {
  let calls = 0;
  const service = createReviewsService({ get: async () => ({ ...purchase(), compradorId: 'otro' }), post: async () => { calls++; return dto(); } });
  await assert.rejects(service.load('compra-1', { ...buyer(), roles: ['ORGANIZADOR'] }), { status: 403 });
  await assert.rejects(service.create('compra-1', input(), buyer()), { status: 403 });
  assert.equal(calls, 0);
  const corrupt = createReviewsService({ get: async () => purchase(), post: async () => dto({ compradorId: 'otro' }) });
  await assert.rejects(corrupt.create('compra-1', input(), buyer()), { code: 'INVALID_RESPONSE' });
  assert.deepEqual(corrupt.getPending('compra-1', buyer()), prepareReview(input()));
});
