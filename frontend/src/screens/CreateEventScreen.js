import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Chip, IconButton, ScreenHeader } from '../components/MockUI';
import { categories } from '../data/mockData';
import { colors, ui } from '../theme';

function Field({ label, ...props }) {
  return <View style={{ gap: 8 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={ui.input} {...props} /></View>;
}

export default function CreateEventScreen({ onBack, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('Música');
  const [tickets, setTickets] = useState([{ id: 'draft-1', nombre: 'General', precio: '5000', cupo: '50' }]);
  const [error, setError] = useState('');
  const changeTicket = (id, key, value) => setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, [key]: value } : ticket));
  const submit = () => {
    const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
    const start = parts ? new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]), 21) : null;
    if (!name.trim() || !description.trim()) return setError('Completá el nombre y la descripción.');
    if (!start || start.getFullYear() !== Number(parts[3]) || start.getMonth() !== Number(parts[2]) - 1 || start.getDate() !== Number(parts[1]) || start <= new Date()) return setError('Usá una fecha futura válida con formato DD/MM/AAAA.');
    if (tickets.some((ticket) => !ticket.nombre.trim() || !ticket.precio.trim() || !ticket.cupo.trim())) return setError('Completá cada tipo de entrada.');
    const prepared = tickets.map((ticket) => ({ ...ticket, nombre: ticket.nombre.trim(), precio: Number(ticket.precio.replace(',', '.')), cupo: Number(ticket.cupo), descripcion: 'Acceso al evento de ejemplo.' }));
    if (prepared.some((ticket) => !Number.isFinite(ticket.precio) || ticket.precio < 0 || !Number.isInteger(ticket.cupo) || ticket.cupo < 1)) return setError('Usá precios válidos y cupos enteros mayores a cero.');
    onCreate({ nombre: name.trim(), descripcion: description.trim(), fecha: start.toISOString(), categoria: category, tiposEntrada: prepared });
  };

  return <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScreenHeader title="El próximo gran plan" subtitle="Nuevo evento de ejemplo" onBack={onBack} /><ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={{ gap: 8 }}><Text style={ui.eyebrow}>DALE FORMA A TU IDEA</Text><Text style={ui.title}>{'Todo empieza\ncon un encuentro.'}</Text><Text style={ui.text}>Probá cómo se verá tu evento en la agenda.</Text></View>
    <Field label="Nombre del evento" placeholder="Ese plan que todos van a recordar" value={name} onChangeText={setName} maxLength={100} />
    <Field label="Contanos de qué se trata" placeholder="¿Qué hace especial a este evento?" value={description} onChangeText={setDescription} multiline maxLength={1500} />
    <Field label="Fecha · DD/MM/AAAA" placeholder="20/12/2026" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" maxLength={10} />
    <View style={{ gap: 12 }}><Text style={ui.label}>Categoría</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{categories.slice(1).map((item) => <Chip key={item} label={item} selected={category === item} onPress={() => setCategory(item)} />)}</View></View>
    <View style={{ gap: 13 }}><Text style={ui.heading}>Una entrada para cada plan</Text>{tickets.map((ticket, index) => <View key={ticket.id} style={ui.card}><View style={ui.between}><Text style={ui.eyebrow}>TIPO {index + 1}</Text>{tickets.length > 1 ? <IconButton name="close" label={`Quitar tipo ${index + 1}`} onPress={() => setTickets((current) => current.filter((item) => item.id !== ticket.id))} /> : null}</View><Field label={`Nombre del tipo ${index + 1}`} placeholder="General, Platea, VIP…" value={ticket.nombre} onChangeText={(value) => changeTicket(ticket.id, 'nombre', value)} /><View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Field label="Precio ($)" value={ticket.precio} onChangeText={(value) => changeTicket(ticket.id, 'precio', value)} keyboardType="decimal-pad" /></View><View style={{ flex: 1 }}><Field label="Cupo" value={ticket.cupo} onChangeText={(value) => changeTicket(ticket.id, 'cupo', value)} keyboardType="number-pad" /></View></View></View>)}<Button title="Agregar tipo de entrada" secondary icon="plus" onPress={() => setTickets((current) => [...current, { id: `draft-${Date.now()}`, nombre: '', precio: '', cupo: '' }])} /></View>
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
    <Button title="Publicar evento de ejemplo" icon="arrow" onPress={submit} /><Text style={[ui.caption, { textAlign: 'center' }]}>Se agrega a esta demostración. El contenido se reinicia al recargar la app.</Text>
  </ScrollView></KeyboardAvoidingView>;
}
