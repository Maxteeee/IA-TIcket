import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#6725D9',
  primaryDark: '#3B117B',
  primaryLight: '#EFE7FC',
  ink: '#211333',
  muted: '#72687F',
  background: '#F8F6FC',
  surface: '#FFFFFF',
  border: '#E9E3F0',
  lime: '#D5F776',
  success: '#197354',
  successLight: '#E5F5ED',
  warning: '#986516',
  warningLight: '#FFF3DC',
  danger: '#AE3F58',
};

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, paddingBottom: 32, gap: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -1 },
  heading: { fontSize: 20, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 },
  label: { fontSize: 14, fontWeight: '700', color: colors.ink },
  text: { fontSize: 15, lineHeight: 23, color: colors.muted },
  caption: { fontSize: 12, lineHeight: 18, color: colors.muted },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.8, color: colors.primary },
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 14 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, fontSize: 15, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.border },
});
