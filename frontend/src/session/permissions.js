import { RolUsuario } from './roles.js';

export const hasRole = (session, role) => Boolean(session?.usuario?.id && session.roles?.includes(role));
export const canOrganize = (session) => hasRole(session, RolUsuario.ORGANIZADOR);
export const canManageEvent = (session, event) => Boolean(event && canOrganize(session) && event.organizadorId === session.usuario.id);
export const isOwnPurchase = (session, purchase) => Boolean(purchase && hasRole(session, RolUsuario.COMPRADOR) && purchase.compradorId === session.usuario.id);
export const canAccessPurchase = (session, purchase, event) => Boolean(purchase && event && purchase.eventoId === event.id
  && (isOwnPurchase(session, purchase) || canManageEvent(session, event)));
export const canPurchase = (session, event, now = new Date()) => Boolean(event && hasRole(session, RolUsuario.COMPRADOR)
  && event.organizadorId !== session.usuario.id && !event.finalizadoDemo && new Date(event.fecha) > now);
export const canReviewPurchase = (session, purchase, event) => Boolean(event && purchase?.eventoId === event.id
  && isOwnPurchase(session, purchase) && purchase.estado === 'UTILIZADA' && event.finalizadoDemo && !purchase.resenada);

export function canAccessRoute(session, route, { events, purchases }) {
  if (!session?.usuario?.id) return false;
  if (!route) return true;
  if (route.name === 'purchasesDemo') return hasRole(session, RolUsuario.COMPRADOR);
  if (['purchaseReceipt', 'purchaseChat', 'purchaseReview'].includes(route.name)) return hasRole(session, RolUsuario.COMPRADOR)
    && typeof route.purchaseId === 'string' && Boolean(route.purchaseId.trim());
  if (route.name === 'saleChat') return canOrganize(session) && typeof route.eventId === 'string' && Boolean(route.eventId.trim())
    && typeof route.purchaseId === 'string' && Boolean(route.purchaseId.trim());
  if (route.name === 'organizerDemo') return canOrganize(session);
  if (route.name === 'publishedEvent') return canOrganize(session) && typeof route.eventId === 'string' && Boolean(route.eventId.trim());
  if (route.name === 'catalogEvent') return hasRole(session, RolUsuario.COMPRADOR)
    && typeof route.eventId === 'string' && Boolean(route.eventId.trim());
  if (route.name === 'create') return canOrganize(session);
  const event = events.find((item) => item.id === route.eventId);
  if (route.name === 'event') return Boolean(event);
  if (['organizerEvent', 'edit'].includes(route.name)) return canManageEvent(session, event);
  if (['purchase', 'chat'].includes(route.name)) {
    const purchase = purchases.find((item) => item.id === route.id);
    const purchaseEvent = events.find((item) => item.id === purchase?.eventoId);
    if (route.role === 'organizador') return canAccessPurchase(session, purchase, purchaseEvent) && canManageEvent(session, purchaseEvent);
    if (route.role === 'comprador') return canAccessPurchase(session, purchase, purchaseEvent) && isOwnPurchase(session, purchase);
  }
  return false;
}

export function selectSessionData(session, { events, purchases, favoritesByUser }) {
  return {
    purchases: purchases.filter((purchase) => isOwnPurchase(session, purchase)),
    sales: purchases.filter((purchase) => canManageEvent(session, events.find((event) => event.id === purchase.eventoId))),
    favoriteIds: hasRole(session, RolUsuario.COMPRADOR) ? [...(favoritesByUser[session.usuario.id] ?? [])] : [],
  };
}
