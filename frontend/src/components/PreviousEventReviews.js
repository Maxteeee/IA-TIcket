import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { Button } from './MockUI';
import { catalogService } from '../services/catalog.service';
import { colors, ui } from '../theme';
import { dateLabel } from '../utils/mockPresentation';

export default function PreviousEventReviews({ eventId, organizerName }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((value) => value + 1);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRevision((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    catalogService.getPreviousReviews(eventId, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setReviews(result); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [eventId, revision]);

  return <View style={{ gap: 14 }}>
    <Text style={ui.heading}>Experiencias anteriores</Text>
    <Text style={ui.caption}>Reseñas de eventos anteriores y finalizados de {organizerName}.</Text>
    {loading ? <View style={[ui.card, ui.row]} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.primary} /><Text style={ui.text}>Cargando reseñas…</Text>
    </View> : error ? <View style={ui.card} accessibilityRole="alert">
      <Text style={ui.label}>No pudimos cargar las reseñas</Text>
      <Text style={ui.text}>{error}</Text>
      <Button title="Reintentar reseñas" secondary onPress={refresh} />
    </View> : <>
      {reviews.length ? reviews.map((review) => <View key={review.id} style={ui.card}>
        <View style={[ui.between, { gap: 12 }]}>
          <Text style={[ui.label, { flex: 1 }]}>{review.autor}</Text>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>★ {review.puntuacion}/5</Text>
        </View>
        <Text style={ui.text}>{review.detalle}</Text>
        <Text style={ui.caption}>{review.evento.nombre} · {dateLabel(review.evento.fecha, { year: 'numeric' })}</Text>
      </View>) : <View style={ui.card}>
        <Text style={ui.label}>Todavía no hay experiencias anteriores</Text>
        <Text style={ui.text}>No hay reseñas de eventos anteriores finalizados para esta publicación.</Text>
      </View>}
      <Button title="Actualizar reseñas" secondary onPress={refresh} />
    </>}
  </View>;
}
