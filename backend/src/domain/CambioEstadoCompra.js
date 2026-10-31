import { EstadoCompra } from './EstadoCompra.js';
import { randomUUID } from 'node:crypto';

export class CambioEstadoCompra {
  /**
   * @param {object} datos
   * @param {import('./Compra.js').Compra} datos.compra
   * @param {import('./EstadoCompra.js').ValorEstadoCompra} datos.estado
   * @param {import('./Usuario.js').Usuario} datos.quien
   * @param {Date} datos.fechaHora
   */
  constructor({ id = randomUUID(), compra, estado, quien, fechaHora }) {
    if (!Object.values(EstadoCompra).includes(estado)) {
      throw new TypeError('Estado de compra inválido');
    }

    this.id = id;
    this.compra = compra;
    this.estado = estado;
    this.quien = quien;
    this.fechaHora = fechaHora;
  }
}
