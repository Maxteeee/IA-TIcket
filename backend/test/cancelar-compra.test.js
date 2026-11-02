import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '../src/repositories/index.js';
import { createServices } from '../src/services/index.js';
import { seedReferenceData } from '../src/data/reference.js';
import { Usuario } from '../src/domain/Usuario.js';
import { compraDto } from '../src/http/presenters.js';

function scenario(precio = 10.25) {
  let instant = new Date('2026-11-02T12:00:00Z');
  const now = () => new Date(instant);
  const repositories = seedReferenceData(createRepositories());
  repositories.usuarios.save(new Usuario({ id: 'otra-persona', nombre: 'Otra', apellido: 'Persona' }));
  const services = createServices(repositories, { now });
  const event = services.eventos.create({ nombre: 'Cancelaciones C7', descripcion: 'Simulación de compras',
    categoriaId: 'demo-categoria-1', fecha: '2026-12-01T20:00:00Z', fechaFin: '2026-12-01T22:00:00Z',
    tiposEntrada: [{ nombre: 'General', precio, cupo: 3 }, { nombre: 'VIP', precio: 20, cupo: 5 }] }, 'organizador-1');
  const buy = (buyer = 'comprador-1', cantidad = 2) => services.compras.create({ eventoId: event.id, tipoEntradaId: event.tiposEntrada[0].id, cantidad }, buyer);
  const purchase = buy();
  const confirm = () => services.compras.updateState(purchase.id, { estado: 'CONFIRMADA' }, 'organizador-1');
  const cancel = (buyer = 'comprador-1', data = {}) => services.compras.cancel(purchase.id, data, buyer);
  return { now, repositories, services, event, purchase, buy, confirm, cancel, advance: (value) => { instant = new Date(value); } };
}

test('C7: pendiente se cancela, devuelve solo su tipo y registra al comprador sin reembolso', () => {
  const s = scenario();
  assert.equal(compraDto(s.purchase, s.now()).puedeCancelar, true);
  assert.equal(s.purchase.puedeCancelar(s.event.organizador, s.now()), false);
  const result = s.cancel();
  assert.equal(result, s.purchase);
  assert.equal(result.estado, 'CANCELADA');
  assert.equal(result.reembolso, null);
  assert.equal(result.total, 20.5);
  assert.deepEqual(s.event.tiposEntrada.map((ticket) => ticket.cupo), [3, 5]);
  assert.deepEqual(result.historial.map((change) => change.estado), ['PENDIENTE', 'CANCELADA']);
  assert.equal(result.historial.at(-1).quien, result.comprador);
  assert.equal(compraDto(result, s.now()).puedeCancelar, false);
});

