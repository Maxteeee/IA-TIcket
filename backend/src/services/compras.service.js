import { Compra } from '../domain/Compra.js';
import { EstadoCompra } from '../domain/EstadoCompra.js';
import { Mensaje } from '../domain/Mensaje.js';
import { DomainError } from '../domain/DomainError.js';
import { RolUsuario } from '../domain/RolUsuario.js';
import { actor, authorize, conflict, fields, number, required, text } from './validation.js';

export function createComprasService(repositories, { now }) {
  const { compras, eventos } = repositories;
  const attempts = new Map();
  const messageAttempts = new Map();
  const ownEvent = (id, usuario) => {
    authorize(usuario.tieneRol(RolUsuario.ORGANIZADOR), 'Solo un organizador puede consultar las ventas del evento');
    const evento = required(eventos, id, 'Evento');
    authorize(evento.organizador === usuario, 'Solo el organizador propietario puede consultar las ventas del evento');
    return evento;
  };
  const get = (id, actorId) => {
    const usuario = actor(repositories, actorId);
    const compra = required(compras, id, 'Compra');
    authorize(compra.esParticipante(usuario), 'Solo los participantes pueden acceder a esta compra');
    authorize((usuario === compra.comprador && usuario.tieneRol(RolUsuario.COMPRADOR))
      || (usuario === compra.evento.organizador && usuario.tieneRol(RolUsuario.ORGANIZADOR)),
    'El perfil no tiene el rol requerido para acceder a esta compra');
    return compra;
  };

  return {
    get,
    salesSummary(eventId, actorId, query = {}) {
      fields(query, []);
      const evento = ownEvent(eventId, actor(repositories, actorId));
      return { evento, compras: compras.findByEvento(evento) };
    },
    list(actorId, query = {}) {
      fields(query, ['eventoId', 'estado']);
      const usuario = actor(repositories, actorId);
      let result;
      if (query.eventoId !== undefined) {
        const evento = ownEvent(query.eventoId, usuario);
        result = compras.findByEvento(evento);
      } else {
        authorize(usuario.tieneRol(RolUsuario.COMPRADOR), 'Solo un comprador puede consultar sus compras');
        result = compras.findByComprador(usuario);
      }
      if (query.estado !== undefined) {
        if (!Object.values(EstadoCompra).includes(query.estado)) throw new DomainError('Estado de compra inválido');
        result = result.filter((compra) => compra.estado === query.estado);
      }
      return result;
    },
    create(data, actorId, { idempotencyKey } = {}) {
      fields(data, ['eventoId', 'tipoEntradaId', 'cantidad', 'precioUnitarioEsperado'], ['eventoId', 'tipoEntradaId', 'cantidad']);
      const comprador = actor(repositories, actorId);
      authorize(comprador.tieneRol(RolUsuario.COMPRADOR), 'Solo un comprador puede comprar entradas');
      if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(idempotencyKey))) {
        throw new DomainError('Idempotency-Key debe contener de 1 a 100 letras, números o guiones');
      }
      const evento = required(eventos, data.eventoId, 'Evento');
      conflict(evento.organizador === comprador, 'No podés comprar entradas para un evento propio');
      const key = idempotencyKey && `${comprador.id}:${idempotencyKey}`;
      const previous = key && attempts.get(key);
      if (previous) {
        conflict(previous.payload !== JSON.stringify(data), 'La clave de compra ya corresponde a otra selección');
        conflict(!compras.findById(previous.compra.id), 'La compra anterior ya no está disponible');
        return previous.compra;
      }
      const ahora = now();
      if (evento.fecha <= ahora) throw new DomainError('No se pueden comprar entradas para un evento iniciado', 409);
      const tipoEntrada = evento.tiposEntrada.find((entrada) => entrada.id === data.tipoEntradaId);
      if (!tipoEntrada) throw new DomainError('Tipo de entrada no encontrado en este evento', 404);
      const cantidad = number(data.cantidad, 'cantidad', { integer: true, min: 1 });
      if (data.precioUnitarioEsperado !== undefined) {
        const expected = number(data.precioUnitarioEsperado, 'precioUnitarioEsperado', { max: Number.MAX_SAFE_INTEGER / 100 });
        conflict(Math.round(expected * 100) !== Math.round(tipoEntrada.precio * 100), 'El precio cambió. Revisá el nuevo total antes de confirmar.');
      }
      // Se opera en centavos para que los decimales del precio no se acumulen.
      const centavos = Math.round(tipoEntrada.precio * 100) * cantidad;
      if (!Number.isSafeInteger(centavos)) throw new DomainError('El total excede el importe soportado');
      const compra = new Compra({ comprador, evento, tipoEntrada, cantidad,
        total: centavos / 100, estado: EstadoCompra.PENDIENTE });
      compra.registrarEstado(comprador, ahora);
      // Sin await entre comprobación y reserva: operación atómica en este proceso.
      tipoEntrada.reservar(cantidad);
      compras.save(compra);
      if (key) attempts.set(key, { payload: JSON.stringify(data), compra });
      return compra;
    },
    updateState(id, data, actorId) {
      fields(data, ['estado'], ['estado']);
      if (!Object.values(EstadoCompra).includes(data.estado)) throw new DomainError('Estado de compra inválido');
      const compra = get(id, actorId);
      const ahora = now();
      if (data.estado === EstadoCompra.CONFIRMADA && compra.evento.fecha <= ahora) {
        throw new DomainError('No se puede confirmar una compra después del inicio del evento', 409);
      }
      compra.actualizarEstado(data.estado, actor(repositories, actorId), ahora);
      return compras.save(compra);
    },
    cancel(id, data, actorId) {
      fields(data, []);
      const usuario = actor(repositories, actorId);
      const compra = get(id, actorId);
      authorize(usuario.tieneRol(RolUsuario.COMPRADOR) && usuario === compra.comprador,
        'Solo el comprador propietario puede cancelar su compra');
      compra.cancelar(usuario, now());
      return compras.save(compra);
    },
    listMessages(id, actorId) {
      const compra = get(id, actorId);
      return compra.obtenerMensajes(actor(repositories, actorId));
    },
    addMessage(id, data, actorId, { idempotencyKey } = {}) {
      fields(data, ['mensaje'], ['mensaje']);
      const compra = get(id, actorId);
      const usuario = actor(repositories, actorId);
      const contenido = text(data.mensaje, 'mensaje', 2000);
      if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(idempotencyKey))) {
        throw new DomainError('Idempotency-Key debe contener de 1 a 100 letras, números o guiones');
      }
      const key = idempotencyKey && `${compra.id}:${usuario.id}:${idempotencyKey}`;
      const previous = key && messageAttempts.get(key);
      if (previous) {
        conflict(previous.mensaje !== contenido, 'La clave de envío ya corresponde a otro mensaje');
        return previous;
      }
      const mensaje = new Mensaje({ usuario, mensaje: contenido, enviado: now() });
      compra.agregarMensaje(mensaje);
      if (key) messageAttempts.set(key, mensaje);
      return mensaje;
    },
    listHistory: (id, actorId) => [...get(id, actorId).historial],
  };
}
