import { apiClient, ApiError } from './api.client.js';
import { createPurchasesService, purchaseFromDto } from './purchases.service.js';
import { hasRole } from '../session/permissions.js';
import { RolUsuario } from '../session/roles.js';

const invalid = () => new ApiError('El servidor devolvió mensajes inválidos.', { code: 'INVALID_RESPONSE' });

export function prepareMessage(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 2000) {
    throw new ApiError('El mensaje debe tener entre 1 y 2000 caracteres.', { status: 400 });
  }
  return value.trim();
}

export function messageFromDto(dto, purchaseId) {
  if (!dto || typeof dto.id !== 'string' || !dto.id || dto.compraId !== purchaseId
    || typeof dto.usuarioId !== 'string' || !dto.usuarioId
    || typeof dto.mensaje !== 'string' || !dto.mensaje.trim() || dto.mensaje.length > 2000
    || typeof dto.enviado !== 'string' || !Number.isFinite(new Date(dto.enviado).getTime())) throw invalid();
  return { id: dto.id, compraId: dto.compraId, usuarioId: dto.usuarioId, mensaje: dto.mensaje, enviado: dto.enviado };
}

export function createChatService(client = apiClient) {
  const purchases = createPurchasesService(client);
  const attempts = new Map();
  const participant = (session, role) => {
    if (!['comprador', 'organizador'].includes(role)) throw new ApiError('La perspectiva del chat no es válida.', { status: 400 });
    if (!hasRole(session, role === 'organizador' ? RolUsuario.ORGANIZADOR : RolUsuario.COMPRADOR)) {
      throw new ApiError(`Necesitás un perfil ${role} para abrir esta conversación.`, { status: 403 });
    }
    return session.usuario.id;
  };
  const keyFor = (session, purchaseId, role) => `${participant(session, role)}:${purchaseId}`;
  const pathFor = (purchaseId) => `/compras/${encodeURIComponent(purchaseId)}/mensajes`;
  const ownPurchase = async (purchaseId, session, signal, role, eventId) => {
    let purchase;
    if (role === 'organizador') {
      if (typeof eventId !== 'string' || !eventId.trim()) throw new ApiError('Indicá el evento de esta conversación.', { status: 400 });
      purchase = purchaseFromDto(await client.get(`/compras/${encodeURIComponent(purchaseId)}`, { usuarioId: session.usuario.id, signal }));
      if (purchase.eventoId !== eventId || purchase.evento.organizadorId !== session.usuario.id) {
        throw new ApiError('Solo podés responder compras del evento que organizás.', { status: 403 });
      }
    } else {
      purchase = await purchases.get(purchaseId, session, { signal });
    }
    if (purchase.id !== purchaseId) throw invalid();
    return purchase;
  };

  return {
    getPending(session, purchaseId, { role = 'comprador' } = {}) {
      return attempts.get(keyFor(session, purchaseId, role))?.message ?? null;
    },
    async getConversation(purchaseId, session, { signal, role = 'comprador', eventId } = {}) {
      const usuarioId = participant(session, role);
      const purchase = await ownPurchase(purchaseId, session, signal, role, eventId);
      const data = await client.get(pathFor(purchaseId), { usuarioId, signal });
      if (!Array.isArray(data)) throw invalid();
      const messages = data.map((item) => messageFromDto(item, purchaseId));
      if (new Set(messages.map((item) => item.id)).size !== messages.length
        || messages.some((item) => ![purchase.compradorId, purchase.evento.organizadorId].includes(item.usuarioId))) throw invalid();
      return { purchase, messages };
    },
    send(purchaseId, value, session, { signal, role = 'comprador', eventId } = {}) {
      const usuarioId = participant(session, role);
      const message = prepareMessage(value);
      const key = keyFor(session, purchaseId, role);
      let attempt = attempts.get(key);
      if (attempt && attempt.message !== message) {
        return Promise.reject(new ApiError('Hay un envío sin respuesta. Reintentá ese mismo mensaje para conocer el resultado.', { code: 'PENDING_MESSAGE' }));
      }
      if (!attempt) {
        attempt = { message, idempotencyKey: `mensaje-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`, promise: null };
        attempts.set(key, attempt);
      }
      if (attempt.promise) return attempt.promise;
      // También se comprueba propiedad al enviar; no alcanza con conocer un ID de compra.
      attempt.promise = Promise.resolve().then(() => ownPurchase(purchaseId, session, signal, role, eventId))
        .then(() => client.post(pathFor(purchaseId), { mensaje: message }, { usuarioId, signal, idempotencyKey: attempt.idempotencyKey }))
        .then((dto) => {
          const sent = messageFromDto(dto, purchaseId);
          if (sent.usuarioId !== usuarioId || sent.mensaje !== message) throw invalid();
          attempts.delete(key);
          return sent;
        }).catch((error) => {
          if (error.status >= 400 && error.status < 500 && error.code !== 'INVALID_RESPONSE') attempts.delete(key);
          throw error;
        }).finally(() => { attempt.promise = null; });
      return attempt.promise;
    },
  };
}

export const chatService = createChatService();
