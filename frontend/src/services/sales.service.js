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
  const changes = new Map();
  const purchaseForEvent = (dto, purchaseId, eventId, organizerId) => {
    const purchase = purchaseFromDto(dto);
    if (purchase.id !== purchaseId) throw invalid();
    if (purchase.eventoId !== eventId || purchase.evento.organizadorId !== organizerId) {
      throw new ApiError('Solo podés gestionar compras de este evento propio.', { status: 403 });
    }
    return purchase;
  };
  return {
    async getEventSales(eventId, session, { signal } = {}) {
      if (!canOrganize(session)) throw new ApiError('Necesitás un perfil organizador para consultar las ventas.', { status: 403 });
      if (typeof eventId !== 'string' || !eventId.trim()) throw new ApiError('Indicá el evento que querés consultar.', { status: 400 });
      const dto = await client.get(`/eventos/${encodeURIComponent(eventId)}/ventas`, { usuarioId: session.usuario.id, signal });
      return salesFromDto(dto, eventId, session.usuario.id);
    },
    updatePurchaseState(eventId, purchaseId, estado, session, { signal } = {}) {
      if (!canOrganize(session)) throw new ApiError('Necesitás un perfil organizador para gestionar las compras.', { status: 403 });
      if ([eventId, purchaseId].some((id) => typeof id !== 'string' || !id.trim())) {
        throw new ApiError('Indicá el evento y la compra que querés gestionar.', { status: 400 });
      }
      if (!['CONFIRMADA', 'UTILIZADA'].includes(estado)) throw new ApiError('Solo podés confirmar el pago simulado o marcar la compra como utilizada.', { status: 400 });
      const previousState = estado === 'CONFIRMADA' ? 'PENDIENTE' : 'CONFIRMADA';
      const usuarioId = session.usuario.id;
      const key = JSON.stringify([usuarioId, eventId, purchaseId]);
      const existing = changes.get(key);
      if (existing) {
        if (existing.estado !== estado) throw new ApiError('Esperá a que termine el cambio de esta compra.', { status: 409 });
        return existing.promise;
      }
      const path = `/compras/${encodeURIComponent(purchaseId)}`;
      const options = { usuarioId, signal };
      const attempt = { estado, promise: null };
      attempt.promise = Promise.resolve().then(() => client.get(path, options)).then(async (dto) => {
        const current = purchaseForEvent(dto, purchaseId, eventId, usuarioId);
        // Una respuesta perdida se recupera consultando el estado, sin repetir la transición.
        if (current.estado === estado) return current;
        if (current.estado !== previousState) throw new ApiError('La compra cambió de estado. Actualizá las compras antes de continuar.', { status: 409 });
        const updated = purchaseForEvent(await client.patch(`${path}/estado`, { estado }, options), purchaseId, eventId, usuarioId);
        if (updated.estado !== estado || ['compradorId', 'tipoEntradaId', 'cantidad', 'precioUnitario', 'total', 'tipoEntradaNombre']
          .some((field) => updated[field] !== current[field])) throw invalid();
        return updated;
      }).finally(() => { changes.delete(key); });
      changes.set(key, attempt);
      return attempt.promise;
    },
  };
}

export const salesService = createSalesService();
