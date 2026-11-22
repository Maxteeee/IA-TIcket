import { useEffect, useRef, useState } from 'react';
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
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const mounted = useRef(true);
  const reading = useRef(true);
  const locked = useRef(false);
  const changeRequest = useRef(null);
  const reload = () => {
    if (locked.current) return;
    reading.current = true;
    setConfirmation(null);
    setFeedback(null);
    setRevision((value) => value + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    reading.current = true;
    setData(null);
    setLoading(true);
    setError('');
    salesService.getEventSales(eventId, session, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setData(result); setNeedsRefresh(false); } })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) { reading.current = false; setLoading(false); } });
    return () => controller.abort();
  }, [eventId, session.usuario.id, revision]);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });
    return () => { mounted.current = false; changeRequest.current?.abort(); subscription.remove(); };
  }, []);

  const changeState = async () => {
    if (locked.current || reading.current || needsRefresh || !confirmation) return;
    const { purchaseId, estado } = confirmation;
    const success = estado === 'CONFIRMADA' ? 'Pago simulado confirmado. No se realizó ningún cobro real.' : 'Todas las entradas de la compra fueron marcadas como utilizadas.';
    locked.current = true;
    setBusy(purchaseId);
    setFeedback(null);
    const controller = new AbortController();
    changeRequest.current = controller;
    let registered = false;
    try {
      await salesService.updatePurchaseState(eventId, purchaseId, estado, session, { signal: controller.signal });
      registered = true;
      const updated = await salesService.getEventSales(eventId, session, { signal: controller.signal });
      if (!mounted.current || controller.signal.aborted) return;
      setData(updated);
      setNeedsRefresh(false);
      setConfirmation(null);
      setFeedback({ success: true, text: success });
    } catch (cause) {
      if (!mounted.current || controller.signal.aborted) return;
      const definitive = cause.status >= 400 && cause.status < 500 && cause.code !== 'INVALID_RESPONSE';
      setConfirmation(null);
      setNeedsRefresh(true);
      setFeedback({ success: false, text: registered ? 'El cambio se registró, pero no pudimos actualizar las compras. Actualizá para consultar el estado actual.'
        : definitive ? cause.message : 'No pudimos confirmar el resultado. Actualizá las compras antes de volver a intentarlo.' });
      try {
        const updated = await salesService.getEventSales(eventId, session, { signal: controller.signal });
        if (!mounted.current || controller.signal.aborted) return;
        setData(updated);
        setNeedsRefresh(false);
        if (updated.compras.find((purchase) => purchase.id === purchaseId)?.estado === estado) {
          setFeedback({ success: true, text: success });
        }
      } catch { /* Se conserva la última consulta; hay que actualizar antes de otra operación. */ }
    } finally {
      locked.current = false;
      if (mounted.current && !controller.signal.aborted) setBusy(null);
    }
  };

  const askForChange = (purchaseId, estado) => {
    if (locked.current || reading.current || needsRefresh) return;
    setFeedback(null);
    setConfirmation({ purchaseId, estado });
  };

  const visible = data?.compras.filter((purchase) => filter === 'Todas' || purchase.estado === filter) ?? [];
  return <View style={ui.screen}>
    <ScreenHeader title="Compras del evento" onBack={onBack} />
    <FlatList style={ui.screen} contentContainerStyle={ui.content} data={loading || error ? [] : visible}
      keyExtractor={(purchase) => purchase.id} onRefresh={reload} refreshing={loading}
      ListHeaderComponent={!loading && !error && data ? <View style={{ gap: 22, paddingBottom: 22 }}>
        {published ? <View accessibilityRole="alert" style={[ui.card, { backgroundColor: colors.successLight }]}><Text style={[ui.label, { color: colors.success }]}>✓ Tu evento fue publicado</Text></View> : null}
        <EventPoster event={{ ...data.evento, posterTitle: data.evento.nombre.toUpperCase() }} large style={{ height: 180, borderRadius: 20 }} />
        <View style={{ gap: 8 }}><Text style={ui.title}>{data.evento.nombre}</Text><Text style={ui.text}>{dateLabel(data.evento.fecha, { weekday: 'long', year: 'numeric' })}</Text></View>
        <Button title="Actualizar compras" secondary disabled={Boolean(busy)} onPress={reload} />
        {feedback ? <View accessibilityRole="alert" style={ui.card}><Text style={[ui.label, { color: feedback.success ? colors.success : colors.danger }]}>{feedback.text}</Text></View> : null}
        {onViewPublic && hasRole(session, RolUsuario.COMPRADOR) ? <Button title="Ver publicación en el catálogo" secondary disabled={Boolean(busy)} onPress={onViewPublic} /> : null}
        <View style={ui.card}><Text style={ui.heading}>Pagos y uso de entradas</Text>
          <Text style={ui.text}>Confirmá el pago simulado de las compras pendientes antes del inicio del evento. No se realiza ningún cobro real.</Text>
          <Text style={ui.caption}>Después podés marcar como utilizadas todas las entradas de una compra confirmada. Estas acciones no descuentan cupo nuevamente.</Text>
        </View>
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
          <Chip label="Todas" selected={filter === 'Todas'} disabled={Boolean(busy)} onPress={() => { setConfirmation(null); setFilter('Todas'); }} />
          {Object.entries(statusLabels).map(([state, label]) => <Chip key={state} label={label} selected={filter === state} disabled={Boolean(busy)} onPress={() => { setConfirmation(null); setFilter(state); }} />)}
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
        {confirmation?.purchaseId === item.id ? <View style={{ gap: 12 }}>
          <Text style={ui.heading}>{confirmation.estado === 'CONFIRMADA' ? '¿Confirmar el pago simulado?' : '¿Marcar todas las entradas como utilizadas?'}</Text>
          <Text style={ui.text}>{confirmation.estado === 'CONFIRMADA'
            ? `Se registrará el pago simulado de ${money(item.total)} de esta compra. No se realizará ningún cobro real.`
            : `Se marcará como utilizada esta compra de ${item.cantidad} ${item.cantidad === 1 ? 'entrada' : 'entradas'}. El comprador ya no podrá cancelarla y podrá publicar una reseña.`}</Text>
          <Button title={busy === item.id ? 'Guardando…' : confirmation.estado === 'CONFIRMADA' ? 'Sí, confirmar pago simulado' : 'Sí, marcar como utilizada'} disabled={Boolean(busy) || needsRefresh} onPress={changeState} />
          <Button title="Volver sin cambios" secondary disabled={Boolean(busy)} onPress={() => setConfirmation(null)} />
        </View> : item.estado === 'PENDIENTE' ? <Button title="Confirmar pago simulado" disabled={Boolean(busy) || needsRefresh} onPress={() => askForChange(item.id, 'CONFIRMADA')} />
          : item.estado === 'CONFIRMADA' ? <Button title="Marcar como utilizada" disabled={Boolean(busy) || needsRefresh} onPress={() => askForChange(item.id, 'UTILIZADA')} /> : null}
        {onOpenChat ? <Button title="Abrir conversación" secondary icon="chat" disabled={Boolean(busy)} onPress={() => onOpenChat(item.id)} /> : null}
      </View>}
      ListEmptyComponent={loading ? <View accessibilityRole="progressbar" style={{ alignItems: 'center', gap: 12 }}><ActivityIndicator color={colors.primary} /><Text style={ui.text}>Cargando compras y disponibilidad…</Text></View>
        : error ? <EmptyState title="No pudimos cargar las compras del evento" description={error} action="Volver a intentar" onAction={reload} />
          : data?.compras.length ? <EmptyState icon="ticket" title="No hay compras en este estado" description="Los otros estados y la disponibilidad del evento siguen disponibles." action="Ver todas" onAction={() => setFilter('Todas')} />
            : <EmptyState icon="ticket" title="Este evento todavía no tiene compras" description="Cuando alguien compre entradas, sus compras aparecerán acá." />} />
  </View>;
}
