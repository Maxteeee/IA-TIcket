import { apiClient, ApiError } from './api.client.js';
import { eventFromDto } from './catalog.service.js';
import { canOrganize } from '../session/permissions.js';

export function createEventsService(client = apiClient) {
  const requireOrganizer = (session) => {
    if (!canOrganize(session)) throw new ApiError('Solo un organizador puede publicar eventos.', { status: 403 });
    return session.usuario.id;
  };
  return {
    async create(data, session, { signal, idempotencyKey } = {}) {
      const usuarioId = requireOrganizer(session);
      const event = eventFromDto(await client.post('/eventos', data, { usuarioId, signal, idempotencyKey }));
      if (event.organizadorId !== usuarioId) {
        throw new ApiError('El servidor devolvió una publicación de otro organizador.', { code: 'INVALID_RESPONSE' });
      }
      return event;
    },
    async listOwn(session, options) {
      const usuarioId = requireOrganizer(session);
      const query = new URLSearchParams({ organizadorId: usuarioId, incluirPasados: 'true' });
      const events = await client.get(`/eventos?${query}`, options);
      if (!Array.isArray(events) || events.some((event) => !event || event.organizadorId !== usuarioId)) {
        throw new ApiError('El servidor devolvió una lista de eventos inválida.', { code: 'INVALID_RESPONSE' });
      }
      return events.map(eventFromDto);
    },
  };
}

export const eventsService = createEventsService();
