import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initialEvents, initialFavoritesByUser, initialMessages, initialPurchases, organizers as organizerFixtures } from './data/mockData';
import { colors } from './theme';
import { EmptyState, Icon, ScreenHeader } from './components/MockUI';
import SessionSwitcher from './components/SessionSwitcher';
import { useMockSession } from './session/MockSessionProvider';
import { RolUsuario } from './session/roles';
import { canAccessPurchase, canAccessRoute, canManageEvent, canOrganize, canPurchase, canReviewPurchase, hasRole, selectSessionData } from './session/permissions';
import CatalogScreen from './screens/CatalogScreen';
import ConnectedCatalogScreen from './screens/ConnectedCatalogScreen';
import CatalogEventScreen from './screens/CatalogEventScreen';
import EventDetailScreen from './screens/EventDetailScreen';
import PurchasesScreen from './screens/PurchasesScreen';
import ConnectedPurchasesScreen from './screens/ConnectedPurchasesScreen';
import PurchaseDetailScreen from './screens/PurchaseDetailScreen';
import ChatScreen from './screens/ChatScreen';
import ConnectedChatScreen from './screens/ConnectedChatScreen';
import OrganizerScreen, { OrganizerEventScreen } from './screens/OrganizerScreen';
import CreateEventScreen from './screens/CreateEventScreen';
import ConnectedCreateEventScreen from './screens/ConnectedCreateEventScreen';
import ConnectedOrganizerScreen from './screens/ConnectedOrganizerScreen';
import EventSalesScreen from './screens/EventSalesScreen';
import PurchaseReceiptScreen from './screens/PurchaseReceiptScreen';
import PurchaseReviewScreen from './screens/PurchaseReviewScreen';

const initialFilters = { search: '', category: 'Todos', sort: 'fecha' };
const tabs = [
  { id: 'explore', label: 'Explorar', icon: 'explore', role: RolUsuario.COMPRADOR },
  { id: 'favorites', label: 'Favoritos', icon: 'heart', role: RolUsuario.COMPRADOR },
  { id: 'purchases', label: 'Compras', icon: 'ticket', role: RolUsuario.COMPRADOR },
  { id: 'organize', label: 'Organizar', icon: 'organize', role: RolUsuario.ORGANIZADOR },
];

