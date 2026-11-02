import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '../src/repositories/index.js';
import { createServices } from '../src/services/index.js';
import { seedDemoData } from '../src/data/demo.js';
import { Evento } from '../src/domain/Evento.js';
import { Resenia } from '../src/domain/Resenia.js';
import { experienciaAnteriorDto } from '../src/http/presenters.js';

function scenario() {
  let now = new Date('2026-11-01T12:00:00Z');
  const repositories = seedDemoData(createRepositories(), { now: () => now });
  const services = createServices(repositories, { now: () => now });
  const base = repositories.eventos.findById('demo-concierto');
  const add = (id, fecha, fechaFin, organizador = base.organizador) => {
    const event = repositories.eventos.save(new Evento({ ...base, id, nombre: id,
      fecha: new Date(fecha), fechaFin: fechaFin ? new Date(fechaFin) : null, organizador }));
    const review = repositories.resenias.save(new Resenia({ id: `reseña-${id}`, evento: event,
      comprador: repositories.usuarios.findById('demo-asistente'), detalle: `Experiencia ${id}`, puntuacion: 0 }));
    return { event, review };
  };
  return { repositories, services, add, advance: (value) => { now = new Date(value); } };
}

test('C10: reúne reseñas de distintos eventos anteriores finalizados del mismo organizador', () => {
  const s = scenario();
  const target = s.add('publicación', '2026-10-25T20:00:00Z', '2026-10-25T22:00:00Z');
  const earlier = s.add('otra-categoría', '2026-10-20T20:00:00Z', '2026-10-20T22:00:00Z');
  earlier.event.categoria = s.repositories.categorias.findById('demo-categoria-2');
  s.add('posterior', '2026-10-28T20:00:00Z', '2026-10-28T22:00:00Z');
  s.add('simultáneo', '2026-10-25T20:00:00Z', '2026-10-25T22:00:00Z');
  s.add('sin-fin', '2026-10-20T20:00:00Z', null);
  s.add('en-curso', '2026-10-20T20:00:00Z', '2026-11-02T22:00:00Z');
  const reviews = s.services.eventos.previousReviews(target.event.id);
  assert.deepEqual(reviews.map((review) => review.id), ['demo-resenia-1', 'demo-resenia-2', earlier.review.id]);
  assert.equal(reviews.at(-1).puntuacion, 0);
  assert.ok(reviews.every((review) => review.evento.organizador === target.event.organizador));
  assert.equal(s.services.eventos.getReputation(target.event).cantidadResenias, 8);
});

test('C10: usa fechaFin explícita y el límite exacto del reloj; distingue vacío de evento inexistente', () => {
  const s = scenario();
  const past = s.repositories.eventos.findById('demo-pasado');
  const end = past.fechaFin.toISOString();
  s.advance(new Date(past.fechaFin.getTime() - 1).toISOString());
  assert.deepEqual(s.services.eventos.previousReviews('demo-concierto'), []);
  s.advance(end);
  assert.equal(s.services.eventos.previousReviews('demo-concierto').length, 2);
  past.fechaFin = null;
  assert.deepEqual(s.services.eventos.previousReviews('demo-concierto'), []);
  assert.deepEqual(s.services.eventos.previousReviews('demo-conferencia'), []);
  assert.throws(() => s.services.eventos.previousReviews('inexistente'), { status: 404 });
});

test('C10: presenter agrega autor y evento públicos sin serializar compras, roles ni el grafo', () => {
  const s = scenario();
  const review = s.services.eventos.previousReviews('demo-concierto')[0];
  const dto = experienciaAnteriorDto(review);
  assert.deepEqual(dto.comprador, { id: 'demo-asistente', nombre: 'Asistente', apellido: 'Demo' });
  assert.deepEqual(dto.evento, { id: review.evento.id, nombre: 'Noche de vinilos', organizadorId: 'demo-organizador',
    fecha: review.evento.fecha.toISOString(), fechaFin: review.evento.fechaFin.toISOString() });
  assert.equal(dto.detalle, review.detalle);
  assert.equal(dto.puntuacion, review.puntuacion);
  assert.equal(Object.hasOwn(dto, 'compra'), false);
  assert.equal(Object.hasOwn(dto.comprador, 'roles'), false);
  assert.doesNotThrow(() => JSON.stringify(dto));
});
