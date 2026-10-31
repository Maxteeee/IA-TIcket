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
  const organizerName = `${dto.organizador.nombre} ${dto.organizador.apellido ?? ''}`.trim();
  return {
    id: dto.id, nombre: dto.nombre, descripcion: dto.descripcion,
    categoriaId: dto.categoriaId, categoria: dto.categoria.nombre,
    organizadorId: dto.organizadorId,
    organizador: { id: dto.organizadorId, nombre: organizerName,
      initials: organizerName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), resenias: [] },
    fecha: dto.fecha, fechaFin: dto.fechaFin, finalizadoDemo: dto.finalizado,
    tiposEntrada: dto.tiposEntrada.map((ticket) => ({ ...ticket })),
    multimedia: [...(dto.multimedia ?? [])],
    lugar: dto.lugar || 'Lugar a confirmar',
    etiqueta: '', poster: posters[dto.categoria.nombre] ?? 'night', posterTitle: dto.nombre.toUpperCase(),
  };
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
    async getEvents({ search = '', category = 'Todos' } = {}, options) {
      const query = new URLSearchParams();
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
  };
}

export const catalogService = createCatalogService();
