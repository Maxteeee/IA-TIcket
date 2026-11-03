import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button, EmptyState, ScreenHeader } from '../components/MockUI';
import { catalogService } from '../services/catalog.service';
import { colors, ui } from '../theme';
import EventDetailScreen from './EventDetailScreen';
import { useMockSession } from '../session/MockSessionProvider';
import { canManageEvent, hasRole } from '../session/permissions';
import { RolUsuario } from '../session/roles';
import { purchasesService } from '../services/purchases.service';
import PreviousEventReviews from '../components/PreviousEventReviews';

export default function CatalogEventScreen({ eventId, onBack, requireOwner = false, published = false, onViewPublic, onPurchased, favorite, onFavorite }) {
  const { session } = useMockSession();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const mounted = useRef(true);
  const request = useRef(null);
  const refresh = useRef(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current?.abort(); refresh.current?.abort(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setEvent(null);
    catalogService.getEvent(eventId, { signal: controller.signal })
      .then((result) => {
        if (requireOwner && !canManageEvent(session, result)) throw new Error('Solo podés administrar publicaciones propias.');
        if (!controller.signal.aborted) setEvent(result);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [eventId, revision, requireOwner, session.usuario.id]);

  const buy = async (intent) => {
    const controller = new AbortController();
    request.current = controller;
    const purchase = await purchasesService.create(intent, session, { signal: controller.signal });
    if (mounted.current && !controller.signal.aborted) onPurchased(purchase);
  };
  const reloadAvailability = async () => {
    const controller = new AbortController();
    refresh.current?.abort();
    refresh.current = controller;
    const updated = await catalogService.getEvent(eventId, { signal: controller.signal });
    if (mounted.current && !controller.signal.aborted) setEvent(updated);
  };

  if (event && !loading && !error) {
    return <View style={ui.screen}>
      {published ? <View style={{ padding: 16, backgroundColor: colors.successLight }} accessibilityRole="alert"><Text style={[ui.label, { color: colors.success }]}>✓ Tu evento fue publicado</Text></View> : null}
      <EventDetailScreen event={event} organizer={event.organizador} onBack={onBack} favorite={favorite} onFavorite={onFavorite}
        purchaseEnabled={!requireOwner && Boolean(onPurchased)} purchaseMode="api"
        reviewsContent={<PreviousEventReviews key={event.id} eventId={event.id} organizerName={event.organizador.nombre} />}
        pendingPurchase={!requireOwner && hasRole(session, RolUsuario.COMPRADOR) ? purchasesService.getPending(session, eventId) : null}
        onPurchase={buy} onReloadAvailability={reloadAvailability} />
      {onViewPublic ? <View style={{ padding: 16 }}><Button title="Ver publicación en el catálogo" secondary onPress={onViewPublic} /></View> : null}
    </View>;
  }
  return <View style={ui.screen}>
    <ScreenHeader title="Detalle del evento" onBack={onBack} />
    {loading ? <View style={[ui.content, { alignItems: 'center' }]} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.primary} /><Text style={ui.text}>Cargando evento…</Text>
    </View> : <EmptyState title="No pudimos cargar el evento" description={error}
      action="Volver a intentar" onAction={() => setRevision((value) => value + 1)} />}
  </View>;
}
