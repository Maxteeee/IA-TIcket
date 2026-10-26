import test from 'node:test';
import assert from 'node:assert/strict';
import { createItemsRepository } from '../src/repositories/items.repository.js';

test('los datos duran durante la vida del repositorio y una nueva instancia empieza vacía', () => {
  const repository = createItemsRepository();
  const first = repository.create('Ejemplo');
  const second = repository.create('Otro ejemplo');

  assert.notEqual(first.id, second.id);
  assert.deepEqual(repository.findAll(), [first, second]);
  assert.deepEqual(createItemsRepository().findAll(), []);
});

test('los consumidores no pueden modificar los datos almacenados por referencia', () => {
  const repository = createItemsRepository();
  const created = repository.create('Original');
  created.name = 'Modificado';
  const result = repository.findAll();
  result[0].name = 'También modificado';
  result.push({ id: 'externo', name: 'Externo' });

  assert.equal(repository.findAll().length, 1);
  assert.equal(repository.findAll()[0].name, 'Original');
});
