import test from 'node:test';
import assert from 'node:assert/strict';
import { categories, initialEvents, initialFavoritesByUser, initialMessages, initialPurchases, organizers } from '../src/data/mockData.js';
import { authMock } from '../src/services/auth.mock.js';
import { selectSessionData } from '../src/session/permissions.js';

test('el frontend arranca sin eventos, compras, autores, reseñas, mensajes ni favoritos de ejemplo', () => {
  assert.deepEqual(initialEvents, []);
  assert.deepEqual(initialPurchases, []);
  assert.deepEqual(organizers, []);
  assert.deepEqual(initialMessages, {});
  assert.deepEqual(initialFavoritesByUser, {});
  assert.equal(categories.length, 6); // Todos y las cinco categorías base.
  for (const id of ['comprador-1', 'organizador-1']) {
    const data = selectSessionData(authMock.getSession(id), { events: initialEvents, purchases: initialPurchases, favoritesByUser: initialFavoritesByUser });
    assert.deepEqual(data, { purchases: [], sales: [], favoriteIds: [] });
  }
});
