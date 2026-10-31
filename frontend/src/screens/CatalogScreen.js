import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { categories as mockCategories } from '../data/mockData';
import { useMockSession } from '../session/MockSessionProvider';
import { colors, ui } from '../theme';
import { Chip, EmptyState, EventCard, Icon } from '../components/MockUI';
import { selectEvents } from '../utils/mockPresentation';

export default function CatalogScreen({ events, organizers, favoriteIds = [], onToggleFavorite, onOpenEvent, filters, onFilters, saved = false, onExplore, availableCategories, serverFiltered = false, showSort = true, showRatings = true, loading = false, error = '', onRetry, onRefresh }) {
  const { session } = useMockSession();
  const categories = availableCategories ?? mockCategories.map((nombre) => ({ id: nombre, nombre }));
  const visible = serverFiltered ? events : selectEvents(events, organizers, { ...filters, favoriteIds: saved ? favoriteIds : null });
  const musicCategory = categories.find((category) => category.nombre === 'Música');
  const activeFilters = Boolean(filters.search || filters.category !== 'Todos');
  const header = <View style={{ gap: 22, paddingBottom: 20 }}>
    <View style={ui.between}>
      <View style={[ui.row, { gap: 9 }]}><View style={styles.brandMark}><Icon name="ticket" color="#fff" size={24} /></View><Text style={styles.brand}>ai ticket<Text style={{ color: colors.primary }}> it.</Text></Text></View>
      <View style={ui.row}><View style={styles.demo}><Text style={styles.demoText}>DEMO</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>{session.usuario.initials}</Text></View></View>
    </View>
    <View style={{ gap: 7 }}><Text style={ui.eyebrow}>{saved ? 'TU PRÓXIMO PLAN, GUARDADO' : 'SALÍ DE LA RUTINA'}</Text><Text style={styles.heroTitle}>{saved ? 'Tus ganas de\nvolver a salir.' : 'Hay un plan\ncon tu nombre.'}</Text><Text style={ui.text}>{saved ? 'Los eventos que te gustan, en un solo lugar.' : 'Descubrí eso que no te querés perder.'}</Text></View>
    {!saved && !activeFilters && musicCategory ? <Pressable accessibilityRole="button" accessibilityLabel="Explorar eventos de música" onPress={() => onFilters({ ...filters, category: musicCategory.id })} style={styles.banner}>
      <View style={{ flex: 1, gap: 9 }}><Text style={styles.bannerEyebrow}>LA AGENDA ESTÁ ABIERTA</Text><Text style={styles.bannerTitle}>{'Menos scroll.\nMás estar ahí.'}</Text><View style={[ui.row, { gap: 7 }]}><Text style={styles.bannerLink}>Encontrá tu próxima noche</Text><Icon name="arrow" color={colors.lime} size={19} /></View></View>
      <View style={styles.bannerArt}><View style={styles.bannerDisc} /><View style={[styles.bannerDisc, { width: 72, height: 72 }]} /><View style={styles.bannerCenter}><Icon name="ticket" color={colors.primaryDark} size={34} /></View></View>
    </Pressable> : null}
    <View style={styles.search}><Icon name="search" color={colors.muted} size={20} /><TextInput accessibilityLabel="Buscar eventos" placeholder="¿Qué te gustaría vivir?" placeholderTextColor={colors.muted} value={filters.search} onChangeText={(search) => onFilters({ ...filters, search })} style={styles.searchInput} returnKeyType="search" maxLength={200} />{filters.search ? <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" hitSlop={10} onPress={() => onFilters({ ...filters, search: '' })}><Icon name="close" color={colors.muted} /></Pressable> : null}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{categories.map((category) => <Chip key={category.id} label={category.nombre} selected={filters.category === category.id} onPress={() => onFilters({ ...filters, category: category.id })} />)}</ScrollView>
    <View style={{ gap: 13 }}><View style={ui.between}><Text style={ui.heading}>{saved ? 'Tu selección' : activeFilters ? 'Encontrá tu plan' : 'Elegí tu próxima experiencia'}</Text><Text style={ui.caption}>{loading ? 'Buscando…' : error ? '' : `${visible.length} ${visible.length === 1 ? 'evento' : 'eventos'}`}</Text></View>{showSort ? <View style={[ui.row, { gap: 6 }]}><Text style={[ui.caption, { marginRight: 2 }]}>Ordenar:</Text>{[['fecha', 'Fecha ↑'], ['precio', 'Precio ↑'], ['puntaje', 'Puntaje ↓']].map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Ordenar por ${value === 'fecha' ? 'fecha más próxima' : value === 'precio' ? 'precio de menor a mayor' : 'puntaje del organizador de mayor a menor'}`} accessibilityState={{ selected: filters.sort === value }} onPress={() => onFilters({ ...filters, sort: value })} style={[styles.sort, filters.sort === value && { backgroundColor: colors.primaryLight }]}><Text style={{ fontSize: 11, fontWeight: '700', color: filters.sort === value ? colors.primary : colors.muted }}>{label}</Text></Pressable>)}</View> : null}</View>
  </View>;

  let empty;
  if (loading) {
    empty = <View accessibilityRole="progressbar" style={{ alignItems: 'center', padding: 35, gap: 12 }}><ActivityIndicator color={colors.primary} /><Text style={ui.text}>Buscando eventos…</Text></View>;
  } else if (error) {
    empty = <View accessibilityRole="alert"><EmptyState title="No pudimos cargar los eventos" description={error} action="Volver a intentar" onAction={onRetry} />{activeFilters ? <Pressable accessibilityRole="button" onPress={() => onFilters({ ...filters, search: '', category: 'Todos' })} style={{ alignSelf: 'center', padding: 15 }}><Text style={ui.label}>Limpiar filtros</Text></Pressable> : null}</View>;
  } else {
    const noFavorites = saved && !favoriteIds.length;
    empty = <EmptyState icon={saved ? 'heart' : 'search'} title={noFavorites ? 'Acá empiezan tus próximos planes' : activeFilters ? 'No encontramos ese plan' : 'Todavía no hay eventos publicados'} description={noFavorites ? 'Tocá el corazón de un evento para guardarlo y encontrarlo después.' : activeFilters ? 'Probá otra búsqueda o explorá todas las categorías.' : 'Volvé a consultar más adelante.'} action={noFavorites ? 'Explorar eventos' : activeFilters ? 'Limpiar filtros' : onRefresh ? 'Actualizar' : undefined} onAction={noFavorites ? onExplore : activeFilters ? () => onFilters({ ...filters, search: '', category: 'Todos' }) : onRefresh} />;
  }
  return <FlatList style={ui.screen} data={loading || error ? [] : visible} keyExtractor={(event) => event.id} numColumns={2} columnWrapperStyle={{ gap: 12, marginBottom: 16 }} contentContainerStyle={{ padding: 20, paddingBottom: 28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" onRefresh={onRefresh} refreshing={Boolean(loading && visible.length)} ListHeaderComponent={header} renderItem={({ item }) => <EventCard event={item} organizer={organizers.find((organizer) => organizer.id === item.organizadorId)} favorite={favoriteIds.includes(item.id)} onFavorite={onToggleFavorite ? () => onToggleFavorite(item.id) : undefined} onOpen={() => onOpenEvent(item.id)} showRating={showRatings} />} ListEmptyComponent={empty} />;
}

const styles = StyleSheet.create({
  brand: { fontSize: 22, fontWeight: '900', color: colors.ink, letterSpacing: -1 },
  brandMark: { height: 37, width: 37, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  demo: { backgroundColor: colors.primaryLight, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5 },
  demoText: { color: colors.primary, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  avatar: { width: 36, height: 36, backgroundColor: '#EAE4F4', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 11, fontWeight: '800', color: colors.primaryDark },
  heroTitle: { fontSize: 37, lineHeight: 41, letterSpacing: -1.7, fontWeight: '800', color: colors.ink },
  banner: { flexDirection: 'row', padding: 22, backgroundColor: colors.primary, borderRadius: 23, minHeight: 178, overflow: 'hidden' },
  bannerEyebrow: { fontSize: 8, fontWeight: '700', letterSpacing: 1.6, color: '#E6D6FF' },
  bannerTitle: { fontSize: 27, lineHeight: 30, letterSpacing: -0.8, color: '#fff', fontWeight: '800' },
  bannerLink: { fontSize: 10, color: colors.lime, fontWeight: '700' },
  bannerArt: { width: 100, justifyContent: 'center', alignItems: 'center', marginRight: -12 },
  bannerDisc: { position: 'absolute', width: 115, height: 115, borderWidth: 1, borderColor: '#C9A4FF', borderRadius: 100, transform: [{ rotate: '-25deg' }] },
  bannerCenter: { width: 55, height: 55, backgroundColor: colors.lime, borderRadius: 17, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '15deg' }] },
  search: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, minHeight: 53 },
  searchInput: { flex: 1, paddingVertical: 14, color: colors.ink, fontSize: 14 },
  sort: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 8 },
});
