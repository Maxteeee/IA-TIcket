import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Button, EmptyState, EventPoster, Icon } from '../components/MockUI';
import { useMockSession } from '../session/MockSessionProvider';
import { eventsService } from '../services/events.service';
import { colors, ui } from '../theme';
import { dateLabel } from '../utils/mockPresentation';

export default function ConnectedOrganizerScreen({ onCreate, onOpenEvent }) {
  const { session } = useMockSession();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setEvents([]);
    setLoading(true);
    setError('');
    eventsService.listOwn(session, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setEvents(result); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session.usuario.id, revision]);

  const header = <View style={{ gap: 22, paddingBottom: 22 }}>
    <Text style={ui.eyebrow}>ESPACIO DEL ORGANIZADOR</Text>
    <View style={{ gap: 8 }}><Text style={ui.title}>{'Tu lado\ndel escenario.'}</Text><Text style={ui.text}>Hola, {session.usuario.nombre}. Dale forma a tu próximo evento.</Text></View>
    <Button title="Crear un evento" icon="plus" onPress={onCreate} />
    <View style={ui.between}><Text style={ui.heading}>Tus eventos publicados</Text>{!loading && !error ? <Text style={ui.caption}>{events.length} eventos</Text> : null}</View>
  </View>;
  return <FlatList style={ui.screen} contentContainerStyle={ui.content} data={loading || error ? [] : events}
    keyExtractor={(event) => event.id} ListHeaderComponent={header} onRefresh={() => setRevision((value) => value + 1)} refreshing={loading && events.length > 0}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Ver compras y disponibilidad de ${item.nombre}`} onPress={() => onOpenEvent(item.id)} style={ui.card}>
      <View style={ui.row}><EventPoster event={item} compact style={{ width: 76, borderRadius: 12 }} />
        <View style={{ flex: 1, gap: 6 }}><Text style={ui.label}>{item.nombre}</Text><Text style={ui.caption}>{dateLabel(item.fecha)} · {item.categoria}</Text><Text style={[ui.caption, { color: colors.primary }]}>Ver compras y disponibilidad</Text></View>
        <Icon name="arrow" color={colors.primary} />
      </View>
    </Pressable>}
    ListEmptyComponent={loading ? <View accessibilityRole="progressbar" style={{ alignItems: 'center', gap: 12 }}><ActivityIndicator color={colors.primary} /><Text style={ui.text}>Cargando tus eventos…</Text></View>
      : error ? <EmptyState title="No pudimos cargar tus eventos" description={error} action="Volver a intentar" onAction={() => setRevision((value) => value + 1)} />
        : <EmptyState title="Tu próximo evento empieza acá" description="Creá un evento y ofrecé distintas entradas a tu público." />}
    />;
}
