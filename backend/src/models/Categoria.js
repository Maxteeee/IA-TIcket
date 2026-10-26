export class Categoria {
  /**
   * @param {object} datos
   * @param {string} datos.nombre
   * @param {string} datos.descripcion
   */
  constructor({ nombre, descripcion }) {
    this.nombre = nombre;
    this.descripcion = descripcion;
  }
}
