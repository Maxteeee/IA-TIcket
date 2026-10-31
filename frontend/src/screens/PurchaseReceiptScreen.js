import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Button, EmptyState, ScreenHeader, StatusBadge } from '../components/MockUI';
import { useMockSession } from '../session/MockSessionProvider';
import { purchasesService } from '../services/purchases.service';
import PurchaseCountdown from '../components/PurchaseCountdown';
import { colors, ui } from '../theme';
import { dateLabel, money } from '../utils/mockPresentation';

export default function PurchaseReceiptScreen({ purchaseId, onBack, onEvent, onExplore, onPurchases, onChat }) {
  const { session } = useMockSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRevision((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    (async () => {
      const purchase = await purchasesService.get(purchaseId, session, { signal: controller.signal });
      if (!controller.signal.aborted) setData({ purchase, event: purchase.evento });
    })().catch((cause) => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [purchaseId, session.usuario.id, revision]);

  return <View style={ui.screen}><ScreenHeader title="Comprobante de compra" onBack={onBack} />
    {loading ? <View accessibilityRole="progressbar" style={[ui.content, { alignItems: 'center' }]}><ActivityIndicator color={colors.primary} /><Text style={ui.text}>Consultando tu compra…</Text></View>
      : error ? <EmptyState title="No pudimos cargar tu compra" description={error} action="Volver a intentar" onAction={() => setRevision((value) => value + 1)} />
        : <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setRevision((value) => value + 1)} />}>
          <View style={[ui.card, { backgroundColor: colors.successLight }]}><Text style={[ui.heading, { color: colors.success }]}>✓ Compra registrada</Text><Text style={ui.text}>Este es el comprobante de tu compra en {data.event.nombre}.</Text></View>
          <View style={ui.card}><StatusBadge status={data.purchase.estado} /><Text style={ui.caption}>NÚMERO DE COMPRA</Text><Text selectable style={ui.caption}>{data.purchase.id}</Text>
            <Text style={ui.heading}>{data.event.nombre}</Text><Text style={ui.text}>{dateLabel(data.event.fecha, { year: 'numeric' })}</Text>
            <View style={ui.divider} /><Text style={ui.label}>{data.purchase.tipoEntradaNombre}</Text>
            <Text style={ui.text}>{data.purchase.cantidad} {data.purchase.cantidad === 1 ? 'entrada' : 'entradas'} · {money(data.purchase.precioUnitario)} cada una</Text>
            <View style={ui.between}><Text style={ui.label}>Total registrado</Text><Text style={[ui.heading, { color: colors.primary }]}>{money(data.purchase.total)}</Text></View>
          </View>
          <PurchaseCountdown purchase={data.purchase} />
          {data.purchase.estado === 'PENDIENTE' ? <View style={[ui.card, { backgroundColor: colors.warningLight }]}><Text style={[ui.label, { color: colors.warning }]}>Pendiente de pago</Text><Text style={ui.text}>Se reservaron tus entradas. Todavía no se realizó ningún cobro.</Text></View> : null}
          {onChat ? <View style={ui.card}><Text style={ui.heading}>Conversá con el organizador</Text><Text style={ui.text}>Consultá lo que necesites sobre esta compra, antes o después del evento.</Text><Button title="Abrir conversación" icon="chat" onPress={onChat} /></View> : null}
          <Button title="Volver al evento" secondary onPress={() => onEvent(data.event.id)} />
          {onPurchases ? <Button title="Ver mis compras" secondary onPress={onPurchases} /> : null}
          <Button title="Seguir explorando" onPress={onExplore} />
        </ScrollView>}
  </View>;
}
