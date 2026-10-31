import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Chip, IconButton, ScreenHeader } from '../components/MockUI';
import { categories as mockCategories } from '../data/mockData';
import { colors, ui } from '../theme';
import { dateLabel, money } from '../utils/mockPresentation';
import { createPublicationKey, prepareEventDraft } from '../utils/eventDraft';

function Field({ label, ...props }) {
  return <View style={{ gap: 8 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={ui.input} {...props} /></View>;
}

export default function CreateEventScreen({ event, onBack, onCreate, availableCategories = [] }) {
  const categories = event ? mockCategories.slice(1).map((nombre) => ({ id: nombre, nombre })) : availableCategories;
  const [name, setName] = useState(event?.nombre ?? '');
  const [description, setDescription] = useState(event?.descripcion ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('21:00');
  const [category, setCategory] = useState(event?.categoria ?? categories[0]?.id ?? '');
  const [tickets, setTickets] = useState([{ id: 'draft-1', nombre: 'General', descripcion: '', precio: '5000', cupo: '50' }]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const ticketCounter = useRef(1);
  const attempt = useRef(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const changeTicket = (id, key, value) => setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, [key]: value } : ticket));

  const submit = async () => {
    if (locked.current) return;
    setError('');
    try {
      let payload;
      if (event) {
        if (!name.trim() || !description.trim()) throw new Error('Completá el nombre y la descripción.');
        payload = { nombre: name.trim(), descripcion: description.trim(), categoria: category };
      } else {
        payload = prepareEventDraft({ name, description, date, time, categoryId: category, tickets });
      }
      const fingerprint = JSON.stringify(payload);
      if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: createPublicationKey() };
      locked.current = true;
      setBusy(true);
      await onCreate(payload, { idempotencyKey: attempt.current.key });
    } catch (cause) {
      if (mounted.current && cause.name !== 'AbortError') setError(cause.message || 'No se pudo publicar el evento. Volvé a intentar.');
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScreenHeader title={event ? 'Editar tu evento' : 'El próximo gran plan'} subtitle={event ? event.nombre : 'Nuevo evento'} onBack={onBack} />
    <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={{ gap: 8 }}>
        <Text style={ui.eyebrow}>{event ? 'LOS DETALLES HACEN AL PLAN' : 'DALE FORMA A TU IDEA'}</Text>
        <Text style={ui.title}>{event ? 'Tu evento, a tu manera.' : 'Todo empieza\ncon un encuentro.'}</Text>
        <Text style={ui.text}>{event ? 'Actualizá el nombre, la descripción y la categoría.' : 'Publicá tu propuesta con una entrada para cada público.'}</Text>
      </View>
      <Field label="Nombre del evento" placeholder="Ese plan que todos van a recordar" value={name} onChangeText={setName} maxLength={100} editable={!busy} />
      <Field label="Contanos de qué se trata" placeholder="¿Qué hace especial a este evento?" value={description} onChangeText={setDescription} multiline maxLength={1500} editable={!busy} />
      {!event ? <View style={{ gap: 16 }}>
        <Field label="Fecha · DD/MM/AAAA" placeholder="DD/MM/AAAA" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" maxLength={10} editable={!busy} />
        <Field label="Hora local · HH:mm" placeholder="21:00" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" maxLength={5} editable={!busy} />
      </View> : null}
      <View style={{ gap: 12 }}><Text style={ui.label}>Categoría</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{categories.map((item) =>
          <Chip key={item.id} label={item.nombre} selected={category === item.id} disabled={busy} onPress={() => setCategory(item.id)} />)}</View>
      </View>
      {!event ? <View style={{ gap: 13 }}><Text style={ui.heading}>Una entrada para cada plan</Text>
        {tickets.map((ticket, index) => <View key={ticket.id} style={ui.card}>
          <View style={ui.between}><Text style={ui.eyebrow}>TIPO {index + 1}</Text>{tickets.length > 1 ?
            <IconButton name="close" label={`Quitar tipo ${index + 1}`} disabled={busy} onPress={() => setTickets((current) => current.filter((item) => item.id !== ticket.id))} /> : null}</View>
          <Field label={`Nombre del tipo ${index + 1}`} placeholder="General, Platea, VIP…" value={ticket.nombre} onChangeText={(value) => changeTicket(ticket.id, 'nombre', value)} maxLength={100} editable={!busy} />
          <Field label={`Descripción del tipo ${index + 1} (opcional)`} placeholder="¿Qué incluye esta entrada?" value={ticket.descripcion} onChangeText={(value) => changeTicket(ticket.id, 'descripcion', value)} maxLength={1500} editable={!busy} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}><Field label={`Precio del tipo ${index + 1} ($)`} value={ticket.precio} onChangeText={(value) => changeTicket(ticket.id, 'precio', value)} keyboardType="decimal-pad" editable={!busy} /></View>
            <View style={{ flex: 1 }}><Field label={`Cupo del tipo ${index + 1}`} value={ticket.cupo} onChangeText={(value) => changeTicket(ticket.id, 'cupo', value)} keyboardType="number-pad" editable={!busy} /></View>
          </View>
        </View>)}
        <Button title="Agregar tipo de entrada" secondary icon="plus" disabled={busy} onPress={() => {
          const id = `draft-${++ticketCounter.current}`;
          setTickets((current) => [...current, { id, nombre: '', descripcion: '', precio: '', cupo: '' }]);
        }} />
        <Text style={ui.caption}>Precios de 0 o más, con hasta dos decimales. Cupos enteros de 0 o más.</Text>
      </View> : <View style={ui.card}><Text style={ui.heading}>Fecha y entradas</Text><Text style={ui.text}>{dateLabel(event.fecha)}</Text>{event.tiposEntrada.map((ticket) => <Text key={ticket.id} style={ui.caption}>{ticket.nombre} · {money(ticket.precio)} · {ticket.cupo} disponibles</Text>)}<Text style={ui.caption}>La edición de fecha y entradas estará disponible en una próxima etapa.</Text></View>}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
      <Button title={busy ? (event ? 'Guardando…' : 'Publicando…') : event ? 'Guardar cambios de ejemplo' : 'Publicar evento'} icon="arrow" disabled={busy} onPress={submit} />
      <Text style={[ui.caption, { textAlign: 'center' }]}>{event ? 'Los cambios se comparten entre los perfiles de esta demostración.' : 'Los compradores podrán encontrar tu evento en el catálogo.'}</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}
