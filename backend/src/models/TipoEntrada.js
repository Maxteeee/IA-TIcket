export class TipoEntrada {
  /**
   * @param {object} datos
   * @param {string} datos.nombre
   * @param {string} datos.descripcion
   * @param {number} datos.precio
   * @param {number} datos.cupo Cantidad entera de entradas.
   */
  constructor({ nombre, descripcion, precio, cupo }) {
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
}
