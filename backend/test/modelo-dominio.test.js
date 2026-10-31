import test from 'node:test';
import assert from 'node:assert/strict';
import { Usuario } from '../src/domain/Usuario.js';
import { Categoria } from '../src/domain/Categoria.js';
import { TipoEntrada } from '../src/domain/TipoEntrada.js';
import { Evento } from '../src/domain/Evento.js';
import { Compra } from '../src/domain/Compra.js';
import { EstadoCompra } from '../src/domain/EstadoCompra.js';
import { Mensaje } from '../src/domain/Mensaje.js';
import { Resenia } from '../src/domain/Resenia.js';
import { CambioEstadoCompra } from '../src/domain/CambioEstadoCompra.js';

function crearEscenario() {
  const organizador = new Usuario({ nombre: 'Ana', apellido: 'Pérez' });
  const comprador = new Usuario({ nombre: 'Luis', apellido: 'Gómez' });
  const categoria = new Categoria({ nombre: 'Música', descripcion: 'Conciertos' });
  const tipoEntrada = new TipoEntrada({ nombre: 'General', descripcion: 'Acceso general', precio: 1000, cupo: 50 });
  const evento = new Evento({
    nombre: 'Concierto',
    descripcion: 'Música en vivo',
    categoria,
    fecha: new Date('2026-12-01T21:00:00Z'),
    tiposEntrada: [tipoEntrada],
    organizador,
  });
  const compra = new Compra({
    comprador,
    evento,
    tipoEntrada,
    cantidad: 2,
    total: 2000,
    estado: EstadoCompra.PENDIENTE,
  });
  return { organizador, comprador, categoria, tipoEntrada, evento, compra };
}

test('las relaciones del modelo conservan las mismas instancias en memoria', () => {
  const { organizador, comprador, categoria, tipoEntrada, evento, compra } = crearEscenario();
  comprador.favoritos.push(evento);

  assert.equal(evento.organizador, organizador);
  assert.equal(evento.categoria, categoria);
  assert.equal(comprador.favoritos[0], evento);
  assert.equal(compra.comprador, comprador);
  assert.equal(compra.evento, evento);
  assert.equal(compra.tipoEntrada, evento.tiposEntrada[0]);

  // Una actualización del objeto relacionado es visible desde ambas relaciones.
  tipoEntrada.cupo = 40;
  assert.equal(evento.tiposEntrada[0].cupo, 40);
  assert.equal(compra.tipoEntrada.cupo, 40);
});

test('una compra contiene mensajes e historial con su usuario y fecha, y un evento recibe reseñas', () => {
  const { comprador, evento, compra } = crearEscenario();
  const fecha = new Date('2026-11-01T10:00:00Z');
  const mensaje = new Mensaje({ usuario: comprador, mensaje: 'Consulta sobre mi entrada', enviado: fecha });
  const cambio = new CambioEstadoCompra({ compra, estado: EstadoCompra.CONFIRMADA, quien: comprador, fechaHora: fecha });
  const resenia = new Resenia({ comprador, evento, detalle: 'Muy buen evento', puntuacion: 4.5 });
  compra.mensajes.push(mensaje);
  compra.historial.push(cambio);

  assert.equal(compra.mensajes[0].usuario, comprador);
  assert.equal(compra.mensajes[0].enviado, fecha);
  assert.equal(compra.historial[0].compra, compra);
  assert.equal(compra.historial[0].quien, comprador);
  assert.equal(compra.historial[0].fechaHora, fecha);
  assert.equal(resenia.comprador, comprador);
  assert.equal(resenia.evento, evento);
});

test('las colecciones vacías de una instancia no se comparten con otras', () => {
  const primero = crearEscenario();
  const segundo = crearEscenario();
  primero.comprador.favoritos.push(primero.evento);
  primero.evento.multimedia.push('concierto.jpg');
  primero.compra.mensajes.push(new Mensaje({ usuario: primero.comprador, mensaje: 'Hola', enviado: new Date() }));
  primero.compra.historial.push(new CambioEstadoCompra({
    compra: primero.compra,
    estado: EstadoCompra.PENDIENTE,
    quien: primero.comprador,
    fechaHora: new Date(),
  }));

  assert.deepEqual(segundo.comprador.favoritos, []);
  assert.deepEqual(segundo.evento.multimedia, []);
  assert.deepEqual(segundo.compra.mensajes, []);
  assert.deepEqual(segundo.compra.historial, []);
});

