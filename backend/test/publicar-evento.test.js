import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '../src/repositories/index.js';
import { createServices } from '../src/services/index.js';
import { seedReferenceData } from '../src/data/reference.js';
import { Usuario } from '../src/domain/Usuario.js';
import { RolUsuario } from '../src/domain/RolUsuario.js';
import { usuarioDto } from '../src/http/presenters.js';

function scenario() {
  const repositories = seedReferenceData(createRepositories());
  const services = createServices(repositories, { now: () => new Date('2026-11-01T00:00:00Z') });
  const draft = { nombre: 'Festival', descripcion: 'Música para todos', fecha: '2026-12-01T21:00:00Z', categoriaId: 'demo-categoria-1',
    tiposEntrada: [{ nombre: 'General', precio: 1200.5, cupo: 50 }, { nombre: 'VIP', precio: 5000, cupo: 10 }] };
  return { repositories, services, draft };
}

test('C4: roles válidos y datos de referencia idempotentes, sin eventos precargados', () => {
  const s = scenario();
  const organizer = s.repositories.usuarios.findById('organizador-1');
  const buyer = s.repositories.usuarios.findById('comprador-1');
  assert.equal(organizer.tieneRol(RolUsuario.ORGANIZADOR), true);
  assert.equal(organizer.tieneRol(RolUsuario.COMPRADOR), true);
  assert.equal(buyer.tieneRol(RolUsuario.ORGANIZADOR), false);
  organizer.nombre = 'Nombre conservado';
  seedReferenceData(s.repositories);
  assert.equal(organizer.nombre, 'Nombre conservado');
  assert.equal(s.repositories.usuarios.findAll().length, 2);
  assert.equal(s.repositories.categorias.findAll().length, 5);
  assert.deepEqual(s.repositories.eventos.findAll(), []);
  assert.deepEqual(s.repositories.compras.findAll(), []);
  assert.deepEqual(s.repositories.resenias.findAll(), []);
  assert.deepEqual(buyer.favoritos, []);
  assert.deepEqual(organizer.favoritos, []);
  const roles = [RolUsuario.ORGANIZADOR, RolUsuario.ORGANIZADOR];
  const user = new Usuario({ nombre: 'Ana', apellido: 'Pérez', roles });
  roles.length = 0;
  assert.deepEqual(user.roles, [RolUsuario.ORGANIZADOR]);
  usuarioDto(user).roles.push(RolUsuario.COMPRADOR);
  assert.deepEqual(user.roles, [RolUsuario.ORGANIZADOR]);
  assert.throws(() => new Usuario({ roles: ['ADMIN'] }), { status: 400 });
});

test('C4: publicar exige rol en el servidor y los cuerpos públicos no permiten otorgarse roles', () => {
  const s = scenario();
  assert.throws(() => s.services.eventos.create(s.draft, 'comprador-1'), { status: 403 });
  assert.throws(() => s.services.eventos.create(s.draft), { status: 401 });
  assert.throws(() => s.services.eventos.create(s.draft, 'no-existe'), { status: 404 });
  assert.throws(() => s.services.usuarios.create({ nombre: 'A', apellido: 'B', roles: ['ORGANIZADOR'] }), { status: 400 });
  assert.throws(() => s.services.usuarios.update('comprador-1', { roles: ['ORGANIZADOR'] }, 'comprador-1'), { status: 400 });
  assert.deepEqual(s.repositories.eventos.findAll(), []);
  const event = s.services.eventos.create(s.draft, 'organizador-1');
  assert.equal(event.organizador, s.repositories.usuarios.findById('organizador-1'));
  assert.equal(new Set(event.tiposEntrada.map((ticket) => ticket.id)).size, 2);
});

test('C4: un segundo tipo inválido no persiste parcialmente el evento y permite corregirlo', () => {
  const s = scenario();
  for (const changes of [{ precio: -1 }, { precio: 1.123 }, { cupo: -1 }, { cupo: 1.5 }, { nombre: ' ' }]) {
    const invalid = { ...s.draft, tiposEntrada: [s.draft.tiposEntrada[0], { ...s.draft.tiposEntrada[1], ...changes }] };
    assert.throws(() => s.services.eventos.create(invalid, 'organizador-1', { idempotencyKey: 'corregible' }), { status: 400 });
    assert.deepEqual(s.repositories.eventos.findAll(), []);
  }
  assert.throws(() => s.services.eventos.create({ ...s.draft, tiposEntrada: [] }, 'organizador-1'), { status: 400 });
  assert.throws(() => s.services.eventos.create({ ...s.draft, organizadorId: 'comprador-1' }, 'organizador-1'), { status: 400 });
  const event = s.services.eventos.create(s.draft, 'organizador-1', { idempotencyKey: 'corregible' });
  assert.equal(event.tiposEntrada.length, 2);
  assert.equal(event.tiposEntrada[0].cupo, 50);
});

test('C4: los reintentos con la misma clave no duplican y la clave se limita al organizador', () => {
  const s = scenario();
  const options = { idempotencyKey: 'publicacion-1' };
  const first = s.services.eventos.create(s.draft, 'organizador-1', options);
  assert.equal(s.services.eventos.create(structuredClone(s.draft), 'organizador-1', options), first);
  assert.equal(s.repositories.eventos.findAll().length, 1);
  assert.throws(() => s.services.eventos.create({ ...s.draft, nombre: 'Otro' }, 'organizador-1', options), { status: 409 });
  assert.throws(() => s.services.eventos.create(s.draft, 'organizador-1', { idempotencyKey: 'inválida' }), { status: 400 });
  s.repositories.usuarios.save(new Usuario({ id: 'otro-org', nombre: 'Otro', apellido: 'Org', roles: [RolUsuario.ORGANIZADOR] }));
  const second = s.services.eventos.create(s.draft, 'otro-org', options);
  assert.notEqual(second.id, first.id);
  s.services.eventos.delete(first.id, 'organizador-1');
  assert.throws(() => s.services.eventos.create(s.draft, 'organizador-1', options), { status: 409 });
});
