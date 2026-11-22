import test from 'node:test';
import assert from 'node:assert/strict';
import { authMock } from '../src/services/auth.mock.js';
import { RolUsuario } from '../src/session/roles.js';
import { canAccessPurchase, canAccessRoute, canManageEvent, canOrganize, canPurchase, canReviewPurchase, hasRole, selectSessionData } from '../src/session/permissions.js';
import { initialEvents, initialFavoritesByUser, initialMessages, initialPurchases, organizers } from './fixtures/mockData.js';

const buyer = () => authMock.getSession('comprador-1');
const organizer = () => authMock.getSession('organizador-1');
const state = () => ({ events: structuredClone(initialEvents), purchases: structuredClone(initialPurchases), favoritesByUser: structuredClone(initialFavoritesByUser) });
const ownEvent = initialEvents.find((event) => event.id === 'umbral');
const otherEvent = initialEvents.find((event) => event.id === 'after');
const sharedPurchase = initialPurchases.find((purchase) => purchase.id === 'AT-3001');

test('las sesiones alternan con identidades distintas y el organizador conserva la capacidad de comprar', () => {
  const first = authMock.getSession();
  const second = authMock.getNextSession(first.usuario.id);
  assert.equal(first.usuario.nombre, 'Comprador 1');
  assert.equal(second.usuario.nombre, 'Organizador 1');
  assert.deepEqual(authMock.getNextSession(second.usuario.id), first);
  assert.equal(canOrganize(first), false);
  assert.equal(canOrganize(second), true);
  assert.equal(hasRole(second, RolUsuario.COMPRADOR), true);
  assert.throws(() => authMock.getSession('no-existe'));
  assert.throws(() => authMock.getNextSession('no-existe'));
});

test('las respuestas del auth mock no comparten objetos mutables entre perfiles ni solicitudes', () => {
  const session = buyer();
  session.usuario.nombre = 'Otro nombre';
  session.roles.push(RolUsuario.ORGANIZADOR);
  assert.equal(buyer().usuario.nombre, 'Comprador 1');
  assert.equal(canOrganize(buyer()), false);
  assert.equal(organizer().usuario.nombre, 'Organizador 1');
});

test('el catálogo conectado admite perfiles compradores y conserva separados los detalles de la maqueta', () => {
  const destination = { name: 'catalogEvent', eventId: 'id-real-del-backend' };
  assert.equal(canAccessRoute(buyer(), destination, state()), true);
  assert.equal(canAccessRoute(organizer(), destination, state()), true);
  assert.equal(canAccessRoute({ usuario: organizer().usuario, roles: [RolUsuario.ORGANIZADOR] }, destination, state()), false);
  assert.equal(canAccessRoute(buyer(), { ...destination, eventId: '' }, state()), false);
  assert.equal(canAccessRoute(buyer(), { name: 'event', eventId: destination.eventId }, state()), false);
});

test('C4: publicación y panel de ejemplos requieren organizador y no habilitan edición de IDs de API como mocks', () => {
  for (const route of [{ name: 'create' }, { name: 'publishedEvent', eventId: 'id-api' }, { name: 'organizerDemo' }]) {
    assert.equal(canAccessRoute(buyer(), route, state()), false);
    assert.equal(canAccessRoute(organizer(), route, state()), true);
  }
  assert.equal(canAccessRoute(organizer(), { name: 'publishedEvent', eventId: '' }, state()), false);
  assert.equal(canAccessRoute(organizer(), { name: 'edit', eventId: 'id-api' }, state()), false);
});

test('C12: comprobante conectado requiere comprador y no usa las compras de ejemplo para resolver el ID', () => {
  const route = { name: 'purchaseReceipt', purchaseId: 'purchase-api' };
  assert.equal(canAccessRoute(buyer(), route, state()), true);
  assert.equal(canAccessRoute(organizer(), route, state()), true);
  assert.equal(canAccessRoute({ usuario: organizer().usuario, roles: [RolUsuario.ORGANIZADOR] }, route, state()), false);
  assert.equal(canAccessRoute(buyer(), { ...route, purchaseId: '' }, state()), false);
  assert.equal(canAccessRoute(buyer(), { name: 'purchase', id: route.purchaseId, role: 'comprador' }, state()), false);
});

