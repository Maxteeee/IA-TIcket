import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, EventPoster, Icon, IconButton, Rating, ScreenHeader } from '../components/MockUI';
import { colors, ui } from '../theme';
import { dateLabel, money, priceRange } from '../utils/mockPresentation';
import { useMockSession } from '../session/MockSessionProvider';
import { canPurchase } from '../session/permissions';

export default function EventDetailScreen({ event, organizer, favorite, onFavorite, onBack, onPurchase, onManage }) {
  const { session } = useMockSession();
  const purchaseAllowed = canPurchase(session, event);
  const available = event.tiposEntrada.filter((ticket) => ticket.cupo > 0);
  const [selectedId, setSelectedId] = useState(available[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [checkout, setCheckout] = useState(false);
  const selected = available.find((ticket) => ticket.id === selectedId);
  const range = priceRange(event);

  return <View style={ui.screen}>
    <ScreenHeader title="Tu próximo plan" onBack={onBack} action={<IconButton name={favorite ? 'filledHeart' : 'heart'} label={favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'} active={favorite} onPress={onFavorite} />} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ marginHorizontal: 20, borderRadius: 22, overflow: 'hidden' }}><EventPoster event={event} large /></View>
      <View style={ui.content}>
        {onManage ? <Button title="Administrar mi evento" secondary onPress={onManage} /> : null}
        <View style={{ gap: 10 }}><View style={ui.between}><Text style={ui.eyebrow}>{event.categoria.toUpperCase()}</Text><Text style={ui.caption}>{event.finalizadoDemo ? 'Evento finalizado' : 'Vivilo en persona'}</Text></View><Text style={ui.title}>{event.nombre}</Text><Text style={ui.text}>{event.etiqueta}</Text></View>
        <View style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: 15 }]}><View style={styles.dateTile}><Text style={styles.dateNumber}>{new Date(event.fecha).getDate()}</Text><Text style={styles.dateMonth}>{new Date(event.fecha).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '').toUpperCase()}</Text></View><View style={{ flex: 1, gap: 5 }}><Text style={ui.label}>{dateLabel(event.fecha, { weekday: 'long' })} · {new Date(event.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} h</Text><Text style={ui.caption}>{event.lugar}</Text></View></View>
        <View style={{ gap: 9 }}><Text style={ui.heading}>El plan</Text><Text style={ui.text}>{event.descripcion}</Text></View>
        <View style={ui.card}><View style={ui.row}><View style={styles.organizerAvatar}><Text style={{ color: colors.primary, fontWeight: '800' }}>{organizer.initials}</Text></View><View style={{ flex: 1, gap: 5 }}><Text style={ui.caption}>Organiza</Text><Text style={ui.label}>{organizer.nombre}</Text></View><Rating organizer={organizer} /></View></View>
        <View style={{ gap: 13 }}><View style={ui.between}><Text style={ui.heading}>Elegí cómo vivirlo</Text><Text style={ui.caption}>{event.tiposEntrada.length} opciones</Text></View>
          {event.tiposEntrada.map((ticket) => <Pressable key={ticket.id} accessibilityRole="radio" accessibilityState={{ checked: selectedId === ticket.id, disabled: ticket.cupo === 0 || !purchaseAllowed }} disabled={ticket.cupo === 0 || !purchaseAllowed} onPress={() => { setSelectedId(ticket.id); setQuantity(1); }} style={[styles.ticket, selectedId === ticket.id && styles.selectedTicket, ticket.cupo === 0 && { opacity: 0.55 }]}><View style={[styles.radio, selectedId === ticket.id && { borderColor: colors.primary }]}>{selectedId === ticket.id ? <View style={styles.radioCenter} /> : null}</View><View style={{ flex: 1, gap: 4 }}><View style={ui.between}><Text style={ui.label}>{ticket.nombre}</Text><Text style={styles.ticketPrice}>{money(ticket.precio)}</Text></View><Text style={ui.caption}>{ticket.descripcion}</Text><Text style={{ fontSize: 11, color: ticket.cupo > 0 ? colors.success : colors.muted, marginTop: 3 }}>{ticket.cupo > 0 ? `${ticket.cupo} disponibles` : 'Agotadas'}</Text></View></Pressable>)}
          {selected && purchaseAllowed ? <View style={[ui.between, { paddingVertical: 8 }]}><View><Text style={ui.label}>¿Cuántas entradas?</Text><Text style={ui.caption}>El plan es mejor en compañía.</Text></View><View style={[ui.row, { gap: 17 }]}><IconButton name="minus" label="Quitar una entrada" onPress={() => setQuantity(Math.max(1, quantity - 1))} /><Text style={[ui.label, { fontSize: 18 }]}>{quantity}</Text><IconButton name="plus" label="Agregar una entrada" onPress={() => setQuantity(Math.min(selected.cupo, quantity + 1))} /></View></View> : null}
        </View>
        <View style={{ gap: 14 }}><Text style={ui.heading}>Experiencias que hablan</Text><Text style={ui.caption}>Reseñas de eventos anteriores de {organizer.nombre}.</Text>{organizer.resenias.length ? organizer.resenias.map((review) => <View key={review.id} style={ui.card}><View style={ui.between}><Text style={ui.label}>{review.autor}</Text><Text style={{ color: colors.primary, fontWeight: '700' }}>★ {review.puntuacion}/5</Text></View><Text style={ui.text}>{review.detalle}</Text><Text style={ui.caption}>{review.evento}</Text></View>) : <View style={ui.card}><Text style={ui.label}>Una nueva historia comienza</Text><Text style={ui.text}>Este organizador todavía no tiene reseñas.</Text></View>}</View>
      </View>
    </ScrollView>
    {purchaseAllowed ? <View style={styles.footer}><View style={{ flex: 1, gap: 3 }}><Text style={ui.caption}>{selected ? `${quantity} ${quantity === 1 ? 'entrada' : 'entradas'}` : 'Entradas desde'}</Text><Text style={styles.total}>{money(selected ? selected.precio * quantity : range.min)}</Text></View><Button title={selected ? 'Continuar' : 'Agotado'} disabled={!selected} icon="arrow" onPress={() => setCheckout(true)} /></View> : null}
    <Modal visible={checkout} transparent animationType="slide" onRequestClose={() => setCheckout(false)}><View style={styles.overlay}><Pressable accessibilityLabel="Cerrar resumen" onPress={() => setCheckout(false)} style={StyleSheet.absoluteFill} /><SafeAreaView edges={['bottom']} style={styles.sheet}><View style={styles.handle} /><View style={ui.between}><Text style={ui.heading}>Tu próxima experiencia</Text><IconButton name="close" label="Cerrar resumen" onPress={() => setCheckout(false)} /></View><Text style={ui.text}>{event.nombre}</Text><View style={ui.card}><View style={ui.between}><Text style={ui.label}>{selected?.nombre} × {quantity}</Text><Text style={ui.label}>{money((selected?.precio ?? 0) * quantity)}</Text></View><View style={ui.divider} /><View style={ui.between}><Text style={ui.heading}>Total</Text><Text style={[ui.heading, { color: colors.primary }]}>{money((selected?.precio ?? 0) * quantity)}</Text></View></View><Button title="Simular compra" icon="ticket" onPress={() => { if (purchaseAllowed && selected) { setCheckout(false); onPurchase(event.id, selected.id, quantity); } }} /><Text style={[ui.caption, { textAlign: 'center' }]}>Vista de prueba. No se realiza ningún cobro.</Text></SafeAreaView></View></Modal>
  </View>;
}

const styles = StyleSheet.create({
  dateTile: { width: 57, height: 64, borderRadius: 13, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', gap: 1 },
  dateNumber: { color: colors.primary, fontWeight: '800', fontSize: 25 },
  dateMonth: { color: colors.primary, fontWeight: '700', fontSize: 9, letterSpacing: 1 },
  organizerAvatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  ticket: { backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 13 },
  selectedTicket: { backgroundColor: '#F4EEFF', borderColor: colors.primary },
  ticketPrice: { fontSize: 15, fontWeight: '800', color: colors.primary },
  radio: { height: 20, width: 20, borderWidth: 1.5, borderColor: '#C9C0D8', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radioCenter: { height: 10, width: 10, borderRadius: 5, backgroundColor: colors.primary },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 22, paddingVertical: 14, borderTopWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  total: { fontSize: 25, fontWeight: '800', letterSpacing: -0.8, color: colors.ink },
  overlay: { flex: 1, backgroundColor: '#160B2B88', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, padding: 24, gap: 18, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { height: 4, width: 38, borderRadius: 2, backgroundColor: '#DAD2E6', alignSelf: 'center' },
});
