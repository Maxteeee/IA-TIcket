import { Evento } from '../domain/Evento.js';
import { TipoEntrada } from '../domain/TipoEntrada.js';
import { DomainError } from '../domain/DomainError.js';
import { RolUsuario } from '../domain/RolUsuario.js';
import { actor, authorize, conflict, date, fields, normalize, number, required, text } from './validation.js';

export function createEventosService(repositories, { now }) {
  const { eventos, categorias, compras, resenias, usuarios } = repositories;
  const publications = new Map();
  const get = (id) => required(eventos, id, 'Evento');
  const reputation = (organizador) => {
    const recibidas = resenias.findByOrganizador(organizador);
    return { puntaje: organizador.obtenerPuntaje(recibidas), cantidadResenias: recibidas.length };
  };
  const own = (id, actorId) => {
    const evento = get(id);
    authorize(evento.organizador === actor(repositories, actorId), 'Solo el organizador puede gestionar este evento');
    return evento;
  };
  const ticket = (data, partial = false) => {
    fields(data, ['nombre', 'descripcion', 'precio', 'cupo'], partial ? [] : ['nombre', 'precio', 'cupo']);
    const result = {};
    if (Object.hasOwn(data, 'nombre')) result.nombre = text(data.nombre, 'nombre');
    if (Object.hasOwn(data, 'descripcion')) result.descripcion = text(data.descripcion, 'descripcion', 1500, true);
    if (Object.hasOwn(data, 'precio')) {
      result.precio = number(data.precio, 'precio', { max: Number.MAX_SAFE_INTEGER / 100 });
      if (Math.abs(Math.round(result.precio * 100) / 100 - result.precio) > 1e-8) {
        throw new DomainError('El precio admite hasta dos decimales');
      }
    }
    if (Object.hasOwn(data, 'cupo')) result.cupo = number(data.cupo, 'cupo', { integer: true });
    return result;
  };
  const values = (data, partial = false) => {
    const allowed = ['nombre', 'descripcion', 'categoriaId', 'fecha', 'fechaFin', 'multimedia'];
    fields(data, partial ? allowed : [...allowed, 'tiposEntrada'], partial ? []
      : ['nombre', 'descripcion', 'categoriaId', 'fecha', 'tiposEntrada']);
    const result = {};
    if (Object.hasOwn(data, 'nombre')) result.nombre = text(data.nombre, 'nombre');
    if (Object.hasOwn(data, 'descripcion')) result.descripcion = text(data.descripcion, 'descripcion', 1500);
    if (Object.hasOwn(data, 'categoriaId')) result.categoria = required(categorias, data.categoriaId, 'Categoría');
    if (Object.hasOwn(data, 'fecha')) result.fecha = date(data.fecha, 'fecha');
    if (Object.hasOwn(data, 'fechaFin')) result.fechaFin = data.fechaFin === null ? null : date(data.fechaFin, 'fechaFin');
    if (Object.hasOwn(data, 'multimedia')) {
      if (!Array.isArray(data.multimedia) || data.multimedia.length > 20) {
        throw new DomainError('multimedia debe ser un arreglo de hasta 20 referencias');
      }
      result.multimedia = data.multimedia.map((value) => text(value, 'multimedia', 2048));
    }
    if (!partial) {
      if (!Array.isArray(data.tiposEntrada) || !data.tiposEntrada.length) {
        throw new DomainError('El evento debe ofrecer al menos un tipo de entrada');
      }
      result.tiposEntrada = data.tiposEntrada.map((value) => new TipoEntrada({ descripcion: '', ...ticket(value) }));
    }
    return result;
  };
  const validateDates = ({ fecha, fechaFin }) => {
    if (fechaFin !== null && fechaFin <= fecha) throw new DomainError('fechaFin debe ser posterior a fecha');
  };
  const getTicket = (evento, id) => {
    const entrada = evento.tiposEntrada.find((value) => value.id === id);
    if (!entrada) throw new DomainError('Tipo de entrada no encontrado en este evento', 404);
    return entrada;
  };

  return {
    get,
    getReputation: (evento) => reputation(evento.organizador),
    list(query = {}) {
      fields(query, ['q', 'categoriaId', 'organizadorId', 'orden', 'incluirPasados']);
      const q = query.q === undefined ? '' : normalize(text(query.q, 'q', 200, true));
      const orden = query.orden ?? 'fecha';
      if (!['fecha', 'precio', 'puntaje'].includes(orden)) throw new DomainError('orden debe ser fecha, precio o puntaje');
      if (query.incluirPasados !== undefined && !['true', 'false'].includes(query.incluirPasados)) {
        throw new DomainError('incluirPasados debe ser true o false');
      }
      const categoria = query.categoriaId === undefined ? null : required(categorias, query.categoriaId, 'Categoría');
      const organizador = query.organizadorId === undefined ? null : required(usuarios, query.organizadorId, 'Usuario');
      const ahora = now();
      const puntajes = new Map(usuarios.findAll().map((usuario) => [usuario, reputation(usuario).puntaje]));
      return eventos.findAll().filter((evento) => (query.incluirPasados === 'true' || evento.fecha > ahora)
        && (!categoria || evento.categoria === categoria)
        && (!organizador || evento.organizador === organizador)
        && (!q || normalize(`${evento.nombre} ${evento.descripcion} ${evento.categoria.nombre}`).includes(q)))
        .sort((a, b) => {
          const desempate = a.fecha - b.fecha || a.id.localeCompare(b.id);
          if (orden === 'precio') return a.rangoPrecios().min - b.rangoPrecios().min || desempate;
          if (orden === 'puntaje') {
            const first = puntajes.get(a.organizador);
            const second = puntajes.get(b.organizador);
            if (first === null && second === null) return desempate;
            if (first === null) return 1;
            if (second === null) return -1;
            return second - first || desempate;
          }
          return desempate;
        });
    },
    create(data, actorId, { idempotencyKey } = {}) {
      const organizador = actor(repositories, actorId);
      authorize(organizador.tieneRol(RolUsuario.ORGANIZADOR), 'Solo un organizador puede publicar eventos');
      if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(idempotencyKey))) {
        throw new DomainError('Idempotency-Key debe contener de 1 a 100 letras, números o guiones');
      }
      const key = idempotencyKey && `${organizador.id}:${idempotencyKey}`;
      const previous = key && publications.get(key);
      if (previous) {
        conflict(previous.payload !== JSON.stringify(data), 'La clave de publicación ya corresponde a otro contenido');
        conflict(!eventos.findById(previous.evento.id), 'La publicación anterior ya no está disponible');
        return previous.evento;
      }
      const prepared = { fechaFin: null, ...values(data) };
      validateDates(prepared);
      if (prepared.fecha <= now()) throw new DomainError('La fecha del evento debe ser futura');
      const evento = eventos.save(new Evento({ ...prepared, organizador }));
      if (key) publications.set(key, { payload: JSON.stringify(data), evento });
      return evento;
    },
    update(id, data, actorId) {
      const evento = own(id, actorId);
      const changes = values(data, true);
      const prepared = { ...evento, ...changes };
      validateDates(prepared);
      if (changes.fecha && changes.fecha.getTime() !== evento.fecha.getTime()) {
        conflict(compras.findByEvento(evento).length, 'No se puede reprogramar un evento con compras');
        if (changes.fecha <= now()) throw new DomainError('La fecha del evento debe ser futura');
      }
      Object.assign(evento, changes);
      return eventos.save(evento);
    },
    delete(id, actorId) {
      const evento = own(id, actorId);
      conflict(compras.findByEvento(evento).length || resenias.findByEvento(evento).length,
        'No se puede eliminar un evento con compras o reseñas');
      for (const usuario of usuarios.findAll()) usuario.quitarFavorito(evento);
      eventos.delete(id);
    },
    listTickets: (id) => [...get(id).tiposEntrada],
    getTicket: (id, tipoEntradaId) => getTicket(get(id), tipoEntradaId),
    addTicket(id, data, actorId) {
      const evento = own(id, actorId);
      const entrada = new TipoEntrada({ descripcion: '', ...ticket(data) });
      evento.tiposEntrada.push(entrada);
      return entrada;
    },
    updateTicket(id, tipoEntradaId, data, actorId) {
      const entrada = getTicket(own(id, actorId), tipoEntradaId);
      const changes = ticket(data, true);
      Object.assign(entrada, changes);
      return entrada;
    },
    deleteTicket(id, tipoEntradaId, actorId) {
      const evento = own(id, actorId);
      const entrada = getTicket(evento, tipoEntradaId);
      conflict(evento.tiposEntrada.length === 1, 'El evento debe conservar al menos un tipo de entrada');
      conflict(compras.findByEvento(evento).some((compra) => compra.tipoEntrada === entrada),
        'No se puede eliminar un tipo de entrada con compras');
      evento.tiposEntrada.splice(evento.tiposEntrada.indexOf(entrada), 1);
    },
    listReviews: (id) => resenias.findByEvento(get(id)),
    previousReviews(id) {
      const evento = get(id);
      const ahora = now();
      return resenias.findByOrganizador(evento.organizador).filter((resenia) => resenia.evento !== evento
        && resenia.evento.fecha < evento.fecha && resenia.evento.haFinalizado(ahora));
    },
  };
}
