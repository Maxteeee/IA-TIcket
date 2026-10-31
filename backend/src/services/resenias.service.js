import { Resenia } from '../domain/Resenia.js';
import { actor, authorize, conflict, fields, number, required, text } from './validation.js';

export function createReseniasService(repositories, { now }) {
  const { resenias, compras, eventos, usuarios } = repositories;
  const get = (id) => required(resenias, id, 'Reseña');
  const own = (id, actorId) => {
    const resenia = get(id);
    authorize(resenia.comprador === actor(repositories, actorId), 'Solo el autor puede modificar esta reseña');
    return resenia;
  };
  const content = (data) => {
    const result = {};
    if (Object.hasOwn(data, 'detalle')) result.detalle = text(data.detalle, 'detalle', 1500);
    if (Object.hasOwn(data, 'puntuacion')) result.puntuacion = number(data.puntuacion, 'puntuacion', { max: 5 });
    return result;
  };

  return {
    get,
    list(query = {}) {
      fields(query, ['eventoId', 'organizadorId']);
      const evento = query.eventoId === undefined ? null : required(eventos, query.eventoId, 'Evento');
      const organizador = query.organizadorId === undefined ? null : required(usuarios, query.organizadorId, 'Usuario');
      return resenias.findAll().filter((resenia) => (!evento || resenia.evento === evento)
        && (!organizador || resenia.evento.organizador === organizador));
    },
    create(data, actorId) {
      fields(data, ['compraId', 'detalle', 'puntuacion'], ['compraId', 'detalle', 'puntuacion']);
      const comprador = actor(repositories, actorId);
      const compra = required(compras, data.compraId, 'Compra');
      authorize(compra.comprador === comprador, 'Solo el comprador puede reseñar su compra');
      conflict(!compra.puedeReseniar(comprador, now()), 'Para reseñar se requiere una compra utilizada y un evento finalizado con fechaFin');
      return resenias.save(new Resenia({ ...content(data), comprador, evento: compra.evento, compra }));
    },
    update(id, data, actorId) {
      const resenia = own(id, actorId);
      fields(data, ['detalle', 'puntuacion']);
      const changes = content(data);
      Object.assign(resenia, changes);
      return resenias.save(resenia);
    },
    delete(id, actorId) {
      own(id, actorId);
      resenias.delete(id);
    },
  };
}
