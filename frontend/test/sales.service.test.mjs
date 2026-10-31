import test from 'node:test';
import assert from 'node:assert/strict';
import { createSalesService, salesFromDto } from '../src/services/sales.service.js';
import { ApiError } from '../src/services/api.client.js';
import { authMock } from '../src/services/auth.mock.js';

const organizer = () => authMock.getSession('organizador-1');
function dto(eventId = 'evento-1') {
  const event = { id: eventId, organizadorId: 'organizador-1', nombre: 'Encuentro C2', fecha: '2026-12-01T20:00:00Z',
    tiposEntrada: [{ id: 'tipo-1', nombre: 'General', precio: 10, cupo: 1 }, { id: 'tipo-2', nombre: 'VIP', precio: 20, cupo: 0 }] };
  return { evento: event, compras: [{ id: 'compra-1', compradorId: 'comprador-1', eventoId: eventId, tipoEntradaId: 'tipo-1', tipoEntradaNombre: 'General',
    precioUnitario: 10, cantidad: 2, total: 20, estado: 'PENDIENTE', diasRestantes: null,
    evento: { id: eventId, nombre: event.nombre, fecha: event.fecha, organizadorId: event.organizadorId }, comprador: { id: 'comprador-1', nombre: 'Comprador 1', apellido: '' } }] };
}

test('C2: consulta única por evento lleva identidad de organizador y cancelación, con ID codificado', async () => {
  const controller = new AbortController();
  const calls = [];
  const service = createSalesService({ get: async (path, options) => { calls.push({ path, options }); return dto('evento/con espacio'); } });
  const result = await service.getEventSales('evento/con espacio', organizer(), { signal: controller.signal });
  assert.deepEqual(calls, [{ path: '/eventos/evento%2Fcon%20espacio/ventas', options: { usuarioId: 'organizador-1', signal: controller.signal } }]);
  assert.equal(result.compras.length, 1);
  assert.deepEqual(result.evento.tiposEntrada.map((ticket) => ticket.cupo), [1, 0]);
});

test('C2: cupos restantes no se recalculan restando compras, y valores actuales no reemplazan históricos', () => {
  const original = dto();
  original.evento.tiposEntrada[0].nombre = 'Nuevo nombre';
  original.evento.tiposEntrada[0].precio = 99;
  const result = salesFromDto(original, 'evento-1', 'organizador-1');
  assert.equal(result.compras[0].tipoEntradaNombre, 'General');
  assert.equal(result.compras[0].precioUnitario, 10);
  assert.equal(result.evento.tiposEntrada[0].cupo, 1);
  result.compras[0].comprador.nombre = 'Cambio local';
  result.evento.tiposEntrada[0].cupo = 0;
  assert.equal(original.compras[0].comprador.nombre, 'Comprador 1');
  assert.equal(original.evento.tiposEntrada[0].cupo, 1);
  const empty = dto();
  empty.compras = [];
  assert.deepEqual(salesFromDto(empty, 'evento-1', 'organizador-1').compras, []);
});

test('C2: rechaza respuesta de otro organizador/evento, compras duplicadas, tipos ajenos o comprador inconsistente', () => {
  const invalid = [
    (data) => { data.evento.organizadorId = 'otro'; },
    (data) => { data.evento.id = 'otro'; },
    (data) => { data.compras.push(data.compras[0]); },
    (data) => { data.compras[0].eventoId = 'otro'; },
    (data) => { data.compras[0].tipoEntradaId = 'otro'; },
    (data) => { data.compras[0].comprador.id = 'otro'; },
    (data) => { data.compras[0].evento.fecha = '2025-01-01T00:00:00Z'; },
    (data) => { delete data.compras; },
  ];
  for (const change of invalid) {
    const data = dto(); change(data);
    assert.throws(() => salesFromDto(data, 'evento-1', 'organizador-1'), { code: 'INVALID_RESPONSE' });
  }
});

test('C2: no presenta cupos o tipos inválidos como disponibilidad real', () => {
  for (const cupo of [-1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    const data = dto(); data.evento.tiposEntrada[0].cupo = cupo;
    assert.throws(() => salesFromDto(data, 'evento-1', 'organizador-1'), { code: 'INVALID_RESPONSE' });
  }
  for (const tiposEntrada of [[], null, [dto().evento.tiposEntrada[0], dto().evento.tiposEntrada[0]]]) {
    const data = dto(); data.evento.tiposEntrada = tiposEntrada;
    assert.throws(() => salesFromDto(data, 'evento-1', 'organizador-1'), { code: 'INVALID_RESPONSE' });
  }
});

test('C2: comprador no consulta ventas y errores de red se propagan sin datos de ejemplo', async () => {
  let calls = 0;
  const service = createSalesService({ get: async () => { calls++; throw new ApiError('Sin conexión', { code: 'NETWORK' }); } });
  await assert.rejects(service.getEventSales('evento-1', authMock.getSession('comprador-1')), { status: 403 });
  await assert.rejects(service.getEventSales('', organizer()), { status: 400 });
  assert.equal(calls, 0);
  await assert.rejects(service.getEventSales('evento-1', organizer()), { code: 'NETWORK' });
  assert.equal(calls, 1);
});