test('los constructores copian los arreglos recibidos y conservan las referencias a sus elementos', () => {
  const { comprador, evento, tipoEntrada, compra } = crearEscenario();
  const favoritos = [evento];
  const tiposEntrada = [tipoEntrada];
  const multimedia = ['concierto.jpg'];
  const mensajes = [new Mensaje({ usuario: comprador, mensaje: 'Hola', enviado: new Date() })];
  const historial = [new CambioEstadoCompra({ compra, estado: EstadoCompra.PENDIENTE, quien: comprador, fechaHora: new Date() })];

  const usuario = new Usuario({ nombre: 'Eva', apellido: 'López', favoritos });
  const otroEvento = new Evento({ ...evento, tiposEntrada, multimedia });
  const otraCompra = new Compra({ ...compra, mensajes, historial });

  for (const [coleccion, original] of [
    [usuario.favoritos, favoritos],
    [otroEvento.tiposEntrada, tiposEntrada],
    [otroEvento.multimedia, multimedia],
    [otraCompra.mensajes, mensajes],
    [otraCompra.historial, historial],
  ]) {
    assert.notEqual(coleccion, original);
    assert.equal(coleccion[0], original[0]);
    original.length = 0;
    assert.equal(coleccion.length, 1);
  }
});

test('un evento debe ofrecer al menos un tipo de entrada según la multiplicidad del diagrama', () => {
  const { evento } = crearEscenario();
  for (const tiposEntrada of [[], undefined, null, 'General']) {
    assert.throws(() => new Evento({ ...evento, tiposEntrada }), {
      name: 'TypeError',
      message: 'El evento debe ofrecer al menos un tipo de entrada',
    });
  }
});

test('la disponibilidad acepta cantidades enteras positivas hasta el cupo sin descontarlo', () => {
  const { tipoEntrada } = crearEscenario();

  assert.equal(tipoEntrada.hayCupoPara(1), true);
  assert.equal(tipoEntrada.hayCupoPara(50), true);
  for (const cantidad of [51, 0, -1, 1.5, NaN, Infinity, '2', null, undefined, true]) {
    assert.equal(tipoEntrada.hayCupoPara(cantidad), false);
  }
  assert.equal(tipoEntrada.cupo, 50);

  tipoEntrada.cupo = 0;
  assert.equal(tipoEntrada.hayCupoPara(1), false);
});

test('una compra rechaza una entrada de otro evento aunque tenga los mismos datos', () => {
  const { compra, evento, tipoEntrada } = crearEscenario();
  const entradaAjena = new TipoEntrada({ ...tipoEntrada });

  assert.throws(() => new Compra({ ...compra, tipoEntrada: entradaAjena }), {
    name: 'TypeError',
    message: 'El tipo de entrada debe pertenecer al evento de la compra',
  });
  assert.throws(() => new Compra({ ...compra, evento: undefined }), TypeError);
  assert.throws(() => new Compra({ ...compra, comprador: undefined }), TypeError);
  assert.deepEqual(evento.tiposEntrada, [tipoEntrada]);
  assert.equal(tipoEntrada.cupo, 50);
});

test('los estados de compras e historial deben pertenecer al enum de la consigna', () => {
  const { compra, comprador } = crearEscenario();
  for (const estado of Object.values(EstadoCompra)) {
    assert.equal(new Compra({ ...compra, estado }).estado, estado);
    const cambio = new CambioEstadoCompra({ compra, estado, quien: comprador, fechaHora: new Date() });
    assert.equal(cambio.estado, estado);
  }
  for (const estado of ['PAGADA', 'pendiente', undefined, null, 0]) {
    assert.throws(() => new Compra({ ...compra, estado }), TypeError);
    assert.throws(() => new CambioEstadoCompra({ compra, estado, quien: comprador, fechaHora: new Date() }), TypeError);
  }
});

test('comprador y organizador pueden intercambiar mensajes y consultarlos en orden', () => {
  const { compra, comprador, organizador } = crearEscenario();
  const consulta = new Mensaje({ usuario: comprador, mensaje: '¿A qué hora abren?', enviado: new Date() });
  const respuesta = new Mensaje({ usuario: organizador, mensaje: 'Una hora antes del inicio', enviado: new Date() });

  compra.agregarMensaje(consulta);
  compra.agregarMensaje(respuesta);

  assert.equal(compra.esParticipante(comprador), true);
  assert.equal(compra.esParticipante(organizador), true);
  assert.deepEqual(compra.obtenerMensajes(comprador), [consulta, respuesta]);
  assert.deepEqual(compra.obtenerMensajes(organizador), [consulta, respuesta]);

  const copia = compra.obtenerMensajes(comprador);
  copia.length = 0;
  assert.equal(compra.obtenerMensajes(comprador).length, 2);
});

test('un tercero, incluso con el mismo nombre, no puede enviar ni consultar mensajes de la compra', () => {
  const { compra, comprador } = crearEscenario();
  const tercero = new Usuario({ nombre: comprador.nombre, apellido: comprador.apellido });
  const mensaje = new Mensaje({ usuario: tercero, mensaje: 'Mensaje ajeno', enviado: new Date() });

  assert.equal(compra.esParticipante(tercero), false);
  assert.equal(compra.esParticipante(undefined), false);
  assert.throws(() => compra.agregarMensaje(mensaje), /Solo el comprador y el organizador/);
  assert.throws(() => compra.obtenerMensajes(tercero), /Solo el comprador y el organizador/);
  assert.throws(() => compra.obtenerMensajes(undefined), /Solo el comprador y el organizador/);
  assert.deepEqual(compra.mensajes, []);
});

