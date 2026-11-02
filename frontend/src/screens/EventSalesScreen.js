import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, ScrollView, Text, View } from 'react-native';
import { Button, Chip, EmptyState, EventPoster, ScreenHeader, StatusBadge } from '../components/MockUI';
import { useMockSession } from '../session/MockSessionProvider';
import { hasRole } from '../session/permissions';
import { RolUsuario } from '../session/roles';
import { salesService } from '../services/sales.service';
import { dateLabel, money, statusLabels } from '../utils/mockPresentation';
import { colors, ui } from '../theme';

export default function EventSalesScreen({ eventId, onBack, onViewPublic, onOpenChat, published = false }) {
  const { session } = useMockSession();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('Todas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision((value) => value + 1);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoading(true);
    setError('');
    salesService.getEventSales(eventId, session, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [eventId, session.usuario.id, revision]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRevision((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);

  const visible = data?.compras.filter((purchase) => filter === 'Todas' || purchase.estado === filter) ?? [];
  return <View style={ui.screen}>
    <ScreenHeader title="Compras del evento" onBack={onBack} />
    <FlatList style={ui.screen} contentContainerStyle={ui.content} data={loading || error ? [] : visible}
      keyExtractor={(purchase) => purchase.id} onRefresh={reload} refreshing={loading}
      ListHeaderComponent={!loading && !error && data ? <View style={{ gap: 22, paddingBottom: 22 }}>
        {published ? <View accessibilityRole="alert" style={[ui.card, { backgroundColor: colors.successLight }]}><Text style={[ui.label, { color: colors.success }]}>✓ Tu evento fue publicado</Text></View> : null}
        <EventPoster event={{ ...data.evento, posterTitle: data.evento.nombre.toUpperCase() }} large style={{ height: 180, borderRadius: 20 }} />
        <View style={{ gap: 8 }}><Text style={ui.title}>{data.evento.nombre}</Text><Text style={ui.text}>{dateLabel(data.evento.fecha, { weekday: 'long', year: 'numeric' })}</Text></View>
        {onViewPublic && hasRole(session, RolUsuario.COMPRADOR) ? <Button title="Ver publicación en el catálogo" secondary onPress={onViewPublic} /> : null}
        <View style={ui.card}>
          <Text style={ui.heading}>Cancelaciones de compradores</Text>
          <Text style={ui.text}>Cada comprador puede cancelar su compra antes del inicio del evento, siempre que las entradas no hayan sido utilizadas.</Text>
          <Text style={ui.caption}>Las entradas canceladas vuelven al cupo disponible. Si la compra estaba confirmada, se registra el reembolso simulado del total original.</Text>
        </View>
        <View style={{ gap: 13 }}><Text style={ui.heading}>Entradas disponibles</Text>
          <Text style={ui.caption}>Disponibilidad actual. Las compras pendientes de pago ya reservan sus entradas.</Text>
          {data.evento.tiposEntrada.map((ticket) => <View key={ticket.id} style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
            <View style={{ flex: 1, gap: 5 }}><Text style={ui.label}>{ticket.nombre}</Text><Text style={ui.caption}>{money(ticket.precio)} por entrada</Text></View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}><Text style={{ color: ticket.cupo ? colors.primary : colors.danger, fontSize: 26, fontWeight: '800' }}>{ticket.cupo}</Text><Text style={ui.caption}>{ticket.cupo === 0 ? 'Agotadas' : ticket.cupo === 1 ? 'disponible' : 'disponibles'}</Text></View>
          </View>)}
        </View>
        <View style={{ gap: 8 }}><Text style={ui.heading}>Compras del evento</Text><Text style={ui.caption}>{data.compras.length} {data.compras.length === 1 ? 'compra registrada' : 'compras registradas'}</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label="Todas" selected={filter === 'Todas'} onPress={() => setFilter('Todas')} />
          {Object.entries(statusLabels).map(([state, label]) => <Chip key={state} label={label} selected={filter === state} onPress={() => setFilter(state)} />)}
        </ScrollView>
        {filter !== 'Todas' ? <Text style={ui.caption}>{visible.length} {visible.length === 1 ? 'compra' : 'compras'} · {statusLabels[filter]}</Text> : null}
      </View> : null}
      renderItem={({ item }) => <View style={ui.card}>
        <StatusBadge status={item.estado} />
        <Text style={ui.caption}>NÚMERO DE COMPRA</Text><Text selectable style={ui.caption}>{item.id}</Text>
        <Text style={ui.label}>{`${item.comprador.nombre} ${item.comprador.apellido}`.trim()}</Text>
        <Text style={ui.text}>{item.tipoEntradaNombre} · {item.cantidad} {item.cantidad === 1 ? 'entrada' : 'entradas'}</Text>
        <Text style={ui.caption}>{money(item.precioUnitario)} por entrada al comprar</Text>
        <View style={ui.between}><Text style={ui.label}>Total simulado</Text><Text style={[ui.heading, { color: colors.primary }]}>{money(item.total)}</Text></View>
        {item.reembolso ? <Text style={[ui.label, { color: colors.success }]}>Reembolso simulado: {money(item.reembolso.importe)}</Text> : null}
        {onOpenChat ? <Button title="Abrir conversación" secondary icon="chat" onPress={() => onOpenChat(item.id)} /> : null}
      </View>}
      ListEmptyComponent={loading ? <View accessibilityRole="progressbar" style={{ alignItems: 'center', gap: 12 }}><ActivityIndicator color={colors.primary} /><Text style={ui.text}>Cargando compras y disponibilidad…</Text></View>
        : error ? <EmptyState title="No pudimos cargar las compras del evento" description={error} action="Volver a intentar" onAction={reload} />
          : data?.compras.length ? <EmptyState icon="ticket" title="No hay compras en este estado" description="Los otros estados y la disponibilidad del evento siguen disponibles." action="Ver todas" onAction={() => setFilter('Todas')} />
            : <EmptyState icon="ticket" title="Este evento todavía no tiene compras" description="Cuando alguien compre entradas, sus compras aparecerán acá." />} />
  </View>;
}
