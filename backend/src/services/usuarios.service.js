import { Usuario } from '../domain/Usuario.js';
import { actor, authorize, conflict, fields, required, text } from './validation.js';

export function createUsuariosService(repositories) {
  const { usuarios, eventos, compras, resenias } = repositories;
  const get = (id) => required(usuarios, id, 'Usuario');
  const own = (id, actorId) => {
    const usuario = get(id);
    authorize(usuario === actor(repositories, actorId));
    return usuario;
  };
  const profile = (data, partial = false) => {
    fields(data, ['nombre', 'apellido'], partial ? [] : ['nombre', 'apellido']);
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, text(value, key)]));
  };

  return {
    list: () => usuarios.findAll(),
    get,
    create: (data) => usuarios.save(new Usuario(profile(data))),
    update(id, data, actorId) {
      const usuario = own(id, actorId);
      Object.assign(usuario, profile(data, true));
      return usuarios.save(usuario);
    },
    delete(id, actorId) {
      const usuario = own(id, actorId);
      conflict(eventos.findByOrganizador(usuario).length || compras.findByComprador(usuario).length
        || resenias.findByComprador(usuario).length, 'No se puede eliminar un usuario con eventos, compras o reseñas');
      usuarios.delete(id);
    },
    listFavorites: (id, actorId) => [...own(id, actorId).favoritos],
    addFavorite(id, eventoId, actorId) {
      const usuario = own(id, actorId);
      usuario.agregarFavorito(required(eventos, eventoId, 'Evento'));
      return [...usuario.favoritos];
    },
    removeFavorite(id, eventoId, actorId) {
      const usuario = own(id, actorId);
      usuario.quitarFavorito(required(eventos, eventoId, 'Evento'));
    },
    listReviews(id) {
      return resenias.findByOrganizador(get(id));
    },
    reputation(id) {
      const usuario = get(id);
      const recibidas = resenias.findByOrganizador(usuario);
      return { usuarioId: id, cantidad: recibidas.length, puntaje: usuario.obtenerPuntaje(recibidas) };
    },
  };
}
