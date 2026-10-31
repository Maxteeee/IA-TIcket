import { randomUUID } from 'node:crypto';
import { DomainError } from './DomainError.js';

export class Resenia {
  /**
   * @param {object} datos
   * @param {import('./Usuario.js').Usuario} datos.comprador
   * @param {import('./Evento.js').Evento} datos.evento
   * @param {import('./Compra.js').Compra|null} [datos.compra] Acredita la asistencia al crear por API.
   * @param {string} datos.detalle
   * @param {number} datos.puntuacion
   */
  constructor({ id = randomUUID(), comprador, evento, compra = null, detalle, puntuacion }) {
    if (typeof puntuacion !== 'number' || !Number.isFinite(puntuacion) || puntuacion < 0 || puntuacion > 5) {
      throw new DomainError('La puntuación debe estar entre 0 y 5');
    }
    this.id = id;
    this.compra = compra;
    this.comprador = comprador;
    this.evento = evento;
    this.detalle = detalle;
    this.puntuacion = puntuacion;
  }
}
