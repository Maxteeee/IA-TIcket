import { EstadoCompra } from './EstadoCompra.js';
import { Mensaje } from './Mensaje.js';
import { randomUUID } from 'node:crypto';
import { CambioEstadoCompra } from './CambioEstadoCompra.js';
import { DomainError } from './DomainError.js';

export class Compra {
  /**
   * @param {object} datos
   * @param {import('./Usuario.js').Usuario} datos.comprador
   * @param {import('./Evento.js').Evento} datos.evento
   * @param {import('./TipoEntrada.js').TipoEntrada} datos.tipoEntrada
   * @param {number} datos.cantidad Cantidad entera de entradas.
   * @param {number} datos.total
   * @param {import('./EstadoCompra.js').ValorEstadoCompra} datos.estado
   * @param {import('./Mensaje.js').Mensaje[]} [datos.mensajes]
   * @param {import('./CambioEstadoCompra.js').CambioEstadoCompra[]} [datos.historial]
   */
  constructor({ id = randomUUID(), comprador, evento, tipoEntrada, cantidad, total, estado, mensajes = [], historial = [] }) {
    if (!comprador) {
      throw new TypeError('La compra debe tener un comprador');
    }
    if (!Array.isArray(evento?.tiposEntrada) || !evento.tiposEntrada.includes(tipoEntrada)) {
      throw new TypeError('El tipo de entrada debe pertenecer al evento de la compra');
    }
    if (!Object.values(EstadoCompra).includes(estado)) {
      throw new TypeError('Estado de compra inválido');
    }
    if (!Number.isSafeInteger(cantidad) || cantidad <= 0) {
      throw new DomainError('La cantidad debe ser un entero positivo');
    }
    if (typeof total !== 'number' || !Number.isFinite(total) || total < 0 || total > Number.MAX_SAFE_INTEGER) {
      throw new DomainError('El total de la compra es inválido');
    }

    this.id = id;
    this.comprador = comprador;
    this.evento = evento;
    this.tipoEntrada = tipoEntrada;
    this.cantidad = cantidad;
    this.total = total;
    this.estado = estado;
    this.mensajes = [];
    this.historial = [...historial];

    for (const mensaje of mensajes) {
      this.agregarMensaje(mensaje);
    }
  }

  /**
   * Las relaciones del modelo en memoria se comparan por identidad de objeto.
   * @param {import('./Usuario.js').Usuario} usuario
   * @returns {boolean}
   */
  esParticipante(usuario) {
    return Boolean(usuario)
      && (usuario === this.comprador || usuario === this.evento.organizador);
  }

  /** @param {Mensaje} mensaje */
  agregarMensaje(mensaje) {
    if (!(mensaje instanceof Mensaje)) {
      throw new TypeError('Se debe proporcionar un Mensaje');
    }
    if (!this.esParticipante(mensaje.usuario)) {
      throw new Error('Solo el comprador y el organizador pueden enviar mensajes en esta compra');
    }
    this.mensajes.push(mensaje);
  }

  /**
   * @param {import('./Usuario.js').Usuario} usuario
   * @returns {Mensaje[]}
   */
  obtenerMensajes(usuario) {
    if (!this.esParticipante(usuario)) {
      throw new Error('Solo el comprador y el organizador pueden consultar los mensajes de esta compra');
    }
    return [...this.mensajes];
  }

  registrarEstado(quien, fechaHora) {
    this.historial.push(new CambioEstadoCompra({ compra: this, estado: this.estado, quien, fechaHora }));
  }

  actualizarEstado(estado, quien, fechaHora) {
    if (!Object.values(EstadoCompra).includes(estado)) {
      throw new DomainError('Estado de compra inválido');
    }
    if (quien !== this.evento.organizador) {
      throw new DomainError('Solo el organizador puede confirmar o utilizar entradas', 403);
    }
    const siguiente = {
      [EstadoCompra.PENDIENTE]: EstadoCompra.CONFIRMADA,
      [EstadoCompra.CONFIRMADA]: EstadoCompra.UTILIZADA,
    };
    if (siguiente[this.estado] !== estado) {
      throw new DomainError('Transición de estado no permitida; cancelación y reembolso siguen pendientes de definición', 409);
    }
    this.estado = estado;
    this.registrarEstado(quien, fechaHora);
  }

  puedeReseniar(usuario, ahora) {
    return usuario === this.comprador
      && this.estado === EstadoCompra.UTILIZADA
      && this.evento.haFinalizado(ahora);
  }

  diasRestantes(ahora = new Date()) {
    return this.estado === EstadoCompra.CONFIRMADA
      ? Math.max(0, Math.ceil((this.evento.fecha - ahora) / 86400000))
      : null;
  }
}