export default function MockApp() {
  const { session, nextSession, switchProfile } = useMockSession();
  const userId = session.usuario.id;
  const [tab, setTab] = useState('explore');
  const [stack, setStack] = useState([]);
  const [events, setEvents] = useState(initialEvents);
  const [organizers, setOrganizers] = useState(organizerFixtures);
  const [favoritesByUser, setFavoritesByUser] = useState(initialFavoritesByUser);
  const [allPurchases, setAllPurchases] = useState(initialPurchases);
  const [messages, setMessages] = useState(initialMessages);
  const [catalogFiltersByUser, setCatalogFiltersByUser] = useState({});
  const [favoriteFiltersByUser, setFavoriteFiltersByUser] = useState({});
  const counter = useRef(1);
  const route = stack[stack.length - 1];
  const { purchases, sales, favoriteIds } = selectSessionData(session, { events, purchases: allPurchases, favoritesByUser });
  const visibleTabs = tabs.filter((item) => hasRole(session, item.role));

  const back = () => setStack((current) => current.slice(0, -1));
  const open = (name, params = {}) => {
    const destination = { name, ...params };
    if (canAccessRoute(session, destination, { events, purchases: allPurchases })) {
      setStack((current) => [...current, destination]);
    }
  };
  const toggleFavorite = (id) => {
    if (!hasRole(session, RolUsuario.COMPRADOR) || !events.some((event) => event.id === id)) return;
    setFavoritesByUser((current) => {
      const own = current[userId] ?? [];
      return { ...current, [userId]: own.includes(id) ? own.filter((item) => item !== id) : [...own, id] };
    });
  };
  const explore = () => { setStack([]); setTab('explore'); };
  const showPurchases = () => { setStack([]); setTab('purchases'); };
  const changeProfile = () => {
    // Los datos compartidos permanecen; se descarta la navegación del otro perfil.
    setStack([]);
    setTab(canOrganize(nextSession) ? 'organize' : 'explore');
    switchProfile();
  };

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
    const ticket = event?.tiposEntrada.find((item) => item.id === ticketId);
    if (!canPurchase(session, event) || !ticket || !Number.isInteger(quantity) || quantity < 1 || quantity > ticket.cupo) return;
    const purchase = {
      id: `DEMO-${counter.current++}`, eventoId: eventId, tipoEntradaId: ticketId,
      cantidad: quantity, total: ticket.precio * quantity, estado: 'PENDIENTE',
      compradorId: userId, comprador: session.usuario.nombre,
    };
    // La maqueta sigue sin cobrar ni reservar cupos en el backend.
    setAllPurchases((current) => [purchase, ...current]);
    setTab('purchases');
    setStack([{ name: 'purchase', id: purchase.id, role: 'comprador' }]);
  };

  const sendMessage = (id, text) => {
    const purchase = allPurchases.find((item) => item.id === id);
    const event = events.find((item) => item.id === purchase?.eventoId);
    if (!canAccessPurchase(session, purchase, event) || !text.trim()) return;
    const message = { id: `message-${counter.current++}`, usuarioId: userId, texto: text.trim(), hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) };
    setMessages((current) => ({ ...current, [id]: [...(current[id] ?? []), message] }));
  };

  const eventPublished = (event) => {
    if (!canManageEvent(session, event)) return;
    setTab('organize');
    setStack([{ name: 'publishedEvent', eventId: event.id, published: true }]);
  };

  const purchaseRegistered = (purchase) => {
    if (purchase.compradorId !== userId || !hasRole(session, RolUsuario.COMPRADOR)) return;
    setTab('purchases');
    setStack([{ name: 'purchaseReceipt', purchaseId: purchase.id }]);
  };

  const editEvent = (eventId, changes) => {
    const event = events.find((item) => item.id === eventId);
    if (!canManageEvent(session, event)) return;
    const { nombre, descripcion, categoria } = changes;
    setEvents((current) => current.map((item) => item.id === eventId ? { ...item, nombre, descripcion, categoria } : item));
    back();
  };

  const saveReview = (purchaseId, stars, text) => {
    const purchase = allPurchases.find((item) => item.id === purchaseId);
    const event = events.find((item) => item.id === purchase?.eventoId);
    if (!canReviewPurchase(session, purchase, event) || !Number.isFinite(stars) || stars < 0 || stars > 5 || !text.trim()) return;
    const review = { id: `review-${counter.current++}`, usuarioId: userId, autor: session.usuario.nombre, puntuacion: stars, detalle: text.trim(), evento: event.nombre };
    setOrganizers((current) => current.map((organizer) => organizer.id === event.organizadorId ? { ...organizer, resenias: [...organizer.resenias, review] } : organizer));
    setAllPurchases((current) => current.map((item) => item.id === purchaseId ? { ...item, resenada: true } : item));
  };

  let content;
  if (!canAccessRoute(session, route, { events, purchases: allPurchases })) {
    content = <EmptyState title="Esta vista no está disponible" description="Volvé al inicio para continuar con tu perfil activo." action="Ir al inicio" onAction={explore} />;
  } else if (route?.name === 'purchaseReceipt') {
    content = <PurchaseReceiptScreen key={`${userId}:${route.purchaseId}`} purchaseId={route.purchaseId} onBack={back}
      onEvent={(eventId) => setStack([{ name: 'catalogEvent', eventId }])} onExplore={explore} onPurchases={showPurchases}
      onChat={() => open('purchaseChat', { purchaseId: route.purchaseId })}
      onReview={() => open('purchaseReview', { purchaseId: route.purchaseId })} />;
  } else if (route?.name === 'purchaseReview') {
    content = <PurchaseReviewScreen key={route.purchaseId} purchaseId={route.purchaseId} onBack={back} />;
  } else if (route?.name === 'purchaseChat') {
    content = <ConnectedChatScreen key={route.purchaseId} purchaseId={route.purchaseId} onBack={back} />;
  } else if (route?.name === 'saleChat') {
    content = <ConnectedChatScreen key={`${route.eventId}:${route.purchaseId}`} purchaseId={route.purchaseId} eventId={route.eventId} role="organizador" onBack={back} />;
  } else if (route?.name === 'purchasesDemo') {
    content = <View style={{ flex: 1 }}><ScreenHeader title="Compras de ejemplo" onBack={back} />
      <PurchasesScreen purchases={purchases} events={events} onOpenPurchase={(id) => open('purchase', { id, role: 'comprador' })} onExplore={explore} />
    </View>;
  } else if (route?.name === 'publishedEvent') {
    content = <EventSalesScreen key={route.eventId} eventId={route.eventId} onBack={() => { setStack([]); setTab('organize'); }}
      published={route.published} onViewPublic={() => open('catalogEvent', { eventId: route.eventId })}
      onOpenChat={(purchaseId) => open('saleChat', { eventId: route.eventId, purchaseId })} />;
  } else if (route?.name === 'organizerDemo') {
    content = <View style={{ flex: 1 }}><ScreenHeader title="Ventas de ejemplo" onBack={back} />
      <OrganizerScreen events={events} sales={sales} onCreate={() => open('create')} onOpenEvent={(eventId) => open('organizerEvent', { eventId })} /></View>;
  } else if (route?.name === 'catalogEvent') {
    content = <CatalogEventScreen key={route.eventId} eventId={route.eventId} onBack={back} onPurchased={purchaseRegistered} />;
  } else if (route?.name === 'event') {
    const event = events.find((item) => item.id === route.eventId);
    content = <EventDetailScreen key={event.id} event={event} organizer={organizers.find((item) => item.id === event.organizadorId)} favorite={favoriteIds.includes(event.id)} onFavorite={() => toggleFavorite(event.id)} onBack={back} onPurchase={simulatePurchase} onManage={canManageEvent(session, event) ? () => open('organizerEvent', { eventId: event.id }) : undefined} />;
  } else if (route?.name === 'purchase' || route?.name === 'chat') {
    const role = route.role;
    const purchase = allPurchases.find((item) => item.id === route.id);
    const event = events.find((item) => item.id === purchase.eventoId);
    content = route.name === 'chat'
      ? <ChatScreen key={`${purchase.id}-${role}`} event={event} purchase={purchase} organizer={organizers.find((item) => item.id === event.organizadorId)} messages={messages[purchase.id] ?? []} role={role} onBack={back} onSend={sendMessage} />
      : <PurchaseDetailScreen key={`${purchase.id}-${role}`} purchase={purchase} event={event} organizer={role === 'organizador'} onBack={back} onChat={() => open('chat', { id: purchase.id, role })} onEvent={() => open('event', { eventId: event.id })} onReview={saveReview} />;
  } else if (route?.name === 'organizerEvent') {
    const event = events.find((item) => item.id === route.eventId);
    content = <OrganizerEventScreen event={event} sales={sales.filter((sale) => sale.eventoId === event.id)} onBack={back} onEdit={() => open('edit', { eventId: event.id })} onOpenPurchase={(id) => open('purchase', { id, role: 'organizador' })} onPreview={() => open('event', { eventId: event.id })} />;
  } else if (route?.name === 'create') {
    content = <ConnectedCreateEventScreen onBack={back} onPublished={eventPublished} />;
  } else if (route?.name === 'edit') {
    const event = events.find((item) => item.id === route.eventId);
    content = <CreateEventScreen event={event} onBack={back} onCreate={(changes) => editEvent(event.id, changes)} />;
  } else if (tab === 'explore') {
    content = <ConnectedCatalogScreen filters={catalogFiltersByUser[userId] ?? initialFilters}
      onFilters={(value) => setCatalogFiltersByUser((current) => ({ ...current, [userId]: value }))}
      onOpenEvent={(eventId) => open('catalogEvent', { eventId })} />;
  } else if (tab === 'favorites') {
    content = <CatalogScreen events={events} organizers={organizers} favoriteIds={favoriteIds}
      onToggleFavorite={toggleFavorite} onOpenEvent={(eventId) => open('event', { eventId })}
      filters={favoriteFiltersByUser[userId] ?? initialFilters}
      onFilters={(value) => setFavoriteFiltersByUser((current) => ({ ...current, [userId]: value }))}
      saved onExplore={explore} />;
  } else if (tab === 'purchases') {
    content = <ConnectedPurchasesScreen onOpenPurchase={(purchaseId) => open('purchaseReceipt', { purchaseId })}
      onExplore={explore} onViewDemo={() => open('purchasesDemo')} />;
  } else if (tab === 'organize' && canOrganize(session)) {
    content = <ConnectedOrganizerScreen onCreate={() => open('create')} onOpenEvent={(eventId) => open('publishedEvent', { eventId })}
      onViewDemo={() => open('organizerDemo')} />;
  } else {
    content = <EmptyState title="Esta sección no está disponible" action="Explorar eventos" onAction={explore} />;
  }

  return <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
    <SessionSwitcher onSwitch={changeProfile} />
    <View key={userId} style={{ flex: 1 }}>{content}</View>
    {!route ? <View style={styles.navigation}>{visibleTabs.map((item) => {
      const selected = tab === item.id;
      return <Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected }} onPress={() => setTab(item.id)} style={styles.tab}><View style={[styles.tabIcon, selected && { backgroundColor: colors.primaryLight }]}><Icon name={item.icon} color={selected ? colors.primary : colors.muted} size={23} /></View><Text style={{ fontSize: 10, fontWeight: selected ? '800' : '500', color: selected ? colors.primary : colors.muted }}>{item.label}</Text></Pressable>;
    })}</View> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  navigation: { flexDirection: 'row', backgroundColor: colors.surface, paddingTop: 9, paddingBottom: 8, borderTopWidth: 1, borderColor: colors.border },
  tab: { flex: 1, alignItems: 'center', gap: 4, minHeight: 54, justifyContent: 'center' },
  tabIcon: { width: 53, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
