import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '../src/repositories/index.js';
import { createServices } from '../src/services/index.js';
import { compraDto, eventoDto } from '../src/http/presenters.js';
import { Usuario } from '../src/domain/Usuario.js';
import { RolUsuario } from '../src/domain/RolUsuario.js';

function scenario({ cupo = 5, precio = 10.25 } = {}) {
  let instant = new Date('2026-11-01T12:00:00Z');
  const now = () => new Date(instant);
  const repositories = createRepositories();
  const services = createServices(repositories, { now });
  const organizador = repositories.usuarios.save(new Usuario({ nombre: 'Ana', apellido: 'Pérez', roles: [RolUsuario.ORGANIZADOR] }));
  const comprador = services.usuarios.create({ nombre: 'Luis', apellido: 'Gómez' });
  const tercero = repositories.usuarios.save(new Usuario({ nombre: 'Luis', apellido: 'Gómez', roles: [RolUsuario.ORGANIZADOR] }));
  const categoria = services.categorias.create({ nombre: 'Música' });
  const draft = {
    nombre: 'Concierto', descripcion: 'Canciones en vivo', categoriaId: categoria.id,
    fecha: '2026-11-03T20:00:00Z', fechaFin: '2026-11-03T23:00:00Z',
    tiposEntrada: [{ nombre: 'General', precio, cupo }],
  };
  const evento = services.eventos.create(draft, organizador.id);
  const input = { eventoId: evento.id, tipoEntradaId: evento.tiposEntrada[0].id, cantidad: 2 };
  const buy = (changes = {}) => services.compras.create({ ...input, ...changes }, comprador.id);
  return { repositories, services, organizador, comprador, tercero, categoria, draft, evento, input, buy, now,
    advance: (value) => { instant = new Date(value); } };
}

test('comprar reserva exactamente una vez, calcula el total y registra estado/autor/fecha', () => {
  const s = scenario();
  const compra = s.buy();
  assert.equal(compra.total, 20.5);
  assert.equal(compra.estado, 'PENDIENTE');
  assert.equal(s.evento.tiposEntrada[0].cupo, 3);
  assert.equal(compra.tipoEntrada, s.evento.tiposEntrada[0]);
  assert.equal(compra.comprador, s.comprador);
  assert.equal(compra.historial[0].compra, compra);
  assert.equal(compra.historial[0].quien, s.comprador);
  assert.deepEqual(compra.historial[0].fechaHora, s.now());

  s.services.compras.updateState(compra.id, { estado: 'CONFIRMADA' }, s.organizador.id);
  s.services.compras.updateState(compra.id, { estado: 'UTILIZADA' }, s.organizador.id);
  assert.equal(s.evento.tiposEntrada[0].cupo, 3);
  assert.deepEqual(compra.historial.map((cambio) => cambio.estado), ['PENDIENTE', 'CONFIRMADA', 'UTILIZADA']);
});

test('cupos insuficientes y datos inválidos no dejan compras ni movimientos parciales', () => {
  const s = scenario();
  for (const cantidad of [0, -1, 1.5, '2', null, 6]) {
    assert.throws(() => s.buy({ cantidad }));
    assert.equal(s.evento.tiposEntrada[0].cupo, 5);
    assert.equal(s.repositories.compras.findAll().length, 0);
  }
  for (const extra of [{ total: 0 }, { estado: 'UTILIZADA' }, { compradorId: s.tercero.id }]) {
    assert.throws(() => s.buy(extra), { status: 400 });
  }
  const otro = s.services.eventos.create(s.draft, s.organizador.id);
  assert.throws(() => s.buy({ tipoEntradaId: otro.tiposEntrada[0].id }), { status: 404 });
  s.advance(s.evento.fecha);
  assert.throws(() => s.buy(), { status: 409 });
  assert.equal(s.evento.tiposEntrada[0].cupo, 5);
});