test('C1: el recorrido anterior de compras queda separado y requiere capacidad de comprador', () => {
  const route = { name: 'purchasesDemo' };
  assert.equal(canAccessRoute(buyer(), route, state()), true);
  assert.equal(canAccessRoute(organizer(), route, state()), true);
  assert.equal(canAccessRoute({ usuario: organizer().usuario, roles: [RolUsuario.ORGANIZADOR] }, route, state()), false);
  assert.equal(canAccessRoute(null, route, state()), false);
});

test('C2: ruta de compras del evento solo admite organizador, mantiene IDs reales separados de la maqueta', () => {
  const route = { name: 'publishedEvent', eventId: 'evento-real-api' };
  assert.equal(canAccessRoute(buyer(), route, state()), false);
  assert.equal(canAccessRoute(organizer(), route, state()), true);
  assert.equal(canAccessRoute({ usuario: organizer().usuario, roles: [RolUsuario.ORGANIZADOR] }, route, state()), true);
  assert.equal(canAccessRoute(organizer(), { ...route, eventId: ' ' }, state()), false);
  assert.equal(canAccessRoute(organizer(), { name: 'organizerEvent', eventId: route.eventId }, state()), false);
});

test('C5: chat conectado requiere comprador y un ID real válido, sin resolver compras con fixtures', () => {
  const route = { name: 'purchaseChat', purchaseId: 'compra-api' };
  assert.equal(canAccessRoute(buyer(), route, state()), true);
  assert.equal(canAccessRoute(organizer(), route, state()), true); // Puede chatear sobre sus compras como comprador.
  assert.equal(canAccessRoute({ usuario: organizer().usuario, roles: ['ORGANIZADOR'] }, route, state()), false);
  assert.equal(canAccessRoute(buyer(), { ...route, purchaseId: '' }, state()), false);
  assert.equal(canAccessRoute(buyer(), { ...route, purchaseId: ' ' }, state()), false);
  assert.equal(canAccessRoute(buyer(), { name: 'chat', id: route.purchaseId, role: 'comprador' }, state()), false);
});

test('C6: chat de venta exige organizador y los IDs del evento y compra, sin resolverlos como maqueta', () => {
  const route = { name: 'saleChat', eventId: 'evento-api', purchaseId: 'compra-api' };
  assert.equal(canAccessRoute(buyer(), route, state()), false);
  assert.equal(canAccessRoute(organizer(), route, state()), true);
  assert.equal(canAccessRoute({ usuario: organizer().usuario, roles: ['ORGANIZADOR'] }, route, state()), true);
  for (const changes of [{ eventId: '' }, { eventId: ' ' }, { purchaseId: '' }, { purchaseId: ' ' }]) {
    assert.equal(canAccessRoute(organizer(), { ...route, ...changes }, state()), false);
  }
  assert.equal(canAccessRoute(organizer(), { name: 'chat', id: route.purchaseId, role: 'organizador' }, state()), false);
});

test('C9: reseña conectada requiere comprador e ID válido y mantiene aparte la maqueta', () => {
  const route = { name: 'purchaseReview', purchaseId: 'compra-api' };
  assert.equal(canAccessRoute(buyer(), route, state()), true);
  assert.equal(canAccessRoute(organizer(), route, state()), true); // Puede reseñar sus compras personales.
  assert.equal(canAccessRoute({ usuario: organizer().usuario, roles: ['ORGANIZADOR'] }, route, state()), false);
  assert.equal(canAccessRoute(buyer(), { ...route, purchaseId: ' ' }, state()), false);
  assert.equal(canAccessRoute(buyer(), { name: 'purchase', id: route.purchaseId, role: 'comprador' }, state()), false);
});

