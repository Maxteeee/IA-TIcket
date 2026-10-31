import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '../src/repositories/index.js';
import { seedDemoData } from '../src/data/demo.js';
import { createServices } from '../src/services/index.js';

test('el catálogo de prueba usa entidades del backend y no sobrescribe ni duplica datos al recargarlo', () => {
  const repositories = createRepositories();
  const clock = { now: () => new Date('2026-11-01T12:00:00Z') };
  seedDemoData(repositories, clock);
  const event = repositories.eventos.findById('demo-concierto');
  const originalDate = event.fecha;
  event.tiposEntrada[0].cupo = 1;
  event.nombre = 'Editado';
  seedDemoData(repositories, { now: () => new Date('2026-12-01T00:00:00Z') });
  assert.equal(repositories.eventos.findAll().length, 6);
  assert.equal(repositories.categorias.findAll().length, 5);
  assert.equal(repositories.usuarios.findAll().length, 1);
  assert.equal(repositories.eventos.findById(event.id), event);
  assert.equal(event.fecha, originalDate);
  assert.equal(event.nombre, 'Editado');
  assert.equal(event.tiposEntrada[0].cupo, 1);
  const services = createServices(repositories, clock);
  assert.equal(services.eventos.list().length, 5);
  assert.equal(services.eventos.list({ incluirPasados: 'true' }).length, 6);
  assert.deepEqual(createRepositories().eventos.findAll(), []);
});
