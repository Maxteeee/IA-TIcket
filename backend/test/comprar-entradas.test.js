import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '../src/repositories/index.js';
import { createServices } from '../src/services/index.js';
import { seedReferenceData } from '../src/data/reference.js';
import { Usuario } from '../src/domain/Usuario.js';
import { RolUsuario } from '../src/domain/RolUsuario.js';
import { compraDto } from '../src/http/presenters.js';
import { Compra } from '../src/domain/Compra.js';

function scenario() {
  let instant = new Date('2026-11-01T00:00:00Z');
  const repositories = seedReferenceData(createRepositories());
  const services = createServices(repositories, { now: () => new Date(instant) });
  const event = services.eventos.create({ nombre: 'Concierto', descripcion: 'Música en vivo', categoriaId: 'demo-categoria-1', fecha: '2026-12-01T21:00:00Z',
    tiposEntrada: [{ nombre: 'General', precio: 10.25, cupo: 3 }, { nombre: 'VIP', precio: 20, cupo: 5 }] }, 'organizador-1');
  const input = { eventoId: event.id, tipoEntradaId: event.tiposEntrada[0].id, cantidad: 2, precioUnitarioEsperado: 10.25 };
  return { repositories, services, event, input, advance: (value) => { instant = new Date(value); } };
}

test('C12: compra pendiente reserva solo el tipo elegido, calcula total y registra al comprador real', () => {
  const s = scenario();
  const purchase = s.services.compras.create(s.input, 'comprador-1');
  assert.equal(purchase.estado, 'PENDIENTE');
  assert.equal(purchase.comprador.id, 'comprador-1');
  assert.equal(purchase.total, 20.5);
  assert.equal(purchase.precioUnitario, 10.25);
  assert.equal(purchase.tipoEntradaNombre, 'General');
  assert.deepEqual(s.event.tiposEntrada.map((ticket) => ticket.cupo), [1, 5]);
  assert.equal(purchase.historial.length, 1);
  assert.equal(purchase.historial[0].quien.id, 'comprador-1');
});

test('C12: cantidades inválidas, tipo ajeno y precios cambiados no dejan reservas ni compras parciales', () => {
  const s = scenario();
  for (const cantidad of [0, -1, 1.5, '2', 4, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => s.services.compras.create({ ...s.input, cantidad }, 'comprador-1'));
  }
  assert.throws(() => s.services.compras.create({ ...s.input, tipoEntradaId: 'ajeno' }, 'comprador-1'), { status: 404 });
  assert.throws(() => s.services.compras.create({ ...s.input, precioUnitarioEsperado: 0 }, 'comprador-1'), { status: 409 });
  for (const injected of [{ total: 0 }, { compradorId: 'organizador-1' }, { estado: 'CONFIRMADA' }]) {
    assert.throws(() => s.services.compras.create({ ...s.input, ...injected }, 'comprador-1'), { status: 400 });
  }
  assert.deepEqual(s.event.tiposEntrada.map((ticket) => ticket.cupo), [3, 5]);
  assert.deepEqual(s.repositories.compras.findAll(), []);
});

test('C12: clave idempotente conserva precio y nombre históricos aunque cambie el evento o ya haya comenzado', () => {
  const s = scenario();
  const options = { idempotencyKey: 'compra-1' };
  const first = s.services.compras.create(s.input, 'comprador-1', options);
  s.services.eventos.updateTicket(s.event.id, s.input.tipoEntradaId, { precio: 99, nombre: 'Renombrada', cupo: 0 }, 'organizador-1');
  s.advance('2026-12-02T00:00:00Z');
  assert.equal(s.services.compras.create({ ...s.input }, 'comprador-1', options), first);
  assert.equal(s.repositories.compras.findAll().length, 1);
  assert.equal(first.historial.length, 1);
  assert.equal(first.total, 20.5);
  assert.equal(compraDto(first).precioUnitario, 10.25);
  assert.equal(compraDto(first).tipoEntradaNombre, 'General');
  assert.equal(s.event.tiposEntrada[0].cupo, 0);
  assert.throws(() => s.services.compras.create({ ...s.input, cantidad: 1 }, 'comprador-1', options), { status: 409 });
});

test('C12: se comprueba rol almacenado y la clave no se consume cuando falla disponibilidad', () => {
  const s = scenario();
  s.repositories.usuarios.save(new Usuario({ id: 'solo-org', nombre: 'Solo', apellido: 'Organizador', roles: [RolUsuario.ORGANIZADOR] }));
  assert.throws(() => s.services.compras.create(s.input, 'solo-org'), { status: 403 });
  assert.throws(() => s.services.compras.create(s.input), { status: 401 });
  assert.throws(() => s.services.compras.create(s.input, 'comprador-1', { idempotencyKey: 'inválida' }), { status: 400 });
  const options = { idempotencyKey: 'corregir' };
  assert.throws(() => s.services.compras.create({ ...s.input, cantidad: 4 }, 'comprador-1', options), { status: 409 });
  const purchase = s.services.compras.create(s.input, 'comprador-1', options);
  assert.equal(purchase.cantidad, 2);
  assert.equal(s.event.tiposEntrada[0].cupo, 1);
});

test('C12: la misma clave de compradores distintos corresponde a compras independientes', () => {
  const s = scenario();
  s.repositories.usuarios.save(new Usuario({ id: 'otro', nombre: 'Otro', apellido: 'Comprador' }));
  const input = { ...s.input, cantidad: 1 };
  const first = s.services.compras.create(input, 'comprador-1', { idempotencyKey: 'igual' });
  const second = s.services.compras.create(input, 'otro', { idempotencyKey: 'igual' });
  assert.notEqual(first.id, second.id);
  assert.equal(s.event.tiposEntrada[0].cupo, 1);
  assert.throws(() => s.services.compras.get(second.id, 'comprador-1'), { status: 403 });
});

test('DD-07: ni dominio ni servicio crean autocompras, reservan cupo o consumen la clave de reintento', () => {
  const s = scenario();
  const owner = s.repositories.usuarios.findById('organizador-1');
  const options = { idempotencyKey: 'compra-personal' };
  assert.throws(() => new Compra({ comprador: owner, evento: s.event, tipoEntrada: s.event.tiposEntrada[0],
    cantidad: 1, total: 10.25, estado: 'PENDIENTE' }), { status: 409 });
  assert.throws(() => s.services.compras.create(s.input, owner.id, options), { status: 409 });
  assert.deepEqual(s.event.tiposEntrada.map((ticket) => ticket.cupo), [3, 5]);
  assert.deepEqual(s.repositories.compras.findAll(), []);
  const foreignOwner = s.repositories.usuarios.save(new Usuario({ nombre: 'Otro', apellido: 'Organizador', roles: [RolUsuario.ORGANIZADOR] }));
  const foreign = s.services.eventos.create({ nombre: 'Evento ajeno', descripcion: 'Compra personal', categoriaId: s.event.categoria.id,
    fecha: s.event.fecha.toISOString(), tiposEntrada: [{ nombre: 'General', precio: 10.25, cupo: 3 }] }, foreignOwner.id);
  const purchase = s.services.compras.create({ ...s.input, eventoId: foreign.id, tipoEntradaId: foreign.tiposEntrada[0].id }, owner.id, options);
  assert.equal(purchase.comprador, owner);
  assert.equal(purchase.evento, foreign);
});
