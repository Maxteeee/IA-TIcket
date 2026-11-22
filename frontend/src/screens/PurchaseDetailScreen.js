import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, EventPoster, Icon, IconButton, ScreenHeader, StatusBadge } from '../components/MockUI';
import { colors, ui } from '../theme';
import { dateLabel, daysUntil, money } from '../utils/mockPresentation';
import { useMockSession } from '../session/MockSessionProvider';
import { canReviewPurchase, isOwnPurchase } from '../session/permissions';

export default function PurchaseDetailScreen({ purchase, event, onBack, onChat, onEvent, onReview, organizer = false }) {
  const { session } = useMockSession();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [stars, setStars] = useState(null);
  const [comment, setComment] = useState('');
  const ticket = event.tiposEntrada.find((item) => item.id === purchase.tipoEntradaId);
  const canReview = !organizer && canReviewPurchase(session, purchase, event);
  const canRequestCancellation = !organizer && isOwnPurchase(session, purchase)
    && ['CONFIRMADA', 'PENDIENTE'].includes(purchase.estado) && !event.finalizadoDemo && new Date(event.fecha) > new Date();

  return <View style={ui.screen}>
    <ScreenHeader title={organizer ? 'Detalle de la venta' : 'Tu entrada al plan'} subtitle={purchase.id} onBack={onBack} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <View style={{ borderRadius: 22, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border }}><EventPoster event={event} large style={{ height: 200 }} /><View style={{ padding: 20, gap: 14 }}><StatusBadge status={purchase.estado} /><Text style={[ui.title, { fontSize: 26 }]}>{event.nombre}</Text><Text style={ui.text}>{dateLabel(event.fecha, { weekday: 'long' })} · {event.lugar}</Text><View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border, marginVertical: 4 }} /><View style={ui.between}><View style={{ gap: 5 }}><Text style={ui.caption}>TIPO DE ENTRADA</Text><Text style={ui.label}>{ticket?.nombre}</Text></View><View style={{ gap: 5, alignItems: 'flex-end' }}><Text style={ui.caption}>CANTIDAD</Text><Text style={ui.label}>{purchase.cantidad} {purchase.cantidad === 1 ? 'entrada' : 'entradas'}</Text></View></View><View style={ui.between}><Text style={ui.text}>Total de la compra</Text><Text style={[ui.heading, { color: colors.primary }]}>{money(purchase.total)}</Text></View>{organizer ? <Text style={ui.caption}>Comprador: {purchase.comprador}</Text> : null}</View></View>
      {purchase.estado === 'CONFIRMADA' && new Date(event.fecha) > new Date() ? <View style={[ui.card, { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight, flexDirection: 'row', alignItems: 'center' }]}><View style={{ flex: 1 }}><Text style={{ color: colors.primary, fontSize: 30, fontWeight: '800' }}>{daysUntil(event.fecha)} días</Text><Text style={{ color: colors.primary, fontSize: 13 }}>para vivir esta experiencia</Text></View><Icon name="ticket" color={colors.primary} size={38} /></View> : null}
      {purchase.estado === 'PENDIENTE' ? <View style={[ui.card, { backgroundColor: colors.warningLight, borderColor: colors.warningLight }]}><Text style={[ui.label, { color: colors.warning }]}>Tu compra está pendiente de pago</Text><Text style={ui.text}>Este es un ejemplo del estado previo a la confirmación. El pago se incorporará en una próxima etapa.</Text></View> : null}
      <View style={ui.card}><View style={ui.row}><View style={styles.chatIcon}><Icon name="chat" color={colors.primary} size={28} /></View><View style={{ flex: 1, gap: 4 }}><Text style={ui.heading}>Sigamos en contacto</Text><Text style={ui.caption}>{organizer ? 'Respondé las consultas de esta compra.' : 'Consultá lo que necesites al organizador.'}</Text></View></View><Button title="Abrir conversación" secondary onPress={onChat} /></View>
      {canReview ? <View style={[ui.card, { borderColor: '#D8C1FA' }]}><Text style={ui.eyebrow}>¿CÓMO LA PASASTE?</Text><Text style={ui.heading}>Tu experiencia cuenta</Text><Text style={ui.text}>Tus entradas fueron utilizadas. Compartí cómo lo viviste.</Text><Button title="Escribir una reseña" icon="star" onPress={() => setReviewOpen(true)} /></View> : null}
      {!organizer && purchase.resenada ? <View style={ui.card}><Text style={[ui.label, { color: colors.success }]}>✓ Tu reseña de ejemplo fue guardada</Text><Text style={ui.caption}>Gracias por compartir tu experiencia.</Text></View> : null}
      <Button title="Ver el evento" secondary onPress={onEvent} />
      {canRequestCancellation ? <View style={{ gap: 7 }}><Button title="Cancelar compra · Próximamente" secondary disabled /><Text style={[ui.caption, { textAlign: 'center' }]}>El flujo de cancelación y reembolso está pendiente de definición.</Text></View> : null}
      <Text style={[ui.caption, { textAlign: 'center' }]}>Compra de demostración · Sin validez como entrada.</Text>
    </ScrollView>
    <Modal visible={reviewOpen} transparent animationType="slide" onRequestClose={() => setReviewOpen(false)}><KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Pressable onPress={() => setReviewOpen(false)} style={StyleSheet.absoluteFill} accessibilityLabel="Cerrar reseña" /><SafeAreaView edges={['bottom']} style={styles.sheet}><View style={ui.between}><Text style={[ui.heading, { flex: 1 }]}>¿Qué te llevás de este plan?</Text><IconButton name="close" label="Cerrar reseña" onPress={() => setReviewOpen(false)} /></View><Text style={ui.text}>{event.nombre}</Text><View style={[ui.row, { justifyContent: 'center', gap: 10 }]}><Pressable accessibilityRole="button" accessibilityLabel="Calificar con cero estrellas" accessibilityState={{ selected: stars === 0 }} onPress={() => setStars(0)} style={[styles.zeroStar, stars === 0 && { backgroundColor: colors.primaryLight }]}><Text style={{ color: colors.primary, fontWeight: '700' }}>0</Text></Pressable>{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Calificar con ${value} estrellas`} accessibilityState={{ selected: stars === value }} hitSlop={4} onPress={() => setStars(value)}><Icon name="star" color={stars !== null && value <= stars ? colors.primary : '#D8D0E4'} size={31} /></Pressable>)}</View><TextInput accessibilityLabel="Comentario de la reseña" value={comment} onChangeText={setComment} multiline maxLength={500} placeholder="Contá cómo fue tu experiencia…" placeholderTextColor={colors.muted} style={[ui.input, { height: 110, textAlignVertical: 'top' }]} /><Button title="Guardar reseña de ejemplo" disabled={stars === null || !comment.trim()} onPress={() => { if (canReview) { onReview(purchase.id, stars, comment.trim()); setReviewOpen(false); } }} /><Text style={[ui.caption, { textAlign: 'center' }]}>Se guarda solo durante esta demostración.</Text></SafeAreaView></KeyboardAvoidingView></Modal>
  </View>;
}

const styles = StyleSheet.create({
  chatIcon: { height: 50, width: 50, backgroundColor: colors.primaryLight, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: '#160B2B88', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, padding: 22, borderTopLeftRadius: 26, borderTopRightRadius: 26, gap: 19 },
  zeroStar: { width: 33, height: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
