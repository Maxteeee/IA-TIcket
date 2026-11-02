import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '../src/repositories/index.js';
import { createServices } from '../src/services/index.js';
import { seedReferenceData } from '../src/data/reference.js';
import { Usuario } from '../src/domain/Usuario.js';
import { RolUsuario } from '../src/domain/RolUsuario.js';
import { mensajeDto } from '../src/http/presenters.js';

function scenario() {
  let instant = new Date('2026-11-01T12:00:00Z');
  const repositories = seedReferenceData(createRepositories());
  repositories.usuarios.save(new Usuario({ id: 'otro', nombre: 'Otro', apellido: 'Comprador' }));
  const services = createServices(repositories, { now: () => new Date(instant) });
  const event = services.eventos.create({ nombre: 'Chat C5', descripcion: 'Mensajes de una compra', categoriaId: 'demo-categoria-1', fecha: '2026-12-01T20:00:00Z',
    tiposEntrada: [{ nombre: 'General', precio: 10, cupo: 5 }] }, 'organizador-1');
  const buy = (buyer = 'comprador-1') => services.compras.create({ eventoId: event.id, tipoEntradaId: event.tiposEntrada[0].id, cantidad: 1 }, buyer);
  return { repositories, services, event, buy, advance: (value) => { instant = new Date(value); } };
}

test('C5: mensajes en los cinco estados y después del evento sin alterar estado, historial ni cupo', () => {
  const s = scenario();
  const purchase = s.buy();
  const history = [...purchase.historial];
  const cupo = s.event.tiposEntrada[0].cupo;
  s.advance('2026-12-02T12:00:00Z');
  for (const estado of ['PENDIENTE', 'CONFIRMADA', 'UTILIZADA', 'CANCELADA', 'REEMBOLSADA']) {
    purchase.estado = estado; // Históricos de prueba; no agrega transiciones.
    const sent = s.services.compras.addMessage(purchase.id, { mensaje: ` Consulta ${estado} ` }, 'comprador-1');
    assert.equal(sent.usuario.id, 'comprador-1');
    assert.equal(sent.mensaje, `Consulta ${estado}`);
    assert.equal(sent.enviado.toISOString(), '2026-12-02T12:00:00.000Z');
    assert.equal(mensajeDto(sent, purchase.id).compraId, purchase.id);
    assert.equal(purchase.estado, estado);
  }
  assert.equal(s.services.compras.listMessages(purchase.id, 'comprador-1').length, 5);
  assert.equal(s.event.tiposEntrada[0].cupo, cupo);
  assert.deepEqual(purchase.historial, history);
});

test('C5: reintento conserva el mensaje y la clave se limita a compra y autor', () => {
  const s = scenario();
  const purchase = s.buy();
  const key = { idempotencyKey: 'envio-1' };
  const first = s.services.compras.addMessage(purchase.id, { mensaje: 'Hola' }, 'comprador-1', key);
  assert.equal(s.services.compras.addMessage(purchase.id, { mensaje: ' Hola ' }, 'comprador-1', key), first);
  assert.throws(() => s.services.compras.addMessage(purchase.id, { mensaje: 'Otro texto' }, 'comprador-1', key), { status: 409 });
  const otherPurchase = s.buy();
  const second = s.services.compras.addMessage(otherPurchase.id, { mensaje: 'Hola' }, 'comprador-1', key);
  const reply = s.services.compras.addMessage(purchase.id, { mensaje: 'Respuesta' }, 'organizador-1', key);
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.id, reply.id);
  assert.deepEqual(purchase.mensajes.map((message) => message.id), [first.id, reply.id]);
});

test('C5: validación de contenido/autor y permiso previo al reintento, sin mensajes parciales', () => {
  const s = scenario();
  const purchase = s.buy();
  s.buy('otro');
  const key = { idempotencyKey: 'corregir' };
  for (const mensaje of ['', '  ', 'a'.repeat(2001), 123, null]) {
    assert.throws(() => s.services.compras.addMessage(purchase.id, { mensaje }, 'comprador-1', key), { status: 400 });
  }
  assert.throws(() => s.services.compras.addMessage(purchase.id, { mensaje: 'Hola', usuarioId: 'organizador-1' }, 'comprador-1'), { status: 400 });
  assert.throws(() => s.services.compras.addMessage(purchase.id, { mensaje: 'Hola' }, 'comprador-1', { idempotencyKey: 'inválida' }), { status: 400 });
  assert.equal(purchase.mensajes.length, 0);
  const sent = s.services.compras.addMessage(purchase.id, { mensaje: 'a'.repeat(2000) }, 'comprador-1', key);
  assert.equal(sent.mensaje.length, 2000);
  assert.throws(() => s.services.compras.addMessage(purchase.id, { mensaje: sent.mensaje }, 'otro', key), { status: 403 });
  assert.throws(() => s.services.compras.listMessages(purchase.id, 'otro'), { status: 403 });
  assert.throws(() => s.services.compras.addMessage(purchase.id, { mensaje: 'Hola' }), { status: 401 });
  assert.equal(purchase.mensajes.length, 1);
});

test('C6: responder exige rol almacenado y relación con el evento, aun al reintentar una respuesta guardada', () => {
  const s = scenario();
  const purchase = s.buy();
  const options = { idempotencyKey: 'respuesta-1' };
  const first = s.services.compras.addMessage(purchase.id, { mensaje: 'Respuesta' }, 'organizador-1', options);
  assert.equal(first.usuario.id, 'organizador-1');
  purchase.evento.organizador.roles = [RolUsuario.COMPRADOR];
  assert.throws(() => s.services.compras.listMessages(purchase.id, 'organizador-1'), { status: 403 });
  assert.throws(() => s.services.compras.addMessage(purchase.id, { mensaje: 'Respuesta' }, 'organizador-1', options), { status: 403 });
  assert.equal(purchase.mensajes.length, 1);
  assert.deepEqual(s.services.compras.listMessages(purchase.id, 'comprador-1'), [first]);
});

test('C6: una compra histórica con ambas relaciones conserva acceso sin habilitar nuevas autocompras', () => {
  const s = scenario();
  const purchase = s.buy();
  // Representa un registro anterior a DD-07; no se crea por el POST de compras actual.
  purchase.comprador = s.event.organizador;
  purchase.comprador.roles = [RolUsuario.ORGANIZADOR];
  const sent = s.services.compras.addMessage(purchase.id, { mensaje: 'Mensaje propio' }, 'organizador-1');
  assert.equal(s.services.compras.get(purchase.id, 'organizador-1'), purchase);
  assert.deepEqual(s.services.compras.listMessages(purchase.id, 'organizador-1'), [sent]);
});
