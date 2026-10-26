import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrimaryButton from '../components/PrimaryButton';
import { createItem, getItems } from '../services/items.service';

export default function HomeScreen() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function loadItems() {
    setBusy(true);
    setError('');
    try {
      setItems(await getItems());
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { loadItems(); }, []);

  async function addItem() {
    setBusy(true);
    setError('');
    try {
      await createItem(name.trim());
      setName('');
      setItems(await getItems());
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>TP React Native</Text>
      <Text style={styles.description}>Agregá un elemento para probar la conexión con el servidor.</Text>
      <View style={styles.form}>
        <TextInput
          accessibilityLabel="Nombre del elemento"
          placeholder="Nombre del elemento"
          value={name}
          onChangeText={setName}
          maxLength={100}
          editable={!busy}
          style={styles.input}
        />
        <PrimaryButton title="Agregar" onPress={addItem} disabled={busy || !name.trim()} />
        <PrimaryButton title={busy ? 'Cargando…' : 'Actualizar lista'} onPress={loadItems} disabled={busy} />
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Text style={styles.item}>{item.name}</Text>}
        ListEmptyComponent={<Text style={styles.description}>Todavía no hay elementos cargados.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24, backgroundColor: '#f7f8fc', gap: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#172442', marginTop: 20 },
  description: { fontSize: 16, color: '#526079', lineHeight: 24 },
  form: { gap: 12 },
  input: { borderWidth: 1, borderColor: '#c4ccdc', borderRadius: 10, padding: 14, backgroundColor: '#fff', fontSize: 16 },
  item: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#dce1eb', fontSize: 16, color: '#172442' },
  error: { color: '#a51d2d', fontSize: 15 },
});
