import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon, ScreenHeader } from '../components/MockUI';
import { colors, ui } from '../theme';

export default function ChatScreen({ event, purchase, organizer, messages, role = 'comprador', onBack, onSend }) {
  const [text, setText] = useState('');
  const scroll = useRef(null);
  useEffect(() => { scroll.current?.scrollToEnd({ animated: true }); }, [messages.length]);
  const send = () => {
    if (!text.trim()) return;
    onSend(purchase.id, text.trim(), role);
    setText('');
  };

  return <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScreenHeader title={role === 'organizador' ? purchase.comprador : organizer.nombre} subtitle={`${purchase.id} · ${event.nombre}`} onBack={onBack} />
    <View style={styles.context}><Icon name="ticket" color={colors.primary} size={19} /><Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: colors.primary }}>{event.nombre}</Text><Text style={styles.demo}>CHAT DEMO</Text></View>
    <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 22, gap: 15 }} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
      <Text style={[ui.caption, { textAlign: 'center', marginBottom: 8 }]}>Un espacio para resolver tus consultas</Text>
      {!messages.length ? <View style={[ui.card, { alignItems: 'center', marginTop: 35 }]}><Text style={ui.heading}>La conversación empieza acá</Text><Text style={[ui.text, { textAlign: 'center' }]}>Podés escribir en cualquier momento, incluso después del evento.</Text></View> : null}
      {messages.map((message) => {
        const mine = message.autor === role;
        return <View key={message.id} style={[styles.bubble, mine && styles.myBubble]}><Text style={{ fontSize: 14, lineHeight: 22, color: mine ? '#fff' : colors.ink }}>{message.texto}</Text><Text style={{ fontSize: 10, alignSelf: 'flex-end', marginTop: 6, color: mine ? '#DCC9FA' : colors.muted }}>{message.hora}{mine ? '  ✓' : ''}</Text></View>;
      })}
      <Text style={[ui.caption, { textAlign: 'center', marginTop: 15 }]}>Mensajes de prueba · No se envían a otras personas.</Text>
    </ScrollView>
    <View style={styles.composer}><TextInput accessibilityLabel="Escribir mensaje" placeholder="Escribí tu consulta…" placeholderTextColor={colors.muted} value={text} onChangeText={setText} multiline maxLength={1000} style={styles.input} /><Pressable accessibilityRole="button" accessibilityLabel="Enviar mensaje de ejemplo" accessibilityState={{ disabled: !text.trim() }} disabled={!text.trim()} onPress={send} style={[styles.send, !text.trim() && { opacity: 0.4 }]}><Icon name="send" color="#fff" size={26} /></Pressable></View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  context: { marginHorizontal: 20, backgroundColor: colors.primaryLight, borderRadius: 12, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  demo: { fontSize: 8, fontWeight: '800', letterSpacing: 0.7, color: colors.primary },
  bubble: { maxWidth: '85%', padding: 16, borderRadius: 19, borderBottomLeftRadius: 5, backgroundColor: '#fff', alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border },
  myBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderColor: colors.primary, borderBottomLeftRadius: 19, borderBottomRightRadius: 5 },
  composer: { padding: 15, gap: 12, flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  input: { flex: 1, backgroundColor: colors.background, borderRadius: 15, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: colors.ink, maxHeight: 120 },
  send: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