test('comprador no crea ni administra eventos y organizador solo administra los propios', () => {
  assert.equal(canAccessRoute(buyer(), { name: 'create' }, state()), false);
  assert.equal(canAccessRoute(organizer(), { name: 'create' }, state()), true);
  for (const name of ['edit', 'organizerEvent']) {
    assert.equal(canAccessRoute(buyer(), { name, eventId: ownEvent.id }, state()), false);
    assert.equal(canAccessRoute(organizer(), { name, eventId: ownEvent.id }, state()), true);
    assert.equal(canAccessRoute(organizer(), { name, eventId: otherEvent.id }, state()), false);
  }
  const forgedOwner = { ...ownEvent, organizadorId: buyer().usuario.id };
  assert.equal(canManageEvent(buyer(), forgedOwner), false);
  assert.equal(canAccessRoute(organizer(), { name: 'edit', eventId: 'no-existe' }, state()), false);
});

test('compras, ventas y favoritos se seleccionan por identidad y no se mezclan al alternar', () => {
  const data = state();
  const first = selectSessionData(buyer(), data);
  const second = selectSessionData(organizer(), data);
  assert.equal(first.purchases.length, 6);
  assert.equal(first.sales.length, 0);
  assert.equal(second.purchases.length, 1);
  assert.equal(second.sales.length, 3);
  assert.ok(first.purchases.every((purchase) => purchase.compradorId === buyer().usuario.id));
  assert.ok(second.purchases.every((purchase) => purchase.compradorId === organizer().usuario.id));
  first.favoriteIds.push('cancha');
  assert.deepEqual(selectSessionData(buyer(), data).favoriteIds, ['after', 'umbral']);
  data.favoritesByUser[buyer().usuario.id].push('cancha');
  assert.deepEqual(selectSessionData(organizer(), data).favoriteIds, ['futuro']);
  assert.deepEqual(selectSessionData(buyer(), data).favoriteIds, ['after', 'umbral', 'cancha']);
});

test('una compra nueva del comprador aparece como venta del organizador sin duplicar registros', () => {
  const data = state();
  const purchase = { ...sharedPurchase, id: 'nueva-compra', estado: 'PENDIENTE' };
  data.purchases.push(purchase);
  assert.ok(selectSessionData(buyer(), data).purchases.some((item) => item === purchase));
  assert.ok(selectSessionData(organizer(), data).sales.some((item) => item === purchase));
  assert.equal(data.purchases.filter((item) => item.id === purchase.id).length, 1);
  const foreign = { ...purchase, id: 'ajena', eventoId: otherEvent.id, compradorId: 'otro-comprador' };
  assert.equal(canAccessPurchase(buyer(), foreign, otherEvent), false);
  assert.equal(canAccessPurchase(organizer(), foreign, otherEvent), false);
});

test('el mismo chat permite ambas perspectivas pero bloquea ventas, compras y chats ajenos', () => {
  for (const name of ['purchase', 'chat']) {
    assert.equal(canAccessRoute(buyer(), { name, id: sharedPurchase.id, role: 'comprador' }, state()), true);
    assert.equal(canAccessRoute(organizer(), { name, id: sharedPurchase.id, role: 'organizador' }, state()), true);
    assert.equal(canAccessRoute(buyer(), { name, id: sharedPurchase.id, role: 'organizador' }, state()), false);
    assert.equal(canAccessRoute(organizer(), { name, id: sharedPurchase.id, role: 'comprador' }, state()), false);
    assert.equal(canAccessRoute(organizer(), { name, id: 'AT-2048', role: 'organizador' }, state()), false);
    assert.equal(canAccessRoute(buyer(), { name, id: 'AT-3002', role: 'comprador' }, state()), false);
    assert.equal(canAccessRoute(buyer(), { name, id: 'no-existe', role: 'comprador' }, state()), false);
  }
  assert.equal(canAccessRoute(buyer(), { name: 'chat', id: sharedPurchase.id }, state()), false);
  const missingEvent = state();
  missingEvent.events = [];
  assert.equal(canAccessRoute(buyer(), { name: 'purchase', id: sharedPurchase.id, role: 'comprador' }, missingEvent), false);
});

