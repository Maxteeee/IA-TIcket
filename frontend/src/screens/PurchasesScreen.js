import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Chip, EmptyState, EventPoster, Icon, StatusBadge } from '../components/MockUI';
import { colors, ui } from '../theme';
import { dateLabel, daysUntil, money } from '../utils/mockPresentation';
import PurchaseCountdown from '../components/PurchaseCountdown';

export function PurchaseCard({ purchase, event, onPress, organizer = false, connected = false }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Ver compra ${purchase.id}`} onPress={onPress} style={ui.card}>
    <View style={ui.between}><StatusBadge status={purchase.estado} /><Text numberOfLines={1} style={[ui.caption, { flex: 1, textAlign: 'right' }]}>{purchase.id}</Text></View>
    <View style={[ui.row, { alignItems: 'center', gap: 14 }]}><EventPoster event={connected ? { ...event, posterTitle: event.nombre.toUpperCase() } : event} compact style={{ width: 76, borderRadius: 12 }} /><View style={{ flex: 1, gap: 6 }}><Text style={[ui.label, { fontSize: 16 }]}>{event.nombre}</Text><Text style={ui.caption}>{organizer ? purchase.comprador : dateLabel(event.fecha, { weekday: 'short', ...(connected ? { year: 'numeric' } : {}) })}</Text>{connected ? <Text style={ui.caption}>{purchase.tipoEntradaNombre}</Text> : null}<Text style={ui.caption}>{purchase.cantidad} {purchase.cantidad === 1 ? 'entrada' : 'entradas'} · {money(purchase.total)}</Text></View><Icon name="arrow" color={colors.primary} size={20} /></View>
    {connected ? <PurchaseCountdown purchase={purchase} /> : purchase.estado === 'CONFIRMADA' && new Date(event.fecha) > new Date() ? <View style={{ backgroundColor: colors.primaryLight, borderRadius: 9, padding: 10, flexDirection: 'row', gap: 7, alignItems: 'center' }}><Icon name="ticket" color={colors.primary} size={16} /><Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>Tu plan está a {daysUntil(event.fecha)} días</Text></View> : null}
  </Pressable>;
}

export default function PurchasesScreen({ purchases, events, onOpenPurchase, onExplore }) {
  const [filter, setFilter] = useState('Todas');
  const visible = purchases.filter((purchase) => filter === 'Todas' || (filter === 'Próximas' ? ['CONFIRMADA', 'PENDIENTE'].includes(purchase.estado) : ['UTILIZADA', 'CANCELADA', 'REEMBOLSADA'].includes(purchase.estado)));
  return <ScrollView style={ui.screen} contentContainerStyle={ui.content} showsVerticalScrollIndicator={false}>
    <View style={{ gap: 8 }}><Text style={ui.eyebrow}>RECORRIDO DE DEMOSTRACIÓN</Text><Text style={ui.title}>Compras de ejemplo.</Text><Text style={ui.text}>Explorá los estados y conversaciones de la maqueta.</Text></View>
    <View style={[ui.card, { backgroundColor: colors.primary, borderColor: colors.primary }]}><View style={ui.between}><Text style={{ color: '#DFCCFF', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>TU AGENDA</Text><Icon name="ticket" color={colors.lime} size={25} /></View><Text style={{ color: '#fff', fontSize: 27, fontWeight: '800', letterSpacing: -0.7 }}>{purchases.filter((purchase) => purchase.estado === 'CONFIRMADA').length} planes confirmados</Text><Text style={{ color: '#E8DBFD', fontSize: 13 }}>Acá encontrás cada compra y su conversación.</Text></View>
    <View style={ui.row}>{['Todas', 'Próximas', 'Historial'].map((label) => <Chip key={label} label={label} selected={filter === label} onPress={() => setFilter(label)} />)}</View>
    {visible.length ? visible.map((purchase) => <PurchaseCard key={purchase.id} purchase={purchase} event={events.find((event) => event.id === purchase.eventoId)} onPress={() => onOpenPurchase(purchase.id)} />) : <EmptyState icon="ticket" title="Tu próxima historia está por empezar" description="Explorá eventos y encontrá un plan para sumar a tu agenda." action="Buscar un plan" onAction={onExplore} />}
    <Text style={[ui.caption, { textAlign: 'center' }]}>Compras de ejemplo · Explorá los distintos estados.</Text>
  </ScrollView>;
}
