import { randomUUID } from 'node:crypto';

export class Categoria {
  /**
   * @param {object} datos
   * @param {string} datos.nombre
   * @param {string} datos.descripcion
   */
  constructor({ id = randomUUID(), nombre, descripcion }) {
    this.id = id;
    this.nombre = nombre;
    this.descripcion = descripcion;
  }
}
