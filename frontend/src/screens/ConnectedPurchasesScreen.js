import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, ScrollView, Text, View } from 'react-native';
import { Button, Chip, EmptyState } from '../components/MockUI';
import { useMockSession } from '../session/MockSessionProvider';
import { purchasesService } from '../services/purchases.service';
import { statusLabels } from '../utils/mockPresentation';
import { colors, ui } from '../theme';
import { PurchaseCard } from './PurchasesScreen';

export default function ConnectedPurchasesScreen({ onOpenPurchase, onExplore, onViewDemo }) {
  const { session } = useMockSession();
  const [purchases, setPurchases] = useState([]);
  const [filter, setFilter] = useState('Todas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision((value) => value + 1);

  useEffect(() => {
    const controller = new AbortController();
    setPurchases([]);
    setLoading(true);
    setError('');
    purchasesService.listOwn(session, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setPurchases(result); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session.usuario.id, revision]);

  useEffect(() => {
    // Al volver a la app, se consultan de nuevo estados y días con el reloj del servidor.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRevision((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);

  const visible = purchases.filter((purchase) => filter === 'Todas' || purchase.estado === filter);
  return <FlatList style={ui.screen} contentContainerStyle={ui.content}
    data={loading || error ? [] : visible} keyExtractor={(purchase) => purchase.id}
    refreshing={loading} onRefresh={reload}
    ListHeaderComponent={<View style={{ gap: 20, paddingBottom: 22 }}>
      <View style={{ gap: 8 }}><Text style={ui.eyebrow}>TUS ENTRADAS</Text><Text style={ui.title}>Mis compras.</Text><Text style={ui.text}>Consultá el estado de tus compras y los días restantes de tus eventos confirmados.</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label="Todas" selected={filter === 'Todas'} onPress={() => setFilter('Todas')} />
        {Object.entries(statusLabels).map(([state, label]) => <Chip key={state} label={label} selected={filter === state} onPress={() => setFilter(state)} />)}
      </ScrollView>
      {!loading && !error ? <Text style={ui.caption}>{visible.length} {visible.length === 1 ? 'compra' : 'compras'}{filter === 'Todas' ? '' : ` · ${statusLabels[filter]}`}</Text> : null}
    </View>}
    renderItem={({ item }) => <PurchaseCard connected purchase={item} event={item.evento} onPress={() => onOpenPurchase(item.id)} />}
    ListEmptyComponent={loading ? <View accessibilityRole="progressbar" style={{ alignItems: 'center', gap: 12 }}><ActivityIndicator color={colors.primary} /><Text style={ui.text}>Cargando tus compras…</Text></View>
      : error ? <EmptyState title="No pudimos cargar tus compras" description={error} action="Volver a intentar" onAction={reload} />
        : purchases.length ? <EmptyState icon="ticket" title="No tenés compras en este estado" description="Podés consultar los otros estados o ver todas tus compras." action="Ver todas" onAction={() => setFilter('Todas')} />
          : <EmptyState icon="ticket" title="Todavía no tenés compras" description="Buscá un evento y elegí tus entradas para empezar." action="Explorar eventos" onAction={onExplore} />}
    ListFooterComponent={<View style={{ paddingTop: 24 }}><Button title="Recorrer compras de ejemplo" secondary onPress={onViewDemo} /></View>} />;
}
