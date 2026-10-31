export function prepareEventDraft({ name, description, date, time, categoryId, tickets }, now = new Date()) {
  if (!name.trim() || name.trim().length > 100 || !description.trim() || description.trim().length > 1500) {
    throw new Error('Completá el nombre (hasta 100 caracteres) y la descripción (hasta 1500).');
  }
  if (!categoryId) throw new Error('Seleccioná una categoría.');
  const day = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
  const hour = /^(\d{2}):(\d{2})$/.exec(time);
  if (!day || !hour || Number(hour[1]) > 23 || Number(hour[2]) > 59) {
    throw new Error('Ingresá fecha DD/MM/AAAA y hora HH:mm válidas.');
  }
  const start = new Date(Number(day[3]), Number(day[2]) - 1, Number(day[1]), Number(hour[1]), Number(hour[2]));
  if (start.getFullYear() !== Number(day[3]) || start.getMonth() !== Number(day[2]) - 1
    || start.getDate() !== Number(day[1]) || start.getHours() !== Number(hour[1]) || start.getMinutes() !== Number(hour[2]) || start <= now) {
    throw new Error('La fecha y hora del evento deben ser válidas y futuras.');
  }
  if (!Array.isArray(tickets) || !tickets.length) throw new Error('Agregá al menos un tipo de entrada.');
  const tiposEntrada = tickets.map((ticket, index) => {
    const nombre = ticket.nombre.trim();
    const descripcion = (ticket.descripcion ?? '').trim();
    if (!nombre || nombre.length > 100 || descripcion.length > 1500) throw new Error(`Completá correctamente el nombre y la descripción del tipo ${index + 1}.`);
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(ticket.precio.trim())) throw new Error(`El precio del tipo ${index + 1} debe ser 0 o más, con hasta dos decimales.`);
    if (!/^\d+$/.test(ticket.cupo.trim())) throw new Error(`El cupo del tipo ${index + 1} debe ser un entero de 0 o más.`);
    const precio = Number(ticket.precio.trim().replace(',', '.'));
    const cupo = Number(ticket.cupo.trim());
    if (!Number.isSafeInteger(cupo) || !Number.isSafeInteger(Math.round(precio * 100))) throw new Error(`El precio o cupo del tipo ${index + 1} supera el máximo permitido.`);
    return { nombre, descripcion, precio, cupo };
  });
  return { nombre: name.trim(), descripcion: description.trim(), categoriaId: categoryId, fecha: start.toISOString(), tiposEntrada };
}

export function createPublicationKey() {
  return `evento-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
