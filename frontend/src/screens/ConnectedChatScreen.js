import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, EmptyState, ScreenHeader } from '../components/MockUI';
import { useMockSession } from '../session/MockSessionProvider';
import { chatService } from '../services/chat.service';
import { colors, ui } from '../theme';

export default function ConnectedChatScreen({ purchaseId, onBack, role = 'comprador', eventId }) {
  const { session } = useMockSession();
  const organizer = role === 'organizador';
  const initialPending = chatService.getPending(session, purchaseId, { role });
  const [text, setText] = useState(initialPending ?? '');
  const [pending, setPending] = useState(initialPending);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(initialPending ? 'Tenés un envío sin respuesta. Reintentá el mismo mensaje para conocer su estado.' : '');
  const [revision, setRevision] = useState(0);
  const mounted = useRef(true);
  const locked = useRef(false);
  const reading = useRef(true);
  const sendRequest = useRef(null);
  const list = useRef(null);

  const reload = () => {
    if (locked.current) return;
    reading.current = true;
    setRevision((value) => value + 1);
  };
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') reload(); });
    return () => { mounted.current = false; sendRequest.current?.abort(); subscription.remove(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    reading.current = true;
    setLoading(true);
    setError('');
    setData(null);
    chatService.getConversation(purchaseId, session, { signal: controller.signal, role, eventId })
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) { reading.current = false; setLoading(false); } });
    return () => controller.abort();
  }, [purchaseId, session.usuario.id, revision, role, eventId]);

  const send = async () => {
    if (locked.current || reading.current || !data || error || !(pending ?? text).trim()) return;
    locked.current = true;
    setSending(true);
    setSendError('');
    const controller = new AbortController();
    sendRequest.current = controller;
    try {
      const sent = await chatService.send(purchaseId, pending ?? text, session, { signal: controller.signal, role, eventId });
      if (!mounted.current || controller.signal.aborted) return;
      // Un reintento puede recuperar un mensaje ya presente en el historial consultado.
      setData((current) => current.messages.some((message) => message.id === sent.id) ? current : { ...current, messages: [...current.messages, sent] });
      setText('');
      setPending(null);
    } catch (cause) {
      if (!mounted.current) return;
      const unresolved = chatService.getPending(session, purchaseId, { role });
      setPending(unresolved);
      if (unresolved) {
        setText(unresolved);
        setSendError('No pudimos confirmar el envío. Reintentá este mismo mensaje para conocer su estado.');
      } else {
        setSendError(cause.message || 'No se pudo enviar el mensaje.');
        if ([401, 403, 404].includes(cause.status)) setError(cause.message);
      }
    } finally {
      locked.current = false;
      if (mounted.current) setSending(false);
    }
  };

  return <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScreenHeader title={organizer ? 'Chat de la venta' : 'Chat de la compra'} subtitle={purchaseId} onBack={onBack} />
    <View style={[ui.content, { paddingVertical: 12, gap: 8 }]}>
      {data && !error ? <Text numberOfLines={2} style={ui.label}>{data.purchase.evento.nombre}</Text> : null}
      <Text style={ui.caption}>{organizer ? 'Podés responder al comprador en cualquier momento, incluso después del evento.' : 'Podés escribir al organizador en cualquier momento, incluso después del evento.'}</Text>
      <Button title="Actualizar conversación" secondary disabled={loading || sending} onPress={reload} />
    </View>
    <FlatList ref={list} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 15 }}
      data={loading || error ? [] : data?.messages ?? []} keyExtractor={(message) => message.id}
      refreshing={loading} onRefresh={reload} keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
      renderItem={({ item }) => {
        const mine = item.usuarioId === session.usuario.id;
        return <View style={[styles.bubble, mine && styles.myBubble]}>
          <Text style={{ color: mine ? '#DCC9FA' : colors.primary, fontSize: 11, fontWeight: '700' }}>{mine ? 'Vos' : organizer ? 'Comprador' : 'Organizador'}</Text>
          <Text selectable style={{ color: mine ? '#fff' : colors.ink, fontSize: 14, lineHeight: 22 }}>{item.mensaje}</Text>
          <Text style={{ color: mine ? '#DCC9FA' : colors.muted, fontSize: 10, alignSelf: 'flex-end' }}>{new Date(item.enviado).toLocaleString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}{mine ? ' · Enviado' : ''}</Text>
        </View>;
      }}
      ListEmptyComponent={loading ? <View accessibilityRole="progressbar" style={{ alignItems: 'center', gap: 12 }}><ActivityIndicator color={colors.primary} /><Text style={ui.text}>Cargando conversación…</Text></View>
        : error ? <EmptyState title="No pudimos cargar la conversación" description={error} action="Volver a intentar" onAction={reload} />
          : <EmptyState icon="chat" title="La conversación empieza acá" description={organizer ? 'Escribí al comprador sobre esta compra.' : 'Escribí tu primera consulta sobre esta compra.'} />} />
    <View style={styles.composer}>
      {sendError ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{sendError}</Text> : null}
      <TextInput accessibilityLabel={organizer ? 'Escribir respuesta' : 'Escribir mensaje'} placeholder={organizer ? 'Escribí tu respuesta…' : 'Escribí tu consulta…'} placeholderTextColor={colors.muted}
        value={text} onChangeText={setText} multiline maxLength={2000} editable={!loading && !error && !sending && !pending}
        style={[ui.input, { maxHeight: 110, textAlignVertical: 'top' }]} />
      <View style={ui.between}><Text style={ui.caption}>{text.length}/2000</Text>
        <Button title={sending ? 'Enviando…' : pending ? 'Reintentar envío' : organizer ? 'Responder mensaje' : 'Enviar mensaje'} icon="send" onPress={send}
          disabled={loading || Boolean(error) || sending || !(pending ?? text).trim()} />
      </View>
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '88%', padding: 15, gap: 5, borderRadius: 18, borderBottomLeftRadius: 5, backgroundColor: '#fff', alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border },
  myBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderColor: colors.primary, borderBottomLeftRadius: 18, borderBottomRightRadius: 5 },
  composer: { padding: 15, gap: 10, borderTopWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
});
