export class Evento {
  /**
   * @param {object} datos
   * @param {string} datos.nombre
   * @param {string} datos.descripcion
   * @param {import('./Categoria.js').Categoria} datos.categoria
   * @param {Date} datos.fecha
   * @param {import('./TipoEntrada.js').TipoEntrada[]} datos.tiposEntrada
   * @param {string[]} [datos.multimedia]
   * @param {import('./Usuario.js').Usuario} datos.organizador
   */
  constructor({ nombre, descripcion, categoria, fecha, tiposEntrada, multimedia = [], organizador }) {
    if (!Array.isArray(tiposEntrada) || tiposEntrada.length === 0) {
      throw new TypeError('El evento debe ofrecer al menos un tipo de entrada');
    }

    this.nombre = nombre;
    this.descripcion = descripcion;
    this.categoria = categoria;
    this.fecha = fecha;
    this.tiposEntrada = [...tiposEntrada];
    this.multimedia = [...multimedia];
    this.organizador = organizador;
  }
}
