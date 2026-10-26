import { Evento } from './Evento.js';

export class Usuario {
  /**
   * @param {object} datos
   * @param {string} datos.nombre
   * @param {string} datos.apellido
   * @param {import('./Evento.js').Evento[]} [datos.favoritos]
   */
  constructor({ nombre, apellido, favoritos = [] }) {
    this.nombre = nombre;
    this.apellido = apellido;
    this.favoritos = [];
    for (const evento of favoritos) {
      this.agregarFavorito(evento);
    }
  }

  /** @param {import('./Evento.js').Evento} evento */
  agregarFavorito(evento) {
    if (!(evento instanceof Evento)) {
      throw new TypeError('Se debe proporcionar un Evento');
    }
    if (!this.tieneFavorito(evento)) {
      this.favoritos.push(evento);
    }
  }

  /** @param {import('./Evento.js').Evento} evento */
  quitarFavorito(evento) {
    const indice = this.favoritos.indexOf(evento);
    if (indice !== -1) {
      this.favoritos.splice(indice, 1);
    }
  }

  /**
   * @param {import('./Evento.js').Evento} evento
   * @returns {boolean}
   */
  tieneFavorito(evento) {
    return this.favoritos.includes(evento);
  }

  /**
   * Obtiene la base de la reputación sin asumir una fórmula de puntuación.
   * @param {import('./Resenia.js').Resenia[]} resenias
   * @returns {import('./Resenia.js').Resenia[]}
   */
  obtenerReseniasRecibidas(resenias) {
    return resenias.filter((resenia) => resenia.evento.organizador === this);
  }
}
