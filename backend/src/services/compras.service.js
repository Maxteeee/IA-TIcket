import { Compra } from '../domain/Compra.js';
import { EstadoCompra } from '../domain/EstadoCompra.js';
import { Mensaje } from '../domain/Mensaje.js';
import { DomainError } from '../domain/DomainError.js';
import { actor, authorize, fields, number, required, text } from './validation.js';

export function createComprasService(repositories, { now }) {
  const { compras, eventos } = repositories;
  const get = (id, actorId) => {
    const usuario = actor(repositories, actorId);
    const compra = required(compras, id, 'Compra');
    authorize(compra.esParticipante(usuario), 'Solo los participantes pueden acceder a esta compra');
    return compra;
  };

  return {
    get,
    list(actorId, query = {}) {
      fields(query, ['eventoId', 'estado']);
      const usuario = actor(repositories, actorId);
      let result;
      if (query.eventoId !== undefined) {
        const evento = required(eventos, query.eventoId, 'Evento');
        authorize(evento.organizador === usuario, 'Solo el organizador puede consultar las ventas del evento');
        result = compras.findByEvento(evento);
      } else {
        result = compras.findByComprador(usuario);
      }
      if (query.estado !== undefined) {
        if (!Object.values(EstadoCompra).includes(query.estado)) throw new DomainError('Estado de compra inválido');
        result = result.filter((compra) => compra.estado === query.estado);
      }
      return result;
    },
    create(data, actorId) {
      fields(data, ['eventoId', 'tipoEntradaId', 'cantidad'], ['eventoId', 'tipoEntradaId', 'cantidad']);
      const comprador = actor(repositories, actorId);
      const evento = required(eventos, data.eventoId, 'Evento');
      const ahora = now();
      if (evento.fecha <= ahora) throw new DomainError('No se pueden comprar entradas para un evento iniciado', 409);
      const tipoEntrada = evento.tiposEntrada.find((entrada) => entrada.id === data.tipoEntradaId);
      if (!tipoEntrada) throw new DomainError('Tipo de entrada no encontrado en este evento', 404);
      const cantidad = number(data.cantidad, 'cantidad', { integer: true, min: 1 });
      // Se opera en centavos para que los decimales del precio no se acumulen.
      const centavos = Math.round(tipoEntrada.precio * 100) * cantidad;
      if (!Number.isSafeInteger(centavos)) throw new DomainError('El total excede el importe soportado');
      const compra = new Compra({ comprador, evento, tipoEntrada, cantidad,
        total: centavos / 100, estado: EstadoCompra.PENDIENTE });
      compra.registrarEstado(comprador, ahora);
      // Sin await entre comprobación y reserva: operación atómica en este proceso.
      tipoEntrada.reservar(cantidad);
      return compras.save(compra);
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
    listMessages(id, actorId) {
      const compra = get(id, actorId);
      return compra.obtenerMensajes(actor(repositories, actorId));
    },
    addMessage(id, data, actorId) {
      fields(data, ['mensaje'], ['mensaje']);
      const compra = get(id, actorId);
      const mensaje = new Mensaje({ usuario: actor(repositories, actorId),
        mensaje: text(data.mensaje, 'mensaje', 2000), enviado: now() });
      compra.agregarMensaje(mensaje);
      return mensaje;
    },
    listHistory: (id, actorId) => [...get(id, actorId).historial],
  };
}
