import { apiClient, ApiError } from './api.client.js';
import { createPurchasesService } from './purchases.service.js';
import { hasRole } from '../session/permissions.js';
import { RolUsuario } from '../session/roles.js';

const invalid = () => new ApiError('El servidor devolvió una reseña inválida.', { code: 'INVALID_RESPONSE' });

export function prepareReview({ puntuacion, detalle }) {
  const raw = typeof puntuacion === 'string' ? puntuacion.trim() : '';
  if (typeof puntuacion !== 'number' && (!raw || !/^\d+(?:[.,]\d+)?$/.test(raw))) {
    throw new ApiError('Ingresá una puntuación numérica entre 0 y 5.', { status: 400 });
  }
  const score = typeof puntuacion === 'number' ? puntuacion : Number(raw.replace(',', '.'));
  if (!Number.isFinite(score) || score < 0 || score > 5) throw new ApiError('La puntuación debe estar entre 0 y 5.', { status: 400 });
  if (typeof detalle !== 'string' || !detalle.trim() || detalle.trim().length > 1500) {
    throw new ApiError('Escribí un comentario de 1 a 1500 caracteres.', { status: 400 });
  }
  return { puntuacion: score, detalle: detalle.trim() };
}

export function reviewFromDto(dto) {
  if (!dto || ['id', 'compraId', 'eventoId', 'compradorId'].some((key) => typeof dto[key] !== 'string' || !dto[key])
    || !Number.isFinite(dto.puntuacion) || dto.puntuacion < 0 || dto.puntuacion > 5
    || typeof dto.detalle !== 'string' || !dto.detalle.trim() || dto.detalle.length > 1500) throw invalid();
  return { id: dto.id, compraId: dto.compraId, eventoId: dto.eventoId, compradorId: dto.compradorId, puntuacion: dto.puntuacion, detalle: dto.detalle };
}

export function createReviewsService(client = apiClient) {
  const purchases = createPurchasesService(client);
  const attempts = new Map();
  const buyer = (session) => {
    if (!hasRole(session, RolUsuario.COMPRADOR)) throw new ApiError('Necesitás un perfil comprador para reseñar tus compras.', { status: 403 });
    return session.usuario.id;
  };
  const ownPurchase = async (purchaseId, session, signal) => {
    const purchase = await purchases.get(purchaseId, session, { signal });
    if (purchase.id !== purchaseId) throw invalid();
    return purchase;
  };
  const matches = (review, purchase, usuarioId) => review.compraId === purchase.id && review.eventoId === purchase.eventoId && review.compradorId === usuarioId;
  return {
    getPending(purchaseId, session) {
      const attempt = attempts.get(`${buyer(session)}:${purchaseId}`);
      return attempt ? { ...attempt.data } : null;
    },
    async load(purchaseId, session, { signal } = {}) {
      const usuarioId = buyer(session);
      const purchase = await ownPurchase(purchaseId, session, signal);
      const query = new URLSearchParams({ compraId: purchaseId });
      const data = await client.get(`/resenias?${query}`, { signal });
      if (!Array.isArray(data)) throw invalid();
      const reviews = data.map(reviewFromDto);
      if (reviews.some((review) => !matches(review, purchase, usuarioId)) || new Set(reviews.map((review) => review.id)).size !== reviews.length) throw invalid();
      return { purchase, reviews };
    },
    create(purchaseId, data, session, { signal } = {}) {
      const usuarioId = buyer(session);
      const prepared = prepareReview(data);
      const key = `${usuarioId}:${purchaseId}`;
      let attempt = attempts.get(key);
      if (attempt && JSON.stringify(attempt.data) !== JSON.stringify(prepared)) {
        return Promise.reject(new ApiError('Hay una reseña sin respuesta. Reintentá esa misma publicación para conocer el resultado.', { code: 'PENDING_REVIEW' }));
      }
      if (!attempt) {
        attempt = { data: prepared, idempotencyKey: `resenia-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`, promise: null };
        attempts.set(key, attempt);
      }
      if (attempt.promise) return attempt.promise;
      attempt.promise = Promise.resolve().then(() => ownPurchase(purchaseId, session, signal)).then(async (purchase) => {
        const dto = await client.post('/resenias', { compraId: purchaseId, ...attempt.data }, { usuarioId, signal, idempotencyKey: attempt.idempotencyKey });
        const review = reviewFromDto(dto);
        if (!matches(review, purchase, usuarioId) || review.puntuacion !== prepared.puntuacion || review.detalle !== prepared.detalle) throw invalid();
        attempts.delete(key);
        return review;
      }).catch((error) => {
        if (error.status >= 400 && error.status < 500 && error.code !== 'INVALID_RESPONSE') attempts.delete(key);
        throw error;
      }).finally(() => { attempt.promise = null; });
      return attempt.promise;
    },
  };
}

export const reviewsService = createReviewsService();
