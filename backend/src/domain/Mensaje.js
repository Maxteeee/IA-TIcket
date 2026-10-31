import { randomUUID } from 'node:crypto';

export class Mensaje {
  /**
   * @param {object} datos
   * @param {import('./Usuario.js').Usuario} datos.usuario
   * @param {string} datos.mensaje
   * @param {Date} datos.enviado
   */
  constructor({ id = randomUUID(), usuario, mensaje, enviado }) {
    this.id = id;
    this.usuario = usuario;
    this.mensaje = mensaje;
    this.enviado = enviado;
  }
}