test('C7: confirmada devuelve el total original simulado, incluido cero, aunque se edite el tipo', () => {
  for (const precio of [0, 10.25]) {
    const s = scenario(precio); s.confirm();
    s.services.eventos.updateTicket(s.event.id, s.purchase.tipoEntrada.id, { precio: 99, nombre: 'Otro nombre' }, 'organizador-1');
    const result = s.cancel();
    assert.equal(result.estado, 'REEMBOLSADA');
    assert.equal(result.total, precio * 2);
    assert.equal(result.precioUnitario, precio);
    assert.equal(result.tipoEntradaNombre, 'General');
    assert.deepEqual(result.reembolso, { importe: precio * 2, fecha: s.now(), simulado: true });
    assert.deepEqual(result.historial.map((change) => change.estado), ['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'REEMBOLSADA']);
    assert.deepEqual(s.event.tiposEntrada.map((ticket) => ticket.cupo), [3, 5]);
    const dto = compraDto(result, s.now());
    assert.deepEqual(dto.reembolso, { importe: precio * 2, fecha: s.now().toISOString(), simulado: true });
    dto.reembolso.importe = 999;
    assert.equal(result.reembolso.importe, precio * 2);
    assert.equal(dto.diasRestantes, null);
    assert.equal(dto.puedeReseniar, false);
  }
});

test('C7: corte estricto en inicio, sin depender de fechaFin; utilizadas no se cancelan', () => {
  for (const estado of ['PENDIENTE', 'CONFIRMADA', 'UTILIZADA']) {
    for (const offset of [-1, 0, 1, 3 * 3600000]) {
      const s = scenario();
      if (estado !== 'PENDIENTE') s.confirm();
      if (estado === 'UTILIZADA') s.services.compras.updateState(s.purchase.id, { estado }, 'organizador-1');
      s.event.fechaFin = null;
      s.advance(new Date(s.event.fecha.getTime() + offset));
      const allowed = offset < 0 && estado !== 'UTILIZADA';
      const before = { cupo: s.purchase.tipoEntrada.cupo, historial: s.purchase.historial.length };
      assert.equal(compraDto(s.purchase, s.now()).puedeCancelar, allowed);
      if (allowed) s.cancel();
      else {
        assert.throws(s.cancel, { status: 409 });
        assert.equal(s.purchase.estado, estado);
        assert.equal(s.purchase.reembolso, null);
        assert.deepEqual({ cupo: s.purchase.tipoEntrada.cupo, historial: s.purchase.historial.length }, before);
      }
    }
  }
});

test('C7: solo comprador propietario con rol almacenado; rechaza campos arbitrarios y permisos antes del reintento', () => {
  const s = scenario();
  assert.throws(() => s.services.compras.cancel(s.purchase.id, {}), { status: 401 });
  for (const actor of ['otra-persona', 'organizador-1']) assert.throws(() => s.cancel(actor), { status: 403 });
  for (const data of [{ estado: 'REEMBOLSADA' }, { importe: 999 }, { compradorId: 'otra-persona' }, { cupo: 999 }, [], null]) {
    assert.throws(() => s.cancel('comprador-1', data), { status: 400 });
  }
  assert.throws(() => s.services.compras.cancel('inexistente', {}, 'comprador-1'), { status: 404 });
  assert.equal(s.purchase.estado, 'PENDIENTE');
  assert.equal(s.purchase.tipoEntrada.cupo, 1);
  s.cancel();
  s.purchase.comprador.roles = ['ORGANIZADOR'];
  assert.throws(s.cancel, { status: 403 });
  assert.equal(s.purchase.historial.length, 2);
});

test('C7: reintentos después de revender cupo o iniciar evento no duplican estado, devolución ni importe', () => {
  for (const confirmed of [false, true]) {
    const s = scenario(); if (confirmed) s.confirm();
    s.cancel();
    const history = [...s.purchase.historial];
    const refund = s.purchase.reembolso;
    s.buy('otra-persona', 3);
    assert.equal(s.purchase.tipoEntrada.cupo, 0);
    s.advance('2026-12-02T00:00:00Z');
    assert.equal(s.cancel(), s.purchase);
    assert.equal(s.purchase.tipoEntrada.cupo, 0);
    assert.deepEqual(s.purchase.historial, history);
    assert.equal(s.purchase.reembolso, refund);
    assert.throws(() => s.services.compras.updateState(s.purchase.id, { estado: 'CONFIRMADA' }, 'organizador-1'), { status: 409 });
    assert.throws(() => s.services.compras.updateState(s.purchase.id, { estado: 'UTILIZADA' }, 'organizador-1'), { status: 409 });
  }
});

test('C7: desborde de cupo no deja cancelación ni reembolso parciales', () => {
  const s = scenario(); s.confirm();
  s.purchase.tipoEntrada.cupo = Number.MAX_SAFE_INTEGER;
  assert.throws(s.cancel, { status: 409 });
  assert.equal(s.purchase.estado, 'CONFIRMADA');
  assert.equal(s.purchase.reembolso, null);
  assert.equal(s.purchase.historial.length, 2);
  assert.equal(s.purchase.tipoEntrada.cupo, Number.MAX_SAFE_INTEGER);
  s.purchase.tipoEntrada.cupo -= 2;
  s.cancel();
  assert.equal(s.purchase.tipoEntrada.cupo, Number.MAX_SAFE_INTEGER);
});
