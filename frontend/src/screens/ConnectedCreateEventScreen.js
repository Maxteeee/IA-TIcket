import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { EmptyState, ScreenHeader } from '../components/MockUI';
import { catalogService } from '../services/catalog.service';
import { eventsService } from '../services/events.service';
import { useMockSession } from '../session/MockSessionProvider';
import { colors, ui } from '../theme';
import CreateEventScreen from './CreateEventScreen';

export default function ConnectedCreateEventScreen({ onBack, onPublished }) {
  const { session } = useMockSession();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const publication = useRef(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; publication.current?.abort(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    catalogService.getCategories({ signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setCategories(result); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  const publish = async (draft, { idempotencyKey }) => {
    const controller = new AbortController();
    publication.current = controller;
    const event = await eventsService.create(draft, session, { signal: controller.signal, idempotencyKey });
    if (mounted.current && !controller.signal.aborted) onPublished(event);
  };
  if (!loading && !error && categories.length) {
    return <CreateEventScreen availableCategories={categories} onBack={onBack} onCreate={publish} />;
  }
  return <View style={ui.screen}><ScreenHeader title="Crear evento" onBack={onBack} />
    {loading ? <View style={[ui.content, { alignItems: 'center' }]} accessibilityRole="progressbar"><ActivityIndicator color={colors.primary} /><Text style={ui.text}>Cargando categorías…</Text></View>
      : <EmptyState title={error ? 'No pudimos cargar las categorías' : 'Todavía no hay categorías disponibles'}
        description={error || 'Volvé a consultar antes de publicar tu evento.'} action="Volver a intentar" onAction={() => setRevision((value) => value + 1)} />}
  </View>;
}