test('el constructor de compra aplica la misma validación a los mensajes iniciales', () => {
  const { compra, comprador } = crearEscenario();
  const ajeno = new Usuario({ nombre: 'Otra', apellido: 'Persona' });
  const consulta = new Mensaje({ usuario: comprador, mensaje: 'Hola', enviado: new Date() });
  const intruso = new Mensaje({ usuario: ajeno, mensaje: 'Mensaje ajeno', enviado: new Date() });

  assert.deepEqual(new Compra({ ...compra, mensajes: [consulta] }).mensajes, [consulta]);
  assert.throws(() => new Compra({ ...compra, mensajes: [intruso] }), /Solo el comprador y el organizador/);
  assert.throws(() => compra.agregarMensaje(undefined), TypeError);
  assert.throws(() => compra.agregarMensaje({ usuario: comprador, mensaje: 'No es un Mensaje' }), TypeError);
});

test('participar en otra compra del mismo evento no da acceso al chat de un comprador diferente', () => {
  const { compra } = crearEscenario();
  const otroComprador = new Usuario({ nombre: 'Otra', apellido: 'Persona' });
  const otraCompra = new Compra({ ...compra, comprador: otroComprador });
  const mensaje = new Mensaje({ usuario: otroComprador, mensaje: 'Mi consulta', enviado: new Date() });

  otraCompra.agregarMensaje(mensaje);
  assert.deepEqual(otraCompra.obtenerMensajes(otroComprador), [mensaje]);
  assert.throws(() => compra.obtenerMensajes(otroComprador), /Solo el comprador y el organizador/);
  assert.throws(() => compra.agregarMensaje(mensaje), /Solo el comprador y el organizador/);
});

test('un usuario guarda favoritos sin duplicarlos y puede quitarlos sin afectar otros usuarios', () => {
  const { evento, comprador, organizador } = crearEscenario();
  const otroEvento = new Evento({ ...evento, nombre: 'Otro concierto' });

  comprador.agregarFavorito(evento);
  comprador.agregarFavorito(evento);
  comprador.agregarFavorito(otroEvento);
  assert.deepEqual(comprador.favoritos, [evento, otroEvento]);
  assert.equal(comprador.tieneFavorito(evento), true);
  assert.deepEqual(organizador.favoritos, []);

  comprador.quitarFavorito(evento);
  comprador.quitarFavorito(evento);
  assert.equal(comprador.tieneFavorito(evento), false);
  assert.deepEqual(comprador.favoritos, [otroEvento]);
  assert.throws(() => comprador.agregarFavorito(undefined), TypeError);
});

test('los favoritos iniciales también evitan duplicados sin modificar el arreglo recibido', () => {
  const { evento } = crearEscenario();
  const favoritos = [evento, evento];
  const usuario = new Usuario({ nombre: 'Eva', apellido: 'López', favoritos });

  assert.deepEqual(usuario.favoritos, [evento]);
  assert.equal(favoritos.length, 2);
});

test('las reseñas de un organizador se obtienen de todos sus eventos y excluyen las ajenas', () => {
  const { evento, comprador, organizador } = crearEscenario();
  const otroEvento = new Evento({ ...evento, nombre: 'Segundo concierto' });
  const ajeno = crearEscenario();
  const primera = new Resenia({ comprador, evento, detalle: 'Muy bien', puntuacion: 4 });
  const segunda = new Resenia({ comprador, evento: otroEvento, detalle: 'Excelente', puntuacion: 5 });
  const otra = new Resenia({ comprador, evento: ajeno.evento, detalle: 'Otra experiencia', puntuacion: 3 });
  const resenias = [primera, otra, segunda];

  assert.deepEqual(organizador.obtenerReseniasRecibidas(resenias), [primera, segunda]);
  assert.deepEqual(ajeno.organizador.obtenerReseniasRecibidas(resenias), [otra]);
  assert.deepEqual(comprador.obtenerReseniasRecibidas(resenias), []);
  assert.deepEqual(organizador.obtenerReseniasRecibidas([]), []);
  assert.deepEqual(resenias, [primera, otra, segunda]);
});

test('una misma persona puede organizar un evento y comprar entradas para otro', () => {
  const propio = crearEscenario();
  const ajeno = crearEscenario();
  const compra = new Compra({ ...ajeno.compra, comprador: propio.organizador });
  const mensaje = new Mensaje({ usuario: propio.organizador, mensaje: 'Consulta como comprador', enviado: new Date() });

  propio.organizador.agregarFavorito(ajeno.evento);
  compra.agregarMensaje(mensaje);

  assert.equal(propio.evento.organizador, propio.organizador);
  assert.equal(compra.comprador, propio.organizador);
  assert.equal(propio.organizador.tieneFavorito(ajeno.evento), true);
  assert.deepEqual(compra.obtenerMensajes(propio.organizador), [mensaje]);
});
