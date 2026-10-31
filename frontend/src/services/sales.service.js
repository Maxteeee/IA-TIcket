import { apiClient, ApiError } from './api.client.js';
import { canOrganize } from '../session/permissions.js';
import { purchaseFromDto } from './purchases.service.js';

const invalid = () => new ApiError('El servidor devolvió datos de ventas inválidos.', { code: 'INVALID_RESPONSE' });

export function salesFromDto(dto, eventId, organizerId) {
  const event = dto?.evento;
  if (!event || event.id !== eventId || event.organizadorId !== organizerId
    || typeof event.nombre !== 'string' || !event.nombre.trim()
    || typeof event.fecha !== 'string' || !Number.isFinite(new Date(event.fecha).getTime())
    || !Array.isArray(event.tiposEntrada) || !event.tiposEntrada.length
    || event.tiposEntrada.some((ticket) => !ticket || typeof ticket.id !== 'string' || !ticket.id
      || typeof ticket.nombre !== 'string' || !ticket.nombre.trim()
      || !Number.isFinite(ticket.precio) || ticket.precio < 0 || !Number.isSafeInteger(ticket.cupo) || ticket.cupo < 0)
    || !Array.isArray(dto.compras)) throw invalid();
  const ticketIds = new Set(event.tiposEntrada.map((ticket) => ticket.id));
  if (ticketIds.size !== event.tiposEntrada.length) throw invalid();
  const purchases = dto.compras.map((item) => {
    const purchase = purchaseFromDto(item);
    if (purchase.eventoId !== eventId || !ticketIds.has(purchase.tipoEntradaId)
      || purchase.evento.nombre !== event.nombre || purchase.evento.fecha !== event.fecha || purchase.evento.organizadorId !== organizerId
      || item.comprador?.id !== purchase.compradorId || typeof item.comprador?.nombre !== 'string'
      || !item.comprador.nombre.trim() || typeof item.comprador.apellido !== 'string') throw invalid();
    return { ...purchase, comprador: { id: item.comprador.id, nombre: item.comprador.nombre, apellido: item.comprador.apellido } };
  });
  if (new Set(purchases.map((purchase) => purchase.id)).size !== purchases.length) throw invalid();
  return { evento: { id: event.id, nombre: event.nombre, fecha: event.fecha, organizadorId: event.organizadorId,
    tiposEntrada: event.tiposEntrada.map(({ id, nombre, precio, cupo }) => ({ id, nombre, precio, cupo })) }, compras: purchases };
}

export function createSalesService(client = apiClient) {
  return {
    async getEventSales(eventId, session, { signal } = {}) {
      if (!canOrganize(session)) throw new ApiError('Necesitás un perfil organizador para consultar las ventas.', { status: 403 });
      if (typeof eventId !== 'string' || !eventId.trim()) throw new ApiError('Indicá el evento que querés consultar.', { status: 400 });
      const dto = await client.get(`/eventos/${encodeURIComponent(eventId)}/ventas`, { usuarioId: session.usuario.id, signal });
      return salesFromDto(dto, eventId, session.usuario.id);
    },
  };
}

export const salesService = createSalesService();
