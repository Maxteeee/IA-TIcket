import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, ui } from '../theme';
import { dateLabel, money, priceRange, rating, statusLabels } from '../utils/mockPresentation';

export function Icon({ name, color = colors.ink, size = 23 }) {
  if (name === 'search') {
    return <View style={{ width: size, height: size }}><View style={{ width: size * 0.63, height: size * 0.63, borderWidth: 1.8, borderColor: color, borderRadius: size, margin: 1 }} /><View style={{ position: 'absolute', width: size * 0.35, height: 1.8, backgroundColor: color, transform: [{ rotate: '45deg' }], bottom: 3, right: 0 }} /></View>;
  }
  if (name === 'organize') {
    return <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'flex-end', gap: 3, padding: 2 }}>{[0.45, 0.8, 0.6].map((height, index) => <View key={index} style={{ flex: 1, height: size * height, borderWidth: 1.6, borderColor: color, borderRadius: 2 }} />)}</View>;
  }
  if (name === 'ticket') {
    return <View style={{ width: size, height: size * 0.72, borderWidth: 1.7, borderColor: color, borderRadius: 4, transform: [{ rotate: '-12deg' }], flexDirection: 'row', justifyContent: 'flex-end', paddingRight: 5 }}><View style={{ borderLeftWidth: 1, borderStyle: 'dashed', borderColor: color, height: '100%' }} /></View>;
  }
  const symbols = { explore: '◈', heart: '♡', filledHeart: '♥', back: '←', arrow: '↗', plus: '+', minus: '−', close: '×', chat: '↔', check: '✓', star: '★', send: '↑' };
  return <Text allowFontScaling={false} style={{ color, fontSize: size, lineHeight: size + 4, fontWeight: '500', textAlign: 'center' }}>{symbols[name] ?? '•'}</Text>;
}

export function Button({ title, onPress, secondary = false, disabled = false, icon, style }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, (pressed || disabled) && { opacity: 0.55 }, style]}>
    <Text style={[styles.buttonText, secondary && { color: colors.primary }]}>{title}</Text>
    {icon ? <Icon name={icon} color={secondary ? colors.primary : '#fff'} size={20} /> : null}
  </Pressable>;
}

export function IconButton({ name, label, onPress, active = false, disabled = false, style }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active, disabled }} disabled={disabled} hitSlop={5} onPress={onPress} style={({ pressed }) => [styles.iconButton, active && { backgroundColor: colors.primaryLight }, (pressed || disabled) && { opacity: 0.6 }, style]}>
    <Icon name={name} color={active ? colors.primary : colors.ink} />
  </Pressable>;
}

export function Chip({ label, selected, onPress, disabled = false }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.chip, selected && styles.selectedChip, disabled && { opacity: 0.6 }]}><Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text></Pressable>;
}

export function ScreenHeader({ title, subtitle, onBack, action }) {
  return <View style={styles.screenHeader}>
    {onBack ? <IconButton name="back" label="Volver" onPress={onBack} /> : null}
    <View style={{ flex: 1, gap: 3 }}><Text style={styles.headerTitle}>{title}</Text>{subtitle ? <Text numberOfLines={1} style={ui.caption}>{subtitle}</Text> : null}</View>
    {action}
  </View>;
}

export function Rating({ organizer, light = false }) {
  const value = rating(organizer);
  const count = organizer?.cantidadResenias ?? organizer?.resenias?.length ?? 0;
  return <View accessibilityLabel={value === null ? 'Organizador sin reseñas' : `Puntaje del organizador: ${value.toFixed(1)} de 5, ${count} reseñas`} style={[ui.row, { gap: 4 }]}><Icon name="star" size={13} color={light ? colors.lime : colors.primary} /><Text style={{ fontSize: 12, fontWeight: '700', color: light ? '#fff' : colors.ink }}>{value === null ? 'Sin reseñas' : `${value.toFixed(1).replace('.', ',')} (${count})`}</Text></View>;
}

export function StatusBadge({ status }) {
  const palettes = {
    CONFIRMADA: [colors.successLight, colors.success], PENDIENTE: [colors.warningLight, colors.warning],
    UTILIZADA: [colors.primaryLight, colors.primary], CANCELADA: ['#FCECEF', colors.danger], REEMBOLSADA: ['#EBEEF6', '#5D6683'],
  };
  const [backgroundColor, color] = palettes[status] ?? [colors.primaryLight, colors.primary];
  return <View style={[styles.badge, { backgroundColor }]}><View style={{ height: 5, width: 5, borderRadius: 3, backgroundColor: color }} /><Text style={{ color, fontSize: 11, fontWeight: '700' }}>{statusLabels[status] ?? status}</Text></View>;
}

const posterThemes = {
  night: { background: '#4B19A1', accent: '#D5F776', title: 'AFTER\nHOURS.', kicker: 'LIVE SESSIONS', number: '01' },
  theater: { background: '#F1BDA9', accent: '#421C43', title: 'EL\nUMBRAL', kicker: 'TEATRO EN VIVO', number: '02' },
  festival: { background: '#F180B4', accent: '#462083', title: 'PRIMA\nVERA.', kicker: 'MÚSICA AL AIRE LIBRE', number: '03' },
  talk: { background: '#163E4D', accent: '#AEEDD5', title: 'IDEAS QUE\nCONECTAN', kicker: 'PREGUNTAS GRANDES', number: '04' },
  sport: { background: '#E5773D', accent: '#FFF0CF', title: 'LA CIUDAD\nJUEGA.', kicker: 'PASIÓN COMPARTIDA', number: '05' },
  vinyl: { background: '#30315B', accent: '#E5C1E9', title: 'NOCHE DE\nVINILOS', kicker: 'LADO A / LADO B', number: '06' },
};

