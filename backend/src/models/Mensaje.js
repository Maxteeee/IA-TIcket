export class Mensaje {
  /**
   * @param {object} datos
   * @param {import('./Usuario.js').Usuario} datos.usuario
   * @param {string} datos.mensaje
   * @param {Date} datos.enviado
   */
  constructor({ usuario, mensaje, enviado }) {
    this.usuario = usuario;
    this.mensaje = mensaje;
    this.enviado = enviado;
  }
}
