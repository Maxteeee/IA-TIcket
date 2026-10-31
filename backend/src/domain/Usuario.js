import { Evento } from './Evento.js';
import { randomUUID } from 'node:crypto';
import { RolUsuario } from './RolUsuario.js';
import { DomainError } from './DomainError.js';

export class Usuario {
  /**
   * @param {object} datos
   * @param {string} datos.nombre
   * @param {string} datos.apellido
   * @param {import('./Evento.js').Evento[]} [datos.favoritos]
   * @param {string[]} [datos.roles] Capacidades no excluyentes; se asignan en el servidor.
   */
  constructor({ id = randomUUID(), nombre, apellido, favoritos = [], roles = [RolUsuario.COMPRADOR] }) {
    if (!Array.isArray(roles) || roles.some((rol) => !Object.values(RolUsuario).includes(rol))) {
      throw new DomainError('Roles de usuario inválidos');
    }
    this.id = id;
    this.nombre = nombre;
    this.apellido = apellido;
    this.roles = [...new Set(roles)];
    this.favoritos = [];
    for (const evento of favoritos) {
      this.agregarFavorito(evento);
    }
  }

  tieneRol(rol) {
    return this.roles.includes(rol);
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

  obtenerPuntaje(resenias) {
    const recibidas = this.obtenerReseniasRecibidas(resenias);
    return recibidas.length
      ? recibidas.reduce((total, resenia) => total + resenia.puntuacion, 0) / recibidas.length
      : null;
  }
}
