import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, EmptyState, EventPoster, Icon, ScreenHeader } from '../components/MockUI';
import { colors, ui } from '../theme';
import { useMockSession } from '../session/MockSessionProvider';
import { canManageEvent } from '../session/permissions';
import { dateLabel, money } from '../utils/mockPresentation';
import { PurchaseCard } from './PurchasesScreen';

export default function OrganizerScreen({ events, sales, onCreate, onOpenEvent }) {
  const { session } = useMockSession();
  const own = events.filter((event) => canManageEvent(session, event));
  const confirmed = sales.filter((sale) => sale.estado === 'CONFIRMADA');
  return <ScrollView style={ui.screen} contentContainerStyle={ui.content} showsVerticalScrollIndicator={false}>
    <View style={ui.between}><Text style={ui.eyebrow}>ESPACIO DEL ORGANIZADOR</Text><View style={{ backgroundColor: colors.primaryLight, padding: 7, borderRadius: 8 }}><Text style={{ color: colors.primary, fontSize: 9, fontWeight: '800' }}>DEMO</Text></View></View>
    <View style={{ gap: 8 }}><Text style={ui.title}>{'Tu lado\ndel escenario.'}</Text><Text style={ui.text}>Hola, {session.usuario.nombre}. Detrás de cada gran plan, hay alguien como vos.</Text></View>
    <View style={[ui.card, { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark }]}><Text style={{ color: '#CDB1F3', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>TUS PLANES EN MOVIMIENTO</Text><View style={ui.row}>{[[own.length, 'eventos'], [sales.length, 'compras'], [confirmed.reduce((total, sale) => total + sale.cantidad, 0), 'entradas confirmadas']].map(([value, label]) => <View key={label} style={{ flex: 1, gap: 6 }}><Text style={{ color: '#fff', fontSize: 31, fontWeight: '800' }}>{value}</Text><Text style={{ color: '#DED0F0', fontSize: 10, lineHeight: 15 }}>{label}</Text></View>)}</View><View style={{ height: 1, backgroundColor: '#FFFFFF20' }} /><View style={ui.between}><Text style={{ color: '#DED0F0', fontSize: 12 }}>Ventas confirmadas de ejemplo</Text><Text style={{ color: colors.lime, fontSize: 18, fontWeight: '800' }}>{money(confirmed.reduce((total, sale) => total + sale.total, 0))}</Text></View></View>
    <Button title="Crear un evento" icon="plus" onPress={onCreate} />
    <View style={ui.between}><Text style={ui.heading}>Tus eventos</Text><Text style={ui.caption}>{own.length} publicados</Text></View>
    {own.map((event) => <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={`Administrar ${event.nombre}`} onPress={() => onOpenEvent(event.id)} style={ui.card}><View style={[ui.row, { gap: 15 }]}><EventPoster event={event} compact style={{ width: 76, borderRadius: 12 }} /><View style={{ flex: 1, gap: 6 }}><Text style={ui.label}>{event.nombre}</Text><Text style={ui.caption}>{dateLabel(event.fecha)} · {event.categoria}</Text><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Ver compras y disponibilidad</Text></View><Icon name="arrow" size={20} color={colors.primary} /></View></Pressable>)}
    <Text style={[ui.caption, { textAlign: 'center' }]}>Panel con datos de ejemplo para recorrer el flujo.</Text>
  </ScrollView>;
}

export function OrganizerEventScreen({ event, sales, onBack, onEdit, onOpenPurchase, onPreview }) {
  return <View style={ui.screen}><ScreenHeader title="Detrás de tu evento" subtitle={event.nombre} onBack={onBack} /><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ui.content}>
    <View style={{ borderRadius: 20, overflow: 'hidden' }}><EventPoster event={event} large style={{ height: 180 }} /></View><Text style={ui.title}>{event.nombre}</Text>
    <Button title="Editar evento" secondary onPress={onEdit} />
    <View style={{ gap: 13 }}><Text style={ui.heading}>Entradas disponibles</Text>{event.tiposEntrada.map((ticket) => <View key={ticket.id} style={[ui.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}><View style={{ gap: 5 }}><Text style={ui.label}>{ticket.nombre}</Text><Text style={ui.caption}>{money(ticket.precio)} por entrada</Text></View><View style={{ alignItems: 'flex-end', gap: 3 }}><Text style={{ color: colors.primary, fontSize: 26, fontWeight: '800' }}>{ticket.cupo}</Text><Text style={ui.caption}>disponibles</Text></View></View>)}</View>
    <View style={ui.between}><Text style={ui.heading}>Compras del evento</Text><Text style={ui.caption}>{sales.length} compras</Text></View>
    {sales.length ? sales.map((sale) => <PurchaseCard key={sale.id} purchase={sale} event={event} organizer onPress={() => onOpenPurchase(sale.id)} />) : <EmptyState icon="ticket" title="El primer aplauso está por llegar" description="Las compras de este evento aparecerán acá." />}
    <Button title="Ver como comprador" secondary onPress={onPreview} />
  </ScrollView></View>;
}
