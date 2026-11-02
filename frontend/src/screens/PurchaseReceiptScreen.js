import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Button, EmptyState, ScreenHeader, StatusBadge } from '../components/MockUI';
import { useMockSession } from '../session/MockSessionProvider';
import { purchasesService } from '../services/purchases.service';
import PurchaseCountdown from '../components/PurchaseCountdown';
import { colors, ui } from '../theme';
import { dateLabel, money } from '../utils/mockPresentation';

export default function PurchaseReceiptScreen({ purchaseId, onBack, onEvent, onExplore, onPurchases, onChat, onReview }) {
  const { session } = useMockSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const locked = useRef(false);
  const reading = useRef(true);
  const cancellation = useRef(null);
  const mounted = useRef(true);
  const reload = () => {
    if (locked.current) return;
    reading.current = true;
    setConfirming(false);
    setRevision((value) => value + 1);
  };
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });
    return () => { mounted.current = false; cancellation.current?.abort(); subscription.remove(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    reading.current = true;
    setLoading(true);
    setError('');
    setData(null);
    (async () => {
      const purchase = await purchasesService.get(purchaseId, session, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setData({ purchase, event: purchase.evento });
        if (['CANCELADA', 'REEMBOLSADA'].includes(purchase.estado)) { setUncertain(false); setCancelError(''); setConfirming(false); }
      }
    })().catch((cause) => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) { reading.current = false; setLoading(false); } });
    return () => controller.abort();
  }, [purchaseId, session.usuario.id, revision]);

  const cancel = async () => {
    if (locked.current || reading.current || !data || (!data.purchase.puedeCancelar && !uncertain)) return;
    locked.current = true;
    setBusy(true);
    setCancelError('');
    const controller = new AbortController();
    cancellation.current = controller;
    try {
      const purchase = await purchasesService.cancel(purchaseId, session, { signal: controller.signal });
      if (!mounted.current || controller.signal.aborted) return;
      setData({ purchase, event: purchase.evento });
      setUncertain(false);
      setConfirming(false);
    } catch (cause) {
      if (!mounted.current || controller.signal.aborted) return;
      const definitive = cause.status >= 400 && cause.status < 500 && cause.code !== 'INVALID_RESPONSE';
      setUncertain(!definitive);
      setCancelError(definitive ? cause.message : 'No pudimos confirmar el resultado. Reintentá la cancelación o actualizá la compra para consultar su estado.');
      if (definitive) {
        setConfirming(false);
        reading.current = true;
        setRevision((value) => value + 1);
      }
    } finally {
      locked.current = false;
      if (mounted.current && !controller.signal.aborted) setBusy(false);
    }
  };

  return <View style={ui.screen}><ScreenHeader title="Comprobante de compra" onBack={onBack} />
    {loading ? <View accessibilityRole="progressbar" style={[ui.content, { alignItems: 'center' }]}><ActivityIndicator color={colors.primary} /><Text style={ui.text}>Consultando tu compra…</Text></View>
      : error ? <EmptyState title="No pudimos cargar tu compra" description={error} action="Volver a intentar" onAction={reload} />
        : <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={loading} enabled={!busy} onRefresh={reload} />}>
          <View style={[ui.card, { backgroundColor: colors.successLight }]}><Text style={[ui.heading, { color: colors.success }]}>✓ Compra registrada</Text><Text style={ui.text}>Este es el comprobante de tu compra en {data.event.nombre}. Los importes a pagar y reembolsar son simulados; no se mueve dinero real.</Text></View>
          <View style={ui.card}><StatusBadge status={data.purchase.estado} /><Text style={ui.caption}>NÚMERO DE COMPRA</Text><Text selectable style={ui.caption}>{data.purchase.id}</Text>
            <Text style={ui.heading}>{data.event.nombre}</Text><Text style={ui.text}>{dateLabel(data.event.fecha, { year: 'numeric' })}</Text>
            <View style={ui.divider} /><Text style={ui.label}>{data.purchase.tipoEntradaNombre}</Text>
            <Text style={ui.text}>{data.purchase.cantidad} {data.purchase.cantidad === 1 ? 'entrada' : 'entradas'} · {money(data.purchase.precioUnitario)} cada una</Text>
            <View style={ui.between}><Text style={ui.label}>Total simulado</Text><Text style={[ui.heading, { color: colors.primary }]}>{money(data.purchase.total)}</Text></View>
          </View>
          <PurchaseCountdown purchase={data.purchase} />
          {data.purchase.estado === 'PENDIENTE' ? <View style={[ui.card, { backgroundColor: colors.warningLight }]}><Text style={[ui.label, { color: colors.warning }]}>Pendiente de pago simulado</Text><Text style={ui.text}>Se reservaron tus entradas. Importe pendiente simulado: {money(data.purchase.total)}. Si cancelás, se liberarán sin un reembolso.</Text></View> : null}
          {data.purchase.estado === 'CONFIRMADA' ? <View style={ui.card}><Text style={ui.label}>Importe confirmado simulado: {money(data.purchase.total)}</Text></View> : null}
          {data.purchase.reembolso ? <View accessibilityRole="alert" style={[ui.card, { backgroundColor: colors.successLight }]}><Text style={ui.heading}>Reembolso simulado registrado</Text><Text style={ui.text}>Importe reembolsado: {money(data.purchase.reembolso.importe)}.</Text><Text style={ui.caption}>{dateLabel(data.purchase.reembolso.fecha, { year: 'numeric' })} · No se movió dinero real.</Text></View> : null}
          {data.purchase.estado === 'CANCELADA' ? <View accessibilityRole="alert" style={ui.card}><Text style={ui.heading}>Compra cancelada</Text><Text style={ui.text}>Las entradas de esta compra ya no están activas y volvieron al cupo disponible.</Text></View> : null}
          {cancelError ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{cancelError}</Text> : null}
          {data.purchase.puedeCancelar || uncertain ? <View style={ui.card}>
            <Text style={ui.heading}>Cancelar mi compra</Text>
            {confirming || uncertain ? <>
              <Text style={ui.text}>Las entradas volverán al cupo disponible. {data.purchase.estado === 'CONFIRMADA' ? `Reembolso simulado previsto: ${money(data.purchase.total)}, el total original.` : 'La compra está pendiente: no corresponde devolver un importe.'}</Text>
              <Text style={ui.text}>{uncertain ? 'Podés reintentar para recuperar el resultado sin cancelar dos veces.' : '¿Querés cancelar esta compra? Las entradas dejarán de estar activas.'}</Text>
              <Button title={busy ? 'Cancelando…' : uncertain ? 'Reintentar cancelación' : 'Confirmar cancelación'} disabled={busy} onPress={cancel} />
              {!uncertain ? <Button title="Conservar compra" secondary disabled={busy} onPress={() => setConfirming(false)} /> : null}
            </> : <Button title="Cancelar compra" secondary onPress={() => setConfirming(true)} />}
          </View> : null}
          {!data.purchase.puedeCancelar && ['PENDIENTE', 'CONFIRMADA', 'UTILIZADA'].includes(data.purchase.estado) && !uncertain ? <View style={ui.card}><Text style={ui.label}>Esta compra no admite cancelación</Text><Text style={ui.text}>Solo se puede cancelar antes del inicio del evento y si las entradas no fueron utilizadas.</Text></View> : null}
          <Button title="Actualizar compra" secondary disabled={busy} onPress={reload} />
          {onChat ? <View style={ui.card}><Text style={ui.heading}>Conversá con el organizador</Text><Text style={ui.text}>Consultá lo que necesites sobre esta compra, antes o después del evento.</Text><Button title="Abrir conversación" icon="chat" onPress={onChat} /></View> : null}
          {onReview && data.purchase.estado === 'UTILIZADA' ? <View style={ui.card}><Text style={ui.heading}>Tu experiencia cuenta</Text>
            <Text style={ui.text}>{data.purchase.puedeReseniar ? 'Compartí tu puntuación y un comentario sobre este evento.' : 'Podrás puntuar y comentar cuando el evento haya finalizado.'}</Text>
            <Button title="Reseña de mi compra" icon="star" disabled={!data.purchase.puedeReseniar} onPress={onReview} />
          </View> : null}
          <Button title="Volver al evento" secondary onPress={() => onEvent(data.event.id)} />
          {onPurchases ? <Button title="Ver mis compras" secondary onPress={onPurchases} /> : null}
          <Button title="Seguir explorando" onPress={onExplore} />
        </ScrollView>}
  </View>;
}
