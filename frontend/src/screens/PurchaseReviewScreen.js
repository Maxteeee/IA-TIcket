import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, EmptyState, ScreenHeader } from '../components/MockUI';
import { useMockSession } from '../session/MockSessionProvider';
import { reviewsService } from '../services/reviews.service';
import { colors, ui } from '../theme';

export default function PurchaseReviewScreen({ purchaseId, onBack }) {
  const { session } = useMockSession();
  const initialPending = reviewsService.getPending(purchaseId, session);
  const [score, setScore] = useState(initialPending ? String(initialPending.puntuacion) : '');
  const [comment, setComment] = useState(initialPending?.detalle ?? '');
  const [pending, setPending] = useState(initialPending);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState(initialPending ? 'Tenés una publicación sin respuesta. Reintentá la misma reseña para conocer el resultado.' : '');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [revision, setRevision] = useState(0);
  const mounted = useRef(true);
  const locked = useRef(false);
  const reading = useRef(true);
  const request = useRef(null);
  const reload = () => {
    if (locked.current) return;
    reading.current = true;
    setRevision((value) => value + 1);
  };

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') reload(); });
    return () => { mounted.current = false; request.current?.abort(); subscription.remove(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    reading.current = true;
    setLoading(true);
    setLoadError('');
    setData(null);
    reviewsService.load(purchaseId, session, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((cause) => { if (!controller.signal.aborted) setLoadError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) { reading.current = false; setLoading(false); } });
    return () => controller.abort();
  }, [purchaseId, session.usuario.id, revision]);

  const publish = async () => {
    if (locked.current || reading.current || !data || (!data.purchase.puedeReseniar && !pending)) return;
    locked.current = true;
    setBusy(true);
    setSuccess(false);
    setSendError('');
    const controller = new AbortController();
    request.current = controller;
    try {
      const review = await reviewsService.create(purchaseId, pending ?? { puntuacion: score, detalle: comment }, session, { signal: controller.signal });
      if (!mounted.current || controller.signal.aborted) return;
      setData((current) => current.reviews.some((item) => item.id === review.id) ? current : { ...current, reviews: [...current.reviews, review] });
      setPending(null);
      setScore('');
      setComment('');
      setSuccess(true);
    } catch (cause) {
      if (!mounted.current) return;
      const unresolved = reviewsService.getPending(purchaseId, session);
      setPending(unresolved);
      if (unresolved) {
        setScore(String(unresolved.puntuacion));
        setComment(unresolved.detalle);
        setSendError('No pudimos confirmar la publicación. Reintentá esta misma reseña para conocer su estado.');
      } else {
        setSendError(cause.message || 'No se pudo publicar la reseña.');
        if ([401, 403, 404].includes(cause.status)) setLoadError(cause.message);
        if (cause.status === 409) {
          reading.current = true;
          setRevision((value) => value + 1);
        }
      }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const frozen = busy || Boolean(pending);
  return <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScreenHeader title="Reseña de mi compra" subtitle={purchaseId} onBack={onBack} />
    {loading ? <View accessibilityRole="progressbar" style={[ui.content, { alignItems: 'center' }]}><ActivityIndicator color={colors.primary} /><Text style={ui.text}>Consultando tu compra y reseñas…</Text></View>
      : loadError ? <EmptyState title="No pudimos cargar la reseña" description={loadError} action="Volver a intentar" onAction={reload} />
        : <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
          <Text style={ui.heading}>{data.purchase.evento.nombre}</Text>
          {success ? <View accessibilityRole="alert" style={[ui.card, { backgroundColor: colors.successLight }]}><Text style={[ui.label, { color: colors.success }]}>✓ Tu reseña fue publicada</Text><Text style={ui.text}>Se guardaron tu puntuación y comentario.</Text></View> : null}
          {sendError ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{sendError}</Text> : null}
          {data.purchase.puedeReseniar || pending ? <View style={ui.card}>
            <Text style={ui.heading}>¿Cómo fue tu experiencia?</Text>
            <Text style={ui.text}>Tu compra fue utilizada. Compartí tu puntuación y un comentario.</Text>
            <Text style={ui.label}>Puntuación · 0 a 5</Text>
            <TextInput accessibilityLabel="Puntuación de 0 a 5" value={score} onChangeText={setScore} editable={!frozen} keyboardType="decimal-pad" placeholder="Por ejemplo, 4,5" placeholderTextColor={colors.muted} style={ui.input} />
            <Text style={ui.label}>Comentario</Text>
            <TextInput accessibilityLabel="Comentario de la reseña" value={comment} onChangeText={setComment} editable={!frozen} multiline maxLength={1500} placeholder="Contá cómo viviste el evento…" placeholderTextColor={colors.muted} style={[ui.input, { minHeight: 110, textAlignVertical: 'top' }]} />
            <Text style={ui.caption}>{comment.length}/1500</Text>
            <Button title={busy ? 'Publicando…' : pending ? 'Reintentar publicación' : 'Publicar reseña'} icon="star" disabled={busy || !score.trim() || !comment.trim()} onPress={publish} />
          </View> : <View style={ui.card}><Text style={ui.label}>La reseña todavía no está habilitada</Text><Text style={ui.text}>Necesitás que tu compra esté utilizada para puntuar y comentar.</Text><Button title="Actualizar" secondary onPress={reload} /></View>}
          {data.reviews.length ? <View style={{ gap: 12 }}><Text style={ui.heading}>Tus reseñas de esta compra</Text>{data.reviews.map((review) => <View key={review.id} style={ui.card}>
            <Text style={[ui.label, { color: colors.primary }]}>Puntuación: {String(review.puntuacion).replace('.', ',')} / 5</Text><Text style={ui.text}>{review.detalle}</Text>
          </View>)}</View> : null}
          <Button title="Volver a mi compra" secondary onPress={onBack} />
        </ScrollView>}
  </KeyboardAvoidingView>;
}
