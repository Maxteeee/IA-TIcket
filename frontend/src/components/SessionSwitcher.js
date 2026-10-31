import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMockSession } from '../session/MockSessionProvider';
import { canOrganize } from '../session/permissions';
import { colors } from '../theme';

export default function SessionSwitcher({ onSwitch }) {
  const { session, nextSession } = useMockSession();
  return <View style={styles.bar}>
    <View style={styles.identity}>
      <View style={styles.avatar}><Text style={styles.initials}>{session.usuario.initials}</Text></View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text numberOfLines={1} style={styles.name}>{session.usuario.nombre}</Text>
        <Text style={styles.role}>{canOrganize(session) ? 'Organiza y compra · Demo' : 'Comprador · Demo'}</Text>
      </View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Cambiar a ${nextSession.usuario.nombre}`} onPress={onSwitch}
      style={({ pressed }) => [styles.switch, pressed && { opacity: 0.65 }]}>
      <Text style={styles.switchHint}>Cambiar a</Text>
      <Text style={styles.switchName}>{nextSession.usuario.nombre} ⇄</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  name: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  role: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  switch: { minHeight: 46, justifyContent: 'center', gap: 3, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.primaryLight },
  switchHint: { color: colors.primary, fontSize: 10 },
  switchName: { color: colors.primary, fontSize: 12, fontWeight: '800' },
});
