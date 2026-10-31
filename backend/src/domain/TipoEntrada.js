import { randomUUID } from 'node:crypto';
import { DomainError } from './DomainError.js';

export class TipoEntrada {
  /**
   * @param {object} datos
   * @param {string} datos.nombre
   * @param {string} datos.descripcion
   * @param {number} datos.precio
   * @param {number} datos.cupo Cantidad entera de entradas.
   */
  constructor({ id = randomUUID(), nombre, descripcion, precio, cupo }) {
    this.id = id;
    this.nombre = nombre;
    this.descripcion = descripcion;
    this.precio = precio;
    this.cupo = cupo;
  }

  /**
   * Consulta la disponibilidad actual sin reservar ni descontar entradas.
   * @param {number} cantidad
   * @returns {boolean}
   */
  hayCupoPara(cantidad) {
    return Number.isInteger(cantidad)
      && cantidad > 0
      && Number.isInteger(this.cupo)
      && cantidad <= this.cupo;
  }

  reservar(cantidad) {
    if (!this.hayCupoPara(cantidad)) throw new DomainError('No hay cupo suficiente', 409);
    this.cupo -= cantidad;
  }
}
