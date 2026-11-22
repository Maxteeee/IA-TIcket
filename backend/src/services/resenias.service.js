import { Resenia } from '../domain/Resenia.js';
import { DomainError } from '../domain/DomainError.js';
import { RolUsuario } from '../domain/RolUsuario.js';
import { actor, authorize, conflict, fields, number, required, text } from './validation.js';

export function createReseniasService(repositories) {
  const { resenias, compras, eventos, usuarios } = repositories;
  const attempts = new Map();
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
      fields(query, ['eventoId', 'organizadorId', 'compraId']);
      const evento = query.eventoId === undefined ? null : required(eventos, query.eventoId, 'Evento');
      const organizador = query.organizadorId === undefined ? null : required(usuarios, query.organizadorId, 'Usuario');
      const compra = query.compraId === undefined ? null : required(compras, query.compraId, 'Compra');
      return resenias.findAll().filter((resenia) => (!evento || resenia.evento === evento)
        && (!organizador || resenia.evento.organizador === organizador) && (!compra || resenia.compra === compra));
    },
    create(data, actorId, { idempotencyKey } = {}) {
      fields(data, ['compraId', 'detalle', 'puntuacion'], ['compraId', 'detalle', 'puntuacion']);
      const comprador = actor(repositories, actorId);
      authorize(comprador.tieneRol(RolUsuario.COMPRADOR), 'Solo un comprador puede publicar una reseña');
      const compra = required(compras, data.compraId, 'Compra');
      authorize(compra.comprador === comprador, 'Solo el comprador puede reseñar su compra');
      const prepared = content(data);
      if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(idempotencyKey))) {
        throw new DomainError('Idempotency-Key debe contener de 1 a 100 letras, números o guiones');
      }
      const key = idempotencyKey && `${comprador.id}:${compra.id}:${idempotencyKey}`;
      const previous = key && attempts.get(key);
      if (previous) {
        conflict(previous.payload !== JSON.stringify(prepared), 'La clave de publicación ya corresponde a otra reseña');
        conflict(!resenias.findById(previous.review.id), 'La reseña anterior ya no está disponible');
        return previous.review;
      }
      conflict(!compra.puedeReseniar(comprador), 'Para reseñar se requiere una compra utilizada');
      const review = resenias.save(new Resenia({ ...prepared, comprador, evento: compra.evento, compra }));
      if (key) attempts.set(key, { payload: JSON.stringify(prepared), review });
      return review;
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
