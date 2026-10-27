import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { currentUser, initialEvents, initialMessages, initialPurchases, initialSales, organizers as organizerFixtures } from './data/mockData';
import { colors } from './theme';
import { Icon } from './components/MockUI';
import CatalogScreen from './screens/CatalogScreen';
import EventDetailScreen from './screens/EventDetailScreen';
import PurchasesScreen from './screens/PurchasesScreen';
import PurchaseDetailScreen from './screens/PurchaseDetailScreen';
import ChatScreen from './screens/ChatScreen';
import OrganizerScreen, { OrganizerEventScreen } from './screens/OrganizerScreen';
import CreateEventScreen from './screens/CreateEventScreen';

const initialFilters = { search: '', category: 'Todos', sort: 'fecha' };
const tabs = [
  { id: 'explore', label: 'Explorar', icon: 'explore' },
  { id: 'favorites', label: 'Favoritos', icon: 'heart' },
  { id: 'purchases', label: 'Compras', icon: 'ticket' },
  { id: 'organize', label: 'Organizar', icon: 'organize' },
];

export default function MockApp() {
  const [tab, setTab] = useState('explore');
  const [stack, setStack] = useState([]);
  const [events, setEvents] = useState(initialEvents);
  const [organizers, setOrganizers] = useState(organizerFixtures);
  const [favoriteIds, setFavoriteIds] = useState(['after', 'umbral']);
  const [purchases, setPurchases] = useState(initialPurchases);
  const [sales, setSales] = useState(initialSales);
  const [messages, setMessages] = useState(initialMessages);
  const [catalogFilters, setCatalogFilters] = useState(initialFilters);
  const [favoriteFilters, setFavoriteFilters] = useState(initialFilters);
  const counter = useRef(1);
  const route = stack[stack.length - 1];

  const back = () => setStack((current) => current.slice(0, -1));
  const open = (name, params = {}) => setStack((current) => [...current, { name, ...params }]);
  const toggleFavorite = (id) => setFavoriteIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const explore = () => { setStack([]); setTab('explore'); };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length) { setStack((current) => current.slice(0, -1)); return true; }
      if (tab !== 'explore') { setTab('explore'); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [stack.length, tab]);

  const simulatePurchase = (eventId, ticketId, quantity) => {
    const event = events.find((item) => item.id === eventId);
    const ticket = event.tiposEntrada.find((item) => item.id === ticketId);
    const purchase = {
      id: `DEMO-${counter.current++}`, eventoId: eventId, tipoEntradaId: ticketId,
      cantidad: quantity, total: ticket.precio * quantity, estado: 'PENDIENTE', comprador: currentUser.nombre,
    };
    // Es solo un escenario visual: no reserva cupo ni define el flujo real de pago.
    setPurchases((current) => [purchase, ...current]);
    if (event.organizadorId === currentUser.id) setSales((current) => [purchase, ...current]);
    setTab('purchases');
    setStack([{ name: 'purchase', id: purchase.id, role: 'comprador' }]);
  };

  const sendMessage = (id, text, role) => {
    const message = { id: `message-${counter.current++}`, autor: role, texto: text, hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) };
    setMessages((current) => ({ ...current, [id]: [...(current[id] ?? []), message] }));
  };

  const createEvent = (draft) => {
    const id = `demo-event-${counter.current++}`;
    const posters = { Música: 'night', Teatro: 'theater', Festivales: 'festival', Conferencias: 'talk', Deportes: 'sport' };
    const event = { ...draft, id, lugar: 'Lugar a confirmar', organizadorId: currentUser.id, poster: posters[draft.categoria], etiqueta: 'Un nuevo encuentro en tu agenda', tiposEntrada: draft.tiposEntrada.map((ticket, index) => ({ ...ticket, id: `${id}-ticket-${index}` })) };
    setEvents((current) => [...current, event]);
    setTab('organize');
    setStack([{ name: 'organizerEvent', eventId: id }]);
  };

  const saveReview = (purchaseId, stars, text) => {
    const purchase = purchases.find((item) => item.id === purchaseId);
    const event = events.find((item) => item.id === purchase.eventoId);
    if (purchase.estado !== 'UTILIZADA' || !event.finalizadoDemo || purchase.resenada) return;
    const review = { id: `review-${counter.current++}`, autor: currentUser.nombre, puntuacion: stars, detalle: text, evento: event.nombre };
    setOrganizers((current) => current.map((organizer) => organizer.id === event.organizadorId ? { ...organizer, resenias: [...organizer.resenias, review] } : organizer));
    setPurchases((current) => current.map((item) => item.id === purchaseId ? { ...item, resenada: true } : item));
  };

  let content;
  if (route?.name === 'event') {
    const event = events.find((item) => item.id === route.eventId);
    content = <EventDetailScreen key={event.id} event={event} organizer={organizers.find((item) => item.id === event.organizadorId)} favorite={favoriteIds.includes(event.id)} onFavorite={() => toggleFavorite(event.id)} onBack={back} onPurchase={simulatePurchase} />;
  } else if (route?.name === 'purchase' || route?.name === 'chat') {
    const role = route.role ?? 'comprador';
    const purchase = (role === 'organizador' ? sales : purchases).find((item) => item.id === route.id);
    const event = events.find((item) => item.id === purchase.eventoId);
    content = route.name === 'chat'
      ? <ChatScreen key={`${purchase.id}-${role}`} event={event} purchase={purchase} organizer={organizers.find((item) => item.id === event.organizadorId)} messages={messages[purchase.id] ?? []} role={role} onBack={back} onSend={sendMessage} />
      : <PurchaseDetailScreen key={`${purchase.id}-${role}`} purchase={purchase} event={event} organizer={role === 'organizador'} onBack={back} onChat={() => open('chat', { id: purchase.id, role })} onEvent={() => open('event', { eventId: event.id })} onReview={saveReview} />;
  } else if (route?.name === 'organizerEvent') {
    const event = events.find((item) => item.id === route.eventId);
    content = <OrganizerEventScreen event={event} sales={sales.filter((sale) => sale.eventoId === event.id)} onBack={back} onOpenPurchase={(id) => open('purchase', { id, role: 'organizador' })} onPreview={() => open('event', { eventId: event.id })} />;
  } else if (route?.name === 'create') {
    content = <CreateEventScreen onBack={back} onCreate={createEvent} />;
  } else if (tab === 'explore' || tab === 'favorites') {
    const saved = tab === 'favorites';
    content = <CatalogScreen key={tab} events={events} organizers={organizers} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} onOpenEvent={(eventId) => open('event', { eventId })} filters={saved ? favoriteFilters : catalogFilters} onFilters={saved ? setFavoriteFilters : setCatalogFilters} saved={saved} onExplore={explore} />;
  } else if (tab === 'purchases') {
    content = <PurchasesScreen purchases={purchases} events={events} onOpenPurchase={(id) => open('purchase', { id, role: 'comprador' })} onExplore={explore} />;
  } else {
    content = <OrganizerScreen events={events} sales={sales} onCreate={() => open('create')} onOpenEvent={(eventId) => open('organizerEvent', { eventId })} />;
  }

  return <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}><View style={{ flex: 1 }}>{content}</View>{!route ? <View style={styles.navigation}>{tabs.map((item) => {
    const selected = tab === item.id;
    return <Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected }} onPress={() => setTab(item.id)} style={styles.tab}><View style={[styles.tabIcon, selected && { backgroundColor: colors.primaryLight }]}><Icon name={item.icon} color={selected ? colors.primary : '#9A91A7'} size={23} /></View><Text style={{ fontSize: 10, fontWeight: selected ? '800' : '500', color: selected ? colors.primary : colors.muted }}>{item.label}</Text></Pressable>;
  })}</View> : null}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  navigation: { flexDirection: 'row', backgroundColor: '#fff', paddingTop: 9, paddingBottom: 8, borderTopWidth: 1, borderColor: colors.border },
  tab: { flex: 1, alignItems: 'center', gap: 4, minHeight: 54, justifyContent: 'center' },
  tabIcon: { width: 53, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
