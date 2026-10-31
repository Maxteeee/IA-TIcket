import { Text, View } from 'react-native';
import { Icon } from './MockUI';
import { colors } from '../theme';
import { remainingDaysLabel } from '../utils/purchasePresentation';

export default function PurchaseCountdown({ purchase }) {
  const label = remainingDaysLabel(purchase);
  if (label === null) return null;
  return <View style={{ backgroundColor: colors.primaryLight, borderRadius: 9, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
    <Icon name="ticket" color={colors.primary} size={18} />
    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>{label}</Text>
  </View>;
}
