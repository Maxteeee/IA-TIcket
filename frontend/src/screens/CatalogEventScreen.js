import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { EmptyState, ScreenHeader } from '../components/MockUI';
import { catalogService } from '../services/catalog.service';
import { colors, ui } from '../theme';
import EventDetailScreen from './EventDetailScreen';

export default function CatalogEventScreen({ eventId, onBack }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setEvent(null);
    catalogService.getEvent(eventId, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setEvent(result); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [eventId, revision]);

  if (event && !loading && !error) {
    return <EventDetailScreen event={event} organizer={event.organizador} onBack={onBack}
      purchaseEnabled={false} showReviews={false} />;
  }
  return <View style={ui.screen}>
    <ScreenHeader title="Detalle del evento" onBack={onBack} />
    {loading ? <View style={[ui.content, { alignItems: 'center' }]} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.primary} /><Text style={ui.text}>Cargando evento…</Text>
    </View> : <EmptyState title="No pudimos cargar el evento" description={error}
      action="Volver a intentar" onAction={() => setRevision((value) => value + 1)} />}
  </View>;
}
