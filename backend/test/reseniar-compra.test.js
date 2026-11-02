import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '../src/repositories/index.js';
import { createServices } from '../src/services/index.js';
import { seedReferenceData } from '../src/data/reference.js';
import { Usuario } from '../src/domain/Usuario.js';
import { compraDto } from '../src/http/presenters.js';

function scenario() {
  let now = new Date('2026-11-02T12:00:00Z');
  const repositories = seedReferenceData(createRepositories());
  repositories.usuarios.save(new Usuario({ id: 'otra-persona', nombre: 'Otra', apellido: 'Persona' }));
  const services = createServices(repositories, { now: () => new Date(now) });
  const event = services.eventos.create({ nombre: 'Reseñas C9', descripcion: 'Experiencias de asistentes', categoriaId: 'demo-categoria-1',
    fecha: '2026-11-04T20:00:00Z', fechaFin: '2026-11-04T22:00:00Z', tiposEntrada: [{ nombre: 'General', precio: 10, cupo: 10 }] }, 'organizador-1');
  const buy = (buyer = 'comprador-1') => services.compras.create({ eventoId: event.id, tipoEntradaId: event.tiposEntrada[0].id, cantidad: 1 }, buyer);
  const purchase = buy();
  const finish = () => { purchase.estado = 'UTILIZADA'; now = new Date('2026-11-04T22:00:00Z'); };
  return { repositories, services, event, purchase, buy, finish, advance: (value) => { now = new Date(value); }, now: () => now };
}

test('C9: habilitación depende de utilización y finalización explícita con el reloj del servidor', () => {
  const s = scenario();
  s.advance('2026-11-05T00:00:00Z');
  for (const estado of ['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'REEMBOLSADA']) {
    s.purchase.estado = estado;
    assert.equal(compraDto(s.purchase, s.now()).puedeReseniar, false);
  }
  s.purchase.estado = 'UTILIZADA';
  s.advance('2026-11-04T21:59:59Z');
  assert.equal(compraDto(s.purchase, s.now()).puedeReseniar, false);
  s.advance('2026-11-04T22:00:00Z');
  assert.equal(compraDto(s.purchase, s.now()).puedeReseniar, true);
  s.event.fechaFin = null;
  assert.equal(compraDto(s.purchase, s.now()).puedeReseniar, false);
});

test('C9: guarda puntuación cero y comentario del comprador sin alterar compra, cupo ni historial', () => {
  const s = scenario(); s.finish();
  const before = { cupo: s.event.tiposEntrada[0].cupo, historial: s.purchase.historial.length, total: s.purchase.total };
  const review = s.services.resenias.create({ compraId: s.purchase.id, puntuacion: 0, detalle: '  Mi experiencia\ncon el evento  ' }, 'comprador-1');
  assert.equal(review.compra, s.purchase);
  assert.equal(review.evento, s.event);
  assert.equal(review.comprador.id, 'comprador-1');
  assert.equal(review.puntuacion, 0);
  assert.equal(review.detalle, 'Mi experiencia\ncon el evento');
  assert.equal(s.purchase.estado, 'UTILIZADA');
  assert.deepEqual({ cupo: s.event.tiposEntrada[0].cupo, historial: s.purchase.historial.length, total: s.purchase.total }, before);
});

test('C9: rechaza autor ajeno, rol almacenado, falta de asistencia y contenido inválido sin guardados parciales', () => {
  const s = scenario();
  const data = { compraId: s.purchase.id, puntuacion: 4.5, detalle: 'Comentario' };
  assert.throws(() => s.services.resenias.create(data, 'comprador-1'), { status: 409 });
  s.finish();
  for (const actor of ['otra-persona', 'organizador-1']) assert.throws(() => s.services.resenias.create(data, actor), { status: 403 });
  assert.throws(() => s.services.resenias.create(data), { status: 401 });
  for (const changes of [{ puntuacion: -1 }, { puntuacion: 5.1 }, { puntuacion: '5' }, { detalle: '' }, { detalle: 'x'.repeat(1501) }, { compradorId: 'otro' }, { eventoId: s.event.id }]) {
    assert.throws(() => s.services.resenias.create({ ...data, ...changes }, 'comprador-1'), { status: 400 });
  }
  s.purchase.comprador.roles = ['ORGANIZADOR'];
  assert.throws(() => s.services.resenias.create(data, 'comprador-1'), { status: 403 });
  assert.deepEqual(s.repositories.resenias.findAll(), []);
});

test('C9: reintento idempotente recupera la reseña sin duplicarla y rechaza cambiar contenido o resucitar una borrada', () => {
  const s = scenario(); s.finish();
  const data = { compraId: s.purchase.id, puntuacion: 4.5, detalle: 'Comentario' };
  const options = { idempotencyKey: 'resenia-1' };
  const first = s.services.resenias.create(data, 'comprador-1', options);
  assert.equal(s.services.resenias.create({ ...data, detalle: ' Comentario ' }, 'comprador-1', options), first);
  assert.equal(s.repositories.resenias.findAll().length, 1);
  assert.throws(() => s.services.resenias.create({ ...data, puntuacion: 5 }, 'comprador-1', options), { status: 409 });
  s.services.resenias.delete(first.id, 'comprador-1');
  assert.throws(() => s.services.resenias.create(data, 'comprador-1', options), { status: 409 });
});

test('C9: consulta por compra conserva filtros existentes y no mezcla reseñas de otras compras', () => {
  const s = scenario();
  const otherPurchase = s.buy('otra-persona'); otherPurchase.estado = 'UTILIZADA';
  s.finish();
  const own = s.services.resenias.create({ compraId: s.purchase.id, puntuacion: 5, detalle: 'Propia' }, 'comprador-1');
  s.services.resenias.create({ compraId: otherPurchase.id, puntuacion: 2, detalle: 'Ajena' }, 'otra-persona');
  assert.deepEqual(s.services.resenias.list({ compraId: s.purchase.id }), [own]);
  assert.deepEqual(s.services.resenias.list({ compraId: s.purchase.id, eventoId: s.event.id, organizadorId: 'organizador-1' }), [own]);
  assert.throws(() => s.services.resenias.list({ compraId: 'inexistente' }), { status: 404 });
});
