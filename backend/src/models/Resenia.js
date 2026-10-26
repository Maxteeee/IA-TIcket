export class Resenia {
  /**
   * @param {object} datos
   * @param {import('./Usuario.js').Usuario} datos.comprador
   * @param {import('./Evento.js').Evento} datos.evento
   * @param {string} datos.detalle
   * @param {number} datos.puntuacion
   */
  constructor({ comprador, evento, detalle, puntuacion }) {
    this.comprador = comprador;
    this.evento = evento;
    this.detalle = detalle;
    this.puntuacion = puntuacion;
  }
}