test('el chat identifica autores por usuario y no se bloquea por estado o fecha del evento', () => {
  assert.deepEqual(initialMessages[sharedPurchase.id].map((message) => message.usuarioId), [buyer().usuario.id, organizer().usuario.id]);
  const pastEvent = { ...ownEvent, fecha: '2020-01-01T00:00:00Z', finalizadoDemo: true };
  for (const estado of ['PENDIENTE', 'CONFIRMADA', 'UTILIZADA', 'CANCELADA', 'REEMBOLSADA']) {
    const purchase = { ...sharedPurchase, estado };
    assert.equal(canAccessPurchase(buyer(), purchase, pastEvent), true);
    assert.equal(canAccessPurchase(organizer(), purchase, pastEvent), true);
  }
});

test('solo el comprador propietario reseña una compra utilizada, sin exigir finalización', () => {
  const data = state();
  const purchase = data.purchases.find((item) => item.id === 'AT-1982');
  const event = data.events.find((item) => item.id === purchase.eventoId);
  assert.equal(canReviewPurchase(buyer(), purchase, event), true);
  assert.equal(canReviewPurchase(organizer(), purchase, event), false);
  assert.equal(canReviewPurchase(buyer(), { ...purchase, resenada: true }, event), false);
  assert.equal(canReviewPurchase(buyer(), { ...purchase, estado: 'CONFIRMADA' }, event), false);
  assert.equal(canReviewPurchase(buyer(), purchase, { ...event, finalizadoDemo: false }), true);
  assert.equal(canReviewPurchase(buyer(), purchase, ownEvent), false);
});

test('ambos perfiles compran eventos futuros y las sesiones inválidas no habilitan acciones', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  assert.equal(canPurchase(buyer(), otherEvent, now), true);
  assert.equal(canPurchase(organizer(), otherEvent, now), true);
  assert.equal(canPurchase(buyer(), { ...otherEvent, finalizadoDemo: true }, now), false);
  assert.equal(canPurchase(buyer(), { ...otherEvent, fecha: '2020-01-01' }, now), false);
  assert.equal(canPurchase({ usuario: buyer().usuario, roles: [RolUsuario.ORGANIZADOR] }, otherEvent, now), false);
  assert.equal(canOrganize(null), false);
  assert.equal(canPurchase(null, otherEvent, now), false);
  assert.equal(canAccessRoute(null, undefined, state()), false);
  assert.equal(canAccessRoute(buyer(), { name: 'desconocida' }, state()), false);
});

test('DD-07: un perfil con ambos roles consulta su publicación pero solo compra eventos ajenos', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const own = { ...otherEvent, organizadorId: organizer().usuario.id };
  assert.equal(canPurchase(organizer(), own, now), false);
  assert.equal(canManageEvent(organizer(), own), true);
  assert.equal(canAccessRoute(organizer(), { name: 'catalogEvent', eventId: own.id }, state()), true);
  assert.equal(canPurchase(buyer(), own, now), true);
  assert.equal(canPurchase(organizer(), { ...own, organizadorId: 'otro-organizador' }, now), true);
  assert.equal(canPurchase(buyer(), { ...own, organizadorId: buyer().usuario.id }, now), false);
});

test('los fixtures mantienen IDs únicos y asociaciones válidas de eventos, compras, mensajes y favoritos', () => {
  for (const collection of [initialEvents, initialPurchases, organizers]) {
    assert.equal(new Set(collection.map((item) => item.id)).size, collection.length);
  }
  for (const event of initialEvents) {
    assert.ok(organizers.some((item) => item.id === event.organizadorId));
  }
  for (const purchase of initialPurchases) {
    const event = initialEvents.find((item) => item.id === purchase.eventoId);
    assert.ok(event?.tiposEntrada.some((item) => item.id === purchase.tipoEntradaId));
    assert.ok(purchase.compradorId);
  }
  for (const [purchaseId, messages] of Object.entries(initialMessages)) {
    const purchase = initialPurchases.find((item) => item.id === purchaseId);
    const event = initialEvents.find((item) => item.id === purchase.eventoId);
    assert.ok(messages.every((message) => [purchase.compradorId, event.organizadorId].includes(message.usuarioId)));
  }
  for (const ids of Object.values(initialFavoritesByUser)) {
    assert.ok(ids.every((id) => initialEvents.some((event) => event.id === id)));
  }
});
