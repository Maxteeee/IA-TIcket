import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Chip, IconButton, ScreenHeader } from '../components/MockUI';
import { categories } from '../data/mockData';
import { colors, ui } from '../theme';
import { dateLabel, money } from '../utils/mockPresentation';

function Field({ label, ...props }) {
  return <View style={{ gap: 8 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={ui.input} {...props} /></View>;
}

export default function CreateEventScreen({ event, onBack, onCreate }) {
  const [name, setName] = useState(event?.nombre ?? '');
  const [description, setDescription] = useState(event?.descripcion ?? '');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState(event?.categoria ?? 'Música');
  const [tickets, setTickets] = useState([{ id: 'draft-1', nombre: 'General', precio: '5000', cupo: '50' }]);
  const [error, setError] = useState('');
  const changeTicket = (id, key, value) => setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, [key]: value } : ticket));
  const submit = () => {
    if (event) {
      if (!name.trim() || !description.trim()) return setError('Completá el nombre y la descripción.');
      onCreate({ nombre: name.trim(), descripcion: description.trim(), categoria: category });
      return;
    }
    const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
    const start = parts ? new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]), 21) : null;
    if (!name.trim() || !description.trim()) return setError('Completá el nombre y la descripción.');
    if (!start || start.getFullYear() !== Number(parts[3]) || start.getMonth() !== Number(parts[2]) - 1 || start.getDate() !== Number(parts[1]) || start <= new Date()) return setError('Usá una fecha futura válida con formato DD/MM/AAAA.');
    if (tickets.some((ticket) => !ticket.nombre.trim() || !ticket.precio.trim() || !ticket.cupo.trim())) return setError('Completá cada tipo de entrada.');
    const prepared = tickets.map((ticket) => ({ ...ticket, nombre: ticket.nombre.trim(), precio: Number(ticket.precio.replace(',', '.')), cupo: Number(ticket.cupo), descripcion: 'Acceso al evento de ejemplo.' }));
    if (prepared.some((ticket) => !Number.isFinite(ticket.precio) || ticket.precio < 0 || !Number.isInteger(ticket.cupo) || ticket.cupo < 1)) return setError('Usá precios válidos y cupos enteros mayores a cero.');
    onCreate({ nombre: name.trim(), descripcion: description.trim(), fecha: start.toISOString(), categoria: category, tiposEntrada: prepared });
  };

  return <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScreenHeader title={event ? 'Editar tu evento' : 'El próximo gran plan'} subtitle={event ? event.nombre : 'Nuevo evento de ejemplo'} onBack={onBack} /><ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={{ gap: 8 }}><Text style={ui.eyebrow}>{event ? 'LOS DETALLES HACEN AL PLAN' : 'DALE FORMA A TU IDEA'}</Text><Text style={ui.title}>{event ? 'Tu evento, a tu manera.' : 'Todo empieza\ncon un encuentro.'}</Text><Text style={ui.text}>{event ? 'Actualizá el nombre, la descripción y la categoría.' : 'Probá cómo se verá tu evento en la agenda.'}</Text></View>
    <Field label="Nombre del evento" placeholder="Ese plan que todos van a recordar" value={name} onChangeText={setName} maxLength={100} />
    <Field label="Contanos de qué se trata" placeholder="¿Qué hace especial a este evento?" value={description} onChangeText={setDescription} multiline maxLength={1500} />
    {!event ? <Field label="Fecha · DD/MM/AAAA" placeholder="20/12/2026" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" maxLength={10} /> : null}
    <View style={{ gap: 12 }}><Text style={ui.label}>Categoría</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{categories.slice(1).map((item) => <Chip key={item} label={item} selected={category === item} onPress={() => setCategory(item)} />)}</View></View>
    {!event ? <View style={{ gap: 13 }}><Text style={ui.heading}>Una entrada para cada plan</Text>{tickets.map((ticket, index) => <View key={ticket.id} style={ui.card}><View style={ui.between}><Text style={ui.eyebrow}>TIPO {index + 1}</Text>{tickets.length > 1 ? <IconButton name="close" label={`Quitar tipo ${index + 1}`} onPress={() => setTickets((current) => current.filter((item) => item.id !== ticket.id))} /> : null}</View><Field label={`Nombre del tipo ${index + 1}`} placeholder="General, Platea, VIP…" value={ticket.nombre} onChangeText={(value) => changeTicket(ticket.id, 'nombre', value)} /><View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Field label="Precio ($)" value={ticket.precio} onChangeText={(value) => changeTicket(ticket.id, 'precio', value)} keyboardType="decimal-pad" /></View><View style={{ flex: 1 }}><Field label="Cupo" value={ticket.cupo} onChangeText={(value) => changeTicket(ticket.id, 'cupo', value)} keyboardType="number-pad" /></View></View></View>)}<Button title="Agregar tipo de entrada" secondary icon="plus" onPress={() => setTickets((current) => [...current, { id: `draft-${Date.now()}`, nombre: '', precio: '', cupo: '' }])} /></View> : <View style={ui.card}><Text style={ui.heading}>Fecha y entradas</Text><Text style={ui.text}>{dateLabel(event.fecha)}</Text>{event.tiposEntrada.map((ticket) => <Text key={ticket.id} style={ui.caption}>{ticket.nombre} · {money(ticket.precio)} · {ticket.cupo} disponibles</Text>)}<Text style={ui.caption}>La edición de fecha y entradas estará disponible en una próxima etapa.</Text></View>}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
    <Button title={event ? 'Guardar cambios de ejemplo' : 'Publicar evento de ejemplo'} icon="arrow" onPress={submit} /><Text style={[ui.caption, { textAlign: 'center' }]}>{event ? 'Los cambios se comparten entre los perfiles de esta demostración.' : 'Se agrega a esta demostración. El contenido se reinicia al recargar la app.'}</Text>
  </ScrollView></KeyboardAvoidingView>;
}
