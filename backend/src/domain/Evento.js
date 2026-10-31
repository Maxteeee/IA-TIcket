import { randomUUID } from 'node:crypto';

export class Evento {
  /**
   * @param {object} datos
   * @param {string} datos.nombre
   * @param {string} datos.descripcion
   * @param {import('./Categoria.js').Categoria} datos.categoria
   * @param {Date} datos.fecha
   * @param {Date|null} [datos.fechaFin] Fin explícito; sin él no se presume finalización.
   * @param {import('./TipoEntrada.js').TipoEntrada[]} datos.tiposEntrada
   * @param {string[]} [datos.multimedia]
   * @param {import('./Usuario.js').Usuario} datos.organizador
   */
  constructor({ id = randomUUID(), nombre, descripcion, categoria, fecha, fechaFin = null, tiposEntrada, multimedia = [], organizador }) {
    if (!Array.isArray(tiposEntrada) || tiposEntrada.length === 0) {
      throw new TypeError('El evento debe ofrecer al menos un tipo de entrada');
    }

    this.id = id;
    this.nombre = nombre;
    this.descripcion = descripcion;
    this.categoria = categoria;
    this.fecha = fecha;
    this.fechaFin = fechaFin;
    this.tiposEntrada = [...tiposEntrada];
    this.multimedia = [...multimedia];
    this.organizador = organizador;
  }

  haFinalizado(ahora = new Date()) {
    return this.fechaFin !== null && this.fechaFin <= ahora;
  }

  rangoPrecios() {
    const precios = this.tiposEntrada.map((entrada) => entrada.precio);
    return { min: Math.min(...precios), max: Math.max(...precios) };
  }
}