test('el precio original de una compra se conserva al cambiar el precio de la entrada', () => {
  const s = scenario({ precio: 0.1 });
  const compra = s.buy({ cantidad: 3 });
  s.services.eventos.updateTicket(s.evento.id, compra.tipoEntrada.id, { precio: 9.99 }, s.organizador.id);
  assert.equal(compra.total, 0.3);
  assert.equal(s.buy({ cantidad: 1 }).total, 9.99);
});

test('solo el organizador cambia estados y las repeticiones no alteran cupos ni historial', () => {
  const s = scenario();
  const compra = s.buy();
  assert.throws(() => s.services.compras.updateState(compra.id, { estado: 'CONFIRMADA' }, s.comprador.id), { status: 403 });
  assert.throws(() => s.services.compras.updateState(compra.id, { estado: 'UTILIZADA' }, s.organizador.id), { status: 409 });
  s.services.compras.updateState(compra.id, { estado: 'CONFIRMADA' }, s.organizador.id);
  for (const estado of ['CONFIRMADA', 'PENDIENTE', 'CANCELADA', 'REEMBOLSADA']) {
    assert.throws(() => s.services.compras.updateState(compra.id, { estado }, s.organizador.id), { status: 409 });
  }
  assert.equal(compra.historial.length, 2);
  assert.equal(compra.estado, 'CONFIRMADA');
  assert.equal(s.evento.tiposEntrada[0].cupo, 3);
});

test('compras y ventas se consultan desde la perspectiva de su participante', () => {
  const s = scenario();
  const compra = s.buy();
  assert.deepEqual(s.services.compras.list(s.comprador.id), [compra]);
  assert.throws(() => s.services.compras.list(s.tercero.id), { status: 403 });
  assert.throws(() => s.services.compras.list(s.organizador.id), { status: 403 });
  assert.deepEqual(s.services.compras.list(s.organizador.id, { eventoId: s.evento.id }), [compra]);
  assert.throws(() => s.services.compras.list(s.comprador.id, { eventoId: s.evento.id }), { status: 403 });
  assert.throws(() => s.services.compras.get(compra.id, s.tercero.id), { status: 403 });
  assert.throws(() => s.services.compras.list(), { status: 401 });
});

test('el chat persiste orden y fecha, valida participantes y permanece disponible tras el evento', () => {
  const s = scenario();
  const compra = s.buy();
  s.services.compras.addMessage(compra.id, { mensaje: ' Hola ' }, s.comprador.id);
  s.advance('2026-11-10T00:00:00Z');
  s.services.compras.addMessage(compra.id, { mensaje: '¡Hola!' }, s.organizador.id);
  assert.deepEqual(s.services.compras.listMessages(compra.id, s.comprador.id).map((m) => m.mensaje), ['Hola', '¡Hola!']);
  assert.throws(() => s.services.compras.addMessage(compra.id, { mensaje: 'Intruso' }, s.tercero.id), { status: 403 });
  assert.throws(() => s.services.compras.listMessages(compra.id, s.tercero.id), { status: 403 });
  assert.throws(() => s.services.compras.listHistory(compra.id, s.tercero.id), { status: 403 });
  assert.throws(() => s.services.compras.addMessage(compra.id, { mensaje: ' ' }, s.comprador.id), { status: 400 });
});

