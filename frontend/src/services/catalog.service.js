import { apiClient, ApiError } from './api.client.js';

const posters = { Música: 'night', Teatro: 'theater', Festivales: 'festival', Conferencias: 'talk', Deportes: 'sport' };
const invalidResponse = () => new ApiError('El servidor devolvió datos de catálogo inválidos.', { code: 'INVALID_RESPONSE' });

export function eventFromDto(dto) {
  if (!dto || typeof dto.id !== 'string' || typeof dto.nombre !== 'string'
    || typeof dto.descripcion !== 'string' || typeof dto.fecha !== 'string' || !Number.isFinite(new Date(dto.fecha).getTime())
    || typeof dto.categoria?.nombre !== 'string' || typeof dto.organizador?.nombre !== 'string'
    || !Array.isArray(dto.tiposEntrada) || !dto.tiposEntrada.length
    || dto.tiposEntrada.some((ticket) => !ticket || typeof ticket.id !== 'string' || typeof ticket.nombre !== 'string'
      || !Number.isFinite(ticket.precio) || ticket.precio < 0 || !Number.isSafeInteger(ticket.cupo) || ticket.cupo < 0)) {
    throw invalidResponse();
  }
  const puntaje = dto.organizador.puntaje ?? null;
  const cantidadResenias = dto.organizador.cantidadResenias ?? 0;
  if (!Number.isSafeInteger(cantidadResenias) || cantidadResenias < 0
    || (puntaje === null ? cantidadResenias !== 0
      : !Number.isFinite(puntaje) || puntaje < 0 || puntaje > 5 || cantidadResenias === 0)) {
    throw invalidResponse();
  }
  const organizerName = `${dto.organizador.nombre} ${dto.organizador.apellido ?? ''}`.trim();
  return {
    id: dto.id, nombre: dto.nombre, descripcion: dto.descripcion,
    categoriaId: dto.categoriaId, categoria: dto.categoria.nombre,
    organizadorId: dto.organizadorId,
    organizador: { id: dto.organizadorId, nombre: organizerName,
      initials: organizerName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
      puntaje, cantidadResenias, resenias: [] },
    fecha: dto.fecha, fechaFin: dto.fechaFin, finalizadoDemo: dto.finalizado,
    tiposEntrada: dto.tiposEntrada.map((ticket) => ({ ...ticket })),
    multimedia: [...(dto.multimedia ?? [])],
    lugar: dto.lugar || 'Lugar a confirmar',
    etiqueta: '', poster: posters[dto.categoria.nombre] ?? 'night', posterTitle: dto.nombre.toUpperCase(),
  };
}

export function previousReviewFromDto(dto) {
  const hasId = (value) => typeof value === 'string' && value.trim().length > 0;
  const hasDate = (value) => typeof value === 'string' && Number.isFinite(new Date(value).getTime());
  if (!dto || !hasId(dto.id) || !hasId(dto.compradorId) || !hasId(dto.eventoId)
    || !Number.isFinite(dto.puntuacion) || dto.puntuacion < 0 || dto.puntuacion > 5
    || typeof dto.detalle !== 'string' || !dto.detalle.trim()
    || dto.comprador?.id !== dto.compradorId || typeof dto.comprador?.nombre !== 'string' || !dto.comprador.nombre.trim()
    || typeof dto.comprador.apellido !== 'string' || dto.evento?.id !== dto.eventoId
    || typeof dto.evento?.nombre !== 'string' || !dto.evento.nombre.trim() || !hasId(dto.evento.organizadorId)
    || !hasDate(dto.evento.fecha) || (dto.evento.fechaFin !== null && (!hasDate(dto.evento.fechaFin)
      || new Date(dto.evento.fechaFin) < new Date(dto.evento.fecha)))) throw invalidResponse();
  return { id: dto.id, compradorId: dto.compradorId, eventoId: dto.eventoId,
    autor: `${dto.comprador.nombre} ${dto.comprador.apellido}`.trim(),
    puntuacion: dto.puntuacion, detalle: dto.detalle,
    evento: { ...dto.evento } };
}

export function createCatalogService(client = apiClient) {
  return {
    async getCategories(options) {
      const categories = await client.get('/categorias', options);
      if (!Array.isArray(categories) || categories.some((category) => !category || typeof category.id !== 'string' || typeof category.nombre !== 'string')) {
        throw invalidResponse();
      }
      return categories.map(({ id, nombre }) => ({ id, nombre }));
    },
    async getEvents({ search = '', category = 'Todos', sort = 'fecha' } = {}, options) {
      const query = new URLSearchParams();
      query.set('orden', sort);
      if (search.trim()) query.set('q', search.trim());
      if (category !== 'Todos') query.set('categoriaId', category);
      const suffix = query.toString();
      const events = await client.get(`/eventos${suffix ? `?${suffix}` : ''}`, options);
      if (!Array.isArray(events)) throw invalidResponse();
      return events.map(eventFromDto);
    },
    async getEvent(id, options) {
      return eventFromDto(await client.get(`/eventos/${encodeURIComponent(id)}`, options));
    },
    async getPreviousReviews(id, options) {
      const reviews = await client.get(`/eventos/${encodeURIComponent(id)}/experiencias-anteriores`, options);
      if (!Array.isArray(reviews)) throw invalidResponse();
      return reviews.map(previousReviewFromDto);
    },
  };
}

export const catalogService = createCatalogService();
