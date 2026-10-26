import { EstadoCompra } from './EstadoCompra.js';
import { Mensaje } from './Mensaje.js';

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
  constructor({ comprador, evento, tipoEntrada, cantidad, total, estado, mensajes = [], historial = [] }) {
    if (!comprador) {
      throw new TypeError('La compra debe tener un comprador');
    }
    if (!Array.isArray(evento?.tiposEntrada) || !evento.tiposEntrada.includes(tipoEntrada)) {
      throw new TypeError('El tipo de entrada debe pertenecer al evento de la compra');
    }
    if (!Object.values(EstadoCompra).includes(estado)) {
      throw new TypeError('Estado de compra inválido');
    }

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
}