test('reseñar requiere ser comprador, compra utilizada y finalización explícita del evento', () => {
  const s = scenario();
  const compra = s.buy();
  const data = { compraId: compra.id, detalle: 'Buen evento', puntuacion: 0 };
  assert.throws(() => s.services.resenias.create(data, s.tercero.id), { status: 403 });
  assert.throws(() => s.services.resenias.create(data, s.comprador.id), { status: 409 });
  s.services.compras.updateState(compra.id, { estado: 'CONFIRMADA' }, s.organizador.id);
  s.services.compras.updateState(compra.id, { estado: 'UTILIZADA' }, s.organizador.id);
  assert.throws(() => s.services.resenias.create(data, s.comprador.id), { status: 409 });
  s.advance('2026-11-04T00:00:00Z');
  s.services.eventos.update(s.evento.id, { fechaFin: null }, s.organizador.id);
  assert.throws(() => s.services.resenias.create(data, s.comprador.id), { status: 409 });
  s.services.eventos.update(s.evento.id, { fechaFin: '2026-11-03T23:00:00Z' }, s.organizador.id);
  const resenia = s.services.resenias.create(data, s.comprador.id);
  assert.equal(resenia.evento, s.evento);
  assert.equal(resenia.compra, compra);
  assert.deepEqual(s.services.usuarios.reputation(s.organizador.id), { usuarioId: s.organizador.id, cantidad: 1, puntaje: 0 });
  assert.equal(s.services.usuarios.reputation(s.tercero.id).puntaje, null);
  assert.throws(() => s.services.resenias.update(resenia.id, { puntuacion: 6 }, s.comprador.id), { status: 400 });
  assert.equal(resenia.puntuacion, 0);
  assert.throws(() => s.services.resenias.delete(resenia.id, s.organizador.id), { status: 403 });
  s.services.resenias.update(resenia.id, { puntuacion: 4.5 }, s.comprador.id);
  assert.equal(s.services.usuarios.reputation(s.organizador.id).puntaje, 4.5);
  s.services.resenias.delete(resenia.id, s.comprador.id);
  assert.equal(s.services.usuarios.reputation(s.organizador.id).puntaje, null);
});

test('el catálogo busca sin acentos, filtra y ordena por fecha, mínimo de precio y reputación', () => {
  const s = scenario();
  const barato = s.services.eventos.create({ ...s.draft, nombre: 'Festival económico',
    fecha: '2026-11-04T20:00:00Z', fechaFin: null,
    tiposEntrada: [{ nombre: 'General', precio: 1, cupo: 0 }, { nombre: 'VIP', precio: 100, cupo: 5 }] }, s.tercero.id);
  assert.deepEqual(s.services.eventos.list({ q: 'economico' }), [barato]);
  assert.deepEqual(s.services.eventos.list({ categoriaId: s.categoria.id, orden: 'precio' }), [barato, s.evento]);
  assert.deepEqual(barato.rangoPrecios(), { min: 1, max: 100 });
  assert.deepEqual(s.services.eventos.list({ organizadorId: s.organizador.id }), [s.evento]);
  assert.throws(() => s.services.eventos.list({ orden: 'cualquiera' }), { status: 400 });
  assert.throws(() => s.services.eventos.list({ q: ['a', 'b'] }), { status: 400 });
  s.advance('2026-11-04T21:00:00Z');
  assert.deepEqual(s.services.eventos.list(), []);
  assert.equal(s.services.eventos.list({ incluirPasados: 'true' }).length, 2);
});

test('el orden por reputación distingue cero de ausencia y las experiencias pertenecen a eventos anteriores', () => {
  const s = scenario();
  const compra = s.buy();
  s.services.compras.updateState(compra.id, { estado: 'CONFIRMADA' }, s.organizador.id);
  s.services.compras.updateState(compra.id, { estado: 'UTILIZADA' }, s.organizador.id);
  s.advance('2026-11-04T00:00:00Z');
  const review = s.services.resenias.create({ compraId: compra.id, puntuacion: 0, detalle: 'Mala experiencia' }, s.comprador.id);
  const futuro = { ...s.draft, fecha: '2026-11-05T20:00:00Z', fechaFin: null };
  const sinResenias = s.services.eventos.create(futuro, s.tercero.id);
  const propio = s.services.eventos.create({ ...futuro, fecha: '2026-11-06T20:00:00Z' }, s.organizador.id);
  assert.deepEqual(s.services.eventos.list({ orden: 'puntaje' }), [propio, sinResenias]);
  assert.deepEqual(s.services.eventos.previousReviews(propio.id), [review]);
  assert.deepEqual(s.services.eventos.previousReviews(sinResenias.id), []);
});

