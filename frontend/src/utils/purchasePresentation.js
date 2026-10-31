export function remainingDaysLabel(purchase) {
  if (purchase.estado !== 'CONFIRMADA') return null;
  return `${purchase.diasRestantes} ${purchase.diasRestantes === 1 ? 'día restante' : 'días restantes'}`;
}
