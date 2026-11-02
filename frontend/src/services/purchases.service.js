import { apiClient, ApiError } from './api.client.js';
import { hasRole } from '../session/permissions.js';
import { RolUsuario } from '../session/roles.js';

const invalid = () => new ApiError('El servidor devolvió una compra inválida.', { code: 'INVALID_RESPONSE' });

export function purchaseFromDto(dto) {
  if (!dto || ['id', 'compradorId', 'eventoId', 'tipoEntradaId', 'tipoEntradaNombre'].some((key) => typeof dto[key] !== 'string' || !dto[key])
    || !Number.isSafeInteger(dto.cantidad) || dto.cantidad < 1
    || !Number.isFinite(dto.precioUnitario) || dto.precioUnitario < 0
    || !Number.isFinite(dto.total) || dto.total < 0
    || !Number.isSafeInteger(Math.round(dto.precioUnitario * 100) * dto.cantidad)
    || Math.round(dto.precioUnitario * 100) * dto.cantidad !== Math.round(dto.total * 100)
    || !['PENDIENTE', 'CONFIRMADA', 'UTILIZADA', 'CANCELADA', 'REEMBOLSADA'].includes(dto.estado)
    || (dto.estado === 'CONFIRMADA' ? !Number.isSafeInteger(dto.diasRestantes) || dto.diasRestantes < 0 : dto.diasRestantes !== null)
    || dto.evento?.id !== dto.eventoId || typeof dto.evento?.nombre !== 'string' || !dto.evento.nombre.trim()
    || typeof dto.evento?.fecha !== 'string' || !Number.isFinite(new Date(dto.evento.fecha).getTime())
    || typeof dto.evento?.organizadorId !== 'string' || !dto.evento.organizadorId
    || typeof dto.puedeReseniar !== 'boolean' || (dto.puedeReseniar && dto.estado !== 'UTILIZADA')
    || typeof dto.puedeCancelar !== 'boolean' || (dto.puedeCancelar && !['PENDIENTE', 'CONFIRMADA'].includes(dto.estado))) throw invalid();
  if (dto.reembolso !== null && (dto.estado !== 'REEMBOLSADA' || !dto.reembolso || dto.reembolso.simulado !== true
    || !Number.isFinite(dto.reembolso.importe) || dto.reembolso.importe < 0 || dto.reembolso.importe !== dto.total
    || typeof dto.reembolso.fecha !== 'string' || !Number.isFinite(new Date(dto.reembolso.fecha).getTime()))) throw invalid();
  return { id: dto.id, compradorId: dto.compradorId, eventoId: dto.eventoId, tipoEntradaId: dto.tipoEntradaId,
    tipoEntradaNombre: dto.tipoEntradaNombre, precioUnitario: dto.precioUnitario,
    cantidad: dto.cantidad, total: dto.total, estado: dto.estado, diasRestantes: dto.diasRestantes, puedeReseniar: dto.puedeReseniar,
    puedeCancelar: dto.puedeCancelar,
    reembolso: dto.reembolso ? { importe: dto.reembolso.importe, fecha: dto.reembolso.fecha, simulado: true } : null,
    evento: { id: dto.evento.id, nombre: dto.evento.nombre, fecha: dto.evento.fecha, organizadorId: dto.evento.organizadorId } };
}

export function createPurchasesService(client = apiClient) {
  // Se conserva el intento incierto al volver al evento o cambiar de perfil en la misma sesión.
  const attempts = new Map();
  const cancellations = new Map();
  const buyer = (session) => {
    if (!hasRole(session, RolUsuario.COMPRADOR)) throw new ApiError('Necesitás un perfil comprador para acceder a tus compras.', { status: 403 });
    return session.usuario.id;
  };
  const keyFor = (session, eventId) => `${buyer(session)}:${eventId}`;
  return {
    async listOwn(session, { signal } = {}) {
      const usuarioId = buyer(session);
      const data = await client.get('/compras', { usuarioId, signal });
      if (!Array.isArray(data)) throw invalid();
      const purchases = data.map(purchaseFromDto);
      if (purchases.some((purchase) => purchase.compradorId !== usuarioId)
        || new Set(purchases.map((purchase) => purchase.id)).size !== purchases.length) throw invalid();
      return purchases;
    },
    getPending(session, eventId) {
      const attempt = attempts.get(keyFor(session, eventId));
      return attempt ? { ...attempt.data } : null;
    },
    create(data, session, { signal } = {}) {
      const usuarioId = buyer(session);
      const key = keyFor(session, data.eventoId);
      let attempt = attempts.get(key);
      if (attempt && JSON.stringify(attempt.data) !== JSON.stringify(data)) {
        return Promise.reject(new ApiError('Hay una compra sin respuesta. Reintentá la misma selección para conocer el resultado.', { code: 'PENDING_PURCHASE' }));
      }
      if (!attempt) {
        attempt = { data: { ...data }, idempotencyKey: `compra-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`, promise: null };
        attempts.set(key, attempt);
      }
      if (attempt.promise) return attempt.promise;
      attempt.promise = Promise.resolve().then(() => client.post('/compras', attempt.data, {
        usuarioId, signal, idempotencyKey: attempt.idempotencyKey,
      })).then((dto) => {
        const purchase = purchaseFromDto(dto);
        if (purchase.compradorId !== usuarioId || purchase.eventoId !== data.eventoId || purchase.tipoEntradaId !== data.tipoEntradaId
          || purchase.cantidad !== data.cantidad || Math.round(purchase.precioUnitario * 100) !== Math.round(data.precioUnitarioEsperado * 100)) throw invalid();
        attempts.delete(key);
        return purchase;
      }).catch((error) => {
        if (error.status >= 400 && error.status < 500 && error.code !== 'INVALID_RESPONSE') attempts.delete(key);
        throw error;
      }).finally(() => { attempt.promise = null; });
      return attempt.promise;
    },
    async get(id, session, options = {}) {
      const usuarioId = buyer(session);
      const purchase = purchaseFromDto(await client.get(`/compras/${encodeURIComponent(id)}`, { ...options, usuarioId }));
      if (purchase.compradorId !== usuarioId) throw new ApiError('Solo podés consultar el comprobante de una compra propia.', { status: 403 });
      return purchase;
    },
    cancel(id, session, { signal } = {}) {
      const usuarioId = buyer(session);
      const key = `${usuarioId}:${id}`;
      if (cancellations.has(key)) return cancellations.get(key);
      // La cancelación completa es idempotente por compra, incluso tras perder la respuesta.
      const pending = Promise.resolve().then(() => client.post(`/compras/${encodeURIComponent(id)}/cancelacion`, {}, { usuarioId, signal }))
        .then((dto) => {
          const purchase = purchaseFromDto(dto);
          if (purchase.id !== id || purchase.compradorId !== usuarioId
            || !['CANCELADA', 'REEMBOLSADA'].includes(purchase.estado)
            || (purchase.estado === 'REEMBOLSADA' && !purchase.reembolso)) throw invalid();
          return purchase;
        }).finally(() => { cancellations.delete(key); });
      cancellations.set(key, pending);
      return pending;
    },
  };
}

export const purchasesService = createPurchasesService();
