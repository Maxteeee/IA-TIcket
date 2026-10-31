import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '../src/repositories/index.js';
import { createServices } from '../src/services/index.js';
import { seedReferenceData } from '../src/data/reference.js';
import { Usuario } from '../src/domain/Usuario.js';
import { RolUsuario } from '../src/domain/RolUsuario.js';
import { ventasEventoDto } from '../src/http/presenters.js';

function scenario() {
  const now = () => new Date('2026-11-01T12:00:00Z');
  const repositories = seedReferenceData(createRepositories());
  repositories.usuarios.save(new Usuario({ id: 'otro-organizador', nombre: 'Otra', apellido: 'Persona', roles: [RolUsuario.ORGANIZADOR] }));
  const services = createServices(repositories, { now });
  const draft = { nombre: 'Encuentro C2', descripcion: 'Compras y disponibilidad', categoriaId: 'demo-categoria-1', fecha: '2026-12-01T20:00:00Z',
    tiposEntrada: [{ nombre: 'General', precio: 10, cupo: 3 }, { nombre: 'VIP', precio: 20, cupo: 2 }, { nombre: 'Sin cupo', precio: 0, cupo: 0 }] };
  const event = services.eventos.create(draft, 'organizador-1');
  return { repositories, services, event, draft, now };
}

test('C2: resumen sin compras conserva cada tipo y su disponibilidad, incluso cero, sin modificar el dominio', () => {
  const s = scenario();
  const result = ventasEventoDto(s.services.compras.salesSummary(s.event.id, 'organizador-1'), s.now());
  assert.deepEqual(result.compras, []);
  assert.deepEqual(result.evento.tiposEntrada.map((ticket) => ticket.cupo), [3, 2, 0]);
  assert.equal(result.evento.organizadorId, 'organizador-1');
  assert.doesNotThrow(() => JSON.stringify(result));
  result.evento.tiposEntrada[0].cupo = 999;
  assert.equal(s.event.tiposEntrada[0].cupo, 3);
  assert.equal(s.repositories.compras.findAll().length, 0);
});

test('C2: compras solo del evento elegido, comprador mínimo y precio/nombre históricos independientes del tipo actual', () => {
  const s = scenario();
  const input = { eventoId: s.event.id, tipoEntradaId: s.event.tiposEntrada[0].id, cantidad: 2 };
  const purchase = s.services.compras.create(input, 'comprador-1');
  const other = s.services.eventos.create(s.draft, 'organizador-1');
  s.services.compras.create({ eventoId: other.id, tipoEntradaId: other.tiposEntrada[0].id, cantidad: 1 }, 'comprador-1');
  s.services.eventos.updateTicket(s.event.id, input.tipoEntradaId, { nombre: 'General nueva', precio: 99 }, 'organizador-1');
  s.services.compras.updateState(purchase.id, { estado: 'CONFIRMADA' }, 'organizador-1');
  const result = ventasEventoDto(s.services.compras.salesSummary(s.event.id, 'organizador-1'), s.now());
  assert.deepEqual(result.compras.map((item) => item.id), [purchase.id]);
  assert.equal(result.compras[0].tipoEntradaNombre, 'General');
  assert.equal(result.compras[0].precioUnitario, 10);
  assert.equal(result.compras[0].total, 20);
  assert.equal(result.compras[0].estado, 'CONFIRMADA');
  assert.deepEqual(Object.keys(result.compras[0].comprador).sort(), ['apellido', 'id', 'nombre']);
  assert.equal(result.compras[0].comprador.id, 'comprador-1');
  assert.deepEqual(result.evento.tiposEntrada.map((ticket) => ticket.cupo), [1, 2, 0]);
  assert.equal(result.evento.tiposEntrada[0].precio, 99);
});

test('C2: resumen y listas de ventas exigen rol almacenado y propiedad, y no aceptan cambiar el evento por query', () => {
  const s = scenario();
  for (const id of ['comprador-1', 'otro-organizador']) {
    assert.throws(() => s.services.compras.salesSummary(s.event.id, id), { status: 403 });
    assert.throws(() => s.services.compras.list(id, { eventoId: s.event.id }), { status: 403 });
  }
  assert.throws(() => s.services.compras.salesSummary(s.event.id), { status: 401 });
  assert.throws(() => s.services.compras.salesSummary(s.event.id, 'inexistente'), { status: 404 });
  assert.throws(() => s.services.compras.salesSummary('inexistente', 'organizador-1'), { status: 404 });
  assert.throws(() => s.services.compras.salesSummary(s.event.id, 'organizador-1', { eventoId: 'otro' }), { status: 400 });
  s.event.organizador.roles = [RolUsuario.COMPRADOR];
  assert.throws(() => s.services.compras.salesSummary(s.event.id, 'organizador-1'), { status: 403 });
});
