import { Pressable, StyleSheet, Text } from 'react-native';

export default function PrimaryButton({ title, onPress, disabled = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, (disabled || pressed) && styles.dimmed]}
    >
      <Text style={styles.label}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: '#2458d3', padding: 14, borderRadius: 10, alignItems: 'center' },
  dimmed: { opacity: 0.5 },
  label: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
