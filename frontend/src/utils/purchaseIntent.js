export function preparePurchaseIntent(event, tipoEntradaId, cantidad) {
  const ticket = event?.tiposEntrada.find((item) => item.id === tipoEntradaId);
  if (!ticket) throw new Error('Seleccioná un tipo de entrada disponible.');
  if (!Number.isSafeInteger(cantidad) || cantidad < 1) throw new Error('La cantidad debe ser un entero mayor a cero.');
  if (cantidad > ticket.cupo) throw new Error('La cantidad supera las entradas disponibles.');
  if (!Number.isSafeInteger(Math.round(ticket.precio * 100) * cantidad)) throw new Error('El total supera el importe permitido.');
  return { eventoId: event.id, tipoEntradaId, cantidad, precioUnitarioEsperado: ticket.precio };
}

export const purchaseTotal = (precio, cantidad) => Math.round(precio * 100) * cantidad / 100;