test('ediciones inválidas no modifican parcialmente un agregado ni sus relaciones', () => {
  const s = scenario();
  assert.throws(() => s.services.eventos.update(s.evento.id,
    { nombre: 'Cambiado', fechaFin: '2026-11-02T00:00:00Z' }, s.organizador.id), { status: 400 });
  assert.equal(s.evento.nombre, 'Concierto');
  assert.throws(() => s.services.eventos.updateTicket(s.evento.id, s.input.tipoEntradaId,
    { nombre: 'Cambiado', precio: -1 }, s.organizador.id), { status: 400 });
  assert.equal(s.evento.tiposEntrada[0].nombre, 'General');
  assert.throws(() => s.services.eventos.deleteTicket(s.evento.id, s.input.tipoEntradaId, s.organizador.id), { status: 409 });
  assert.throws(() => s.services.eventos.create({ ...s.draft, fecha: '2026-02-30T00:00:00Z' }, s.organizador.id), { status: 400 });
  assert.throws(() => s.services.eventos.create({ ...s.draft, tiposEntrada: [] }, s.organizador.id), { status: 400 });
  assert.throws(() => s.services.eventos.update(s.evento.id, { organizadorId: s.tercero.id }, s.organizador.id), { status: 400 });
});

test('borrados y reprogramación protegen compras, mientras los favoritos son idempotentes y se limpian al borrar', () => {
  const s = scenario();
  s.services.usuarios.addFavorite(s.comprador.id, s.evento.id, s.comprador.id);
  s.services.usuarios.addFavorite(s.comprador.id, s.evento.id, s.comprador.id);
  assert.equal(s.services.usuarios.listFavorites(s.comprador.id, s.comprador.id).length, 1);
  assert.throws(() => s.services.usuarios.listFavorites(s.comprador.id, s.tercero.id), { status: 403 });
  s.buy();
  assert.throws(() => s.services.eventos.delete(s.evento.id, s.organizador.id), { status: 409 });
  assert.throws(() => s.services.usuarios.delete(s.comprador.id, s.comprador.id), { status: 409 });
  assert.throws(() => s.services.usuarios.delete(s.organizador.id, s.organizador.id), { status: 409 });
  assert.throws(() => s.services.categorias.delete(s.categoria.id), { status: 409 });
  assert.throws(() => s.services.eventos.update(s.evento.id, { fecha: '2026-11-10T20:00:00Z', fechaFin: null }, s.organizador.id), { status: 409 });
  const otro = s.services.eventos.create(s.draft, s.organizador.id);
  s.services.usuarios.addFavorite(s.comprador.id, otro.id, s.comprador.id);
  s.services.eventos.delete(otro.id, s.organizador.id);
  assert.deepEqual(s.comprador.favoritos, [s.evento]);
});

test('DTOs no exponen referencias mutables ni ciclos, y los días son derivados', () => {
  const s = scenario();
  const compra = s.buy();
  assert.doesNotThrow(() => JSON.stringify(compraDto(compra, s.now())));
  assert.doesNotThrow(() => JSON.stringify(eventoDto(s.evento, s.now())));
  const dto = eventoDto(s.evento, s.now());
  dto.tiposEntrada[0].cupo = 999;
  dto.multimedia.push('externo');
  assert.equal(s.evento.tiposEntrada[0].cupo, 3);
  assert.deepEqual(s.evento.multimedia, []);
  assert.equal(compraDto(compra, s.now()).diasRestantes, null);
  s.services.compras.updateState(compra.id, { estado: 'CONFIRMADA' }, s.organizador.id);
  assert.equal(compraDto(compra, s.now()).diasRestantes, 3);
  s.advance('2026-11-04T00:00:00Z');
  assert.equal(compraDto(compra, s.now()).diasRestantes, 0);
});

test('instancias nuevas de repositorios empiezan vacías y no comparten agregados', () => {
  const s = scenario();
  s.buy();
  const other = createRepositories();
  assert.deepEqual(other.eventos.findAll(), []);
  assert.deepEqual(other.compras.findAll(), []);
  assert.deepEqual(other.usuarios.findAll(), []);
  assert.equal(s.repositories.compras.findAll().length, 1);
});