export function EventPoster({ event, large = false, compact = false, style }) {
  const theme = posterThemes[event.poster] ?? posterThemes.night;
  return <View accessibilityElementsHidden style={[styles.poster, { height: large ? 260 : compact ? 76 : 154, backgroundColor: theme.background }, style]}>
    <View pointerEvents="none" style={[styles.posterRing, { borderColor: theme.accent, width: large ? 220 : 150, height: large ? 220 : 150, right: large ? -58 : -65, bottom: large ? -65 : -66 }]} />
    <View pointerEvents="none" style={[styles.posterRing, { borderColor: theme.accent, width: large ? 170 : 105, height: large ? 170 : 105, right: large ? -33 : -43, bottom: large ? -40 : -44 }]} />
    <View pointerEvents="none" style={{ position: 'absolute', width: large ? 90 : 54, height: large ? 90 : 54, backgroundColor: theme.accent, opacity: 0.17, right: 20, top: -20, transform: [{ rotate: '25deg' }] }} />
    {!compact ? <Text numberOfLines={1} style={{ color: theme.accent, fontSize: large ? 10 : 7, fontWeight: '700', letterSpacing: 1.7 }}>{theme.kicker}</Text> : null}
    <Text numberOfLines={2} allowFontScaling={false} style={{ color: theme.accent, fontSize: large ? 51 : compact ? 15 : 28, lineHeight: large ? 50 : compact ? 16 : 28, letterSpacing: -1.5, fontWeight: '900', marginTop: large ? 30 : compact ? 0 : 20 }}>{event.posterTitle ?? theme.title}</Text>
    {!compact ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 'auto' }}><View style={{ width: 15, height: 1, backgroundColor: theme.accent }} /><Text style={{ color: theme.accent, fontSize: 7, letterSpacing: 1.4 }}>AI TICKET IT · {theme.number}</Text></View> : null}
  </View>;
}

export function EventCard({ event, organizer, favorite, onOpen, onFavorite, showRating = true }) {
  const range = priceRange(event);
  return <View style={styles.eventCard}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Ver ${event.nombre}`} onPress={onOpen}>
      <EventPoster event={event} />
      <View style={{ padding: 12, gap: 7 }}>
        <Text numberOfLines={1} style={[ui.eyebrow, { fontSize: 9, letterSpacing: 0.7 }]}>{dateLabel(event.fecha, { weekday: 'short' }).toUpperCase()}</Text>
        <Text numberOfLines={2} style={{ fontSize: 16, fontWeight: '800', lineHeight: 21, color: colors.ink, minHeight: 42 }}>{event.nombre}</Text>
        <Text numberOfLines={1} style={[ui.caption, { fontSize: 10 }]}>{event.categoria} · {event.lugar.split(' · ')[0]}</Text>
        <View style={ui.divider} />
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>{money(range.min)}{range.max > range.min ? ` – ${money(range.max)}` : ''}</Text>
        {showRating ? <Rating organizer={organizer} /> : null}
      </View>
    </Pressable>
    {onFavorite ? <Pressable accessibilityRole="button" accessibilityLabel={favorite ? `Quitar ${event.nombre} de favoritos` : `Guardar ${event.nombre}`} accessibilityState={{ selected: favorite }} onPress={onFavorite} hitSlop={5} style={styles.cardHeart}><Icon name={favorite ? 'filledHeart' : 'heart'} color={colors.primary} size={21} /></Pressable> : null}
  </View>;
}

export function EmptyState({ title, description, action, onAction, icon = 'explore' }) {
  return <View style={styles.empty}><View style={styles.emptyIcon}><Icon name={icon} color={colors.primary} size={35} /></View><Text style={[ui.heading, { textAlign: 'center' }]}>{title}</Text><Text style={[ui.text, { textAlign: 'center' }]}>{description}</Text>{action ? <Button title={action} onPress={onAction} style={{ marginTop: 6 }} /> : null}</View>;
}

const styles = StyleSheet.create({
  button: { minHeight: 52, backgroundColor: colors.primary, borderRadius: 15, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryButton: { backgroundColor: colors.primaryLight },
  iconButton: { height: 44, width: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chip: { paddingHorizontal: 17, paddingVertical: 11, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selectedChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  screenHeader: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.background },
  headerTitle: { fontSize: 19, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  poster: { padding: 16, overflow: 'hidden' },
  posterRing: { position: 'absolute', borderWidth: 1, borderRadius: 200, opacity: 0.5 },
  eventCard: { flex: 1, maxWidth: '49%', backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  cardHeart: { position: 'absolute', right: 9, top: 9, backgroundColor: '#FFFFFFEE', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingHorizontal: 25, paddingVertical: 42, gap: 12, alignItems: 'center' },
  emptyIcon: { height: 78, width: 78, borderRadius: 26, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
});
