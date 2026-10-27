export function money(value) {
  return `$${Math.round(value).toLocaleString('es-AR')}`;
}

export function priceRange(event) {
  const prices = event.tiposEntrada.map((ticket) => ticket.precio);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function rating(organizer) {
  const reviews = organizer?.resenias ?? [];
  return reviews.length ? reviews.reduce((total, review) => total + review.puntuacion, 0) / reviews.length : null;
}

export function dateLabel(value, options = {}) {
  return new Date(value).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', ...options }).replace(/\./g, '');
}

export function daysUntil(value, now = new Date()) {
  // Convención visual provisional de la maqueta; no es una regla del backend.
  return Math.max(0, Math.ceil((new Date(value) - now) / 86400000));
}

const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function selectEvents(events, organizers, { search = '', category = 'Todos', sort = 'fecha', favoriteIds = null } = {}) {
  const query = normalize(search.trim());
  const result = events.filter((event) => !event.finalizadoDemo
    && (!favoriteIds || favoriteIds.includes(event.id))
    && (category === 'Todos' || event.categoria === category)
    && (!query || normalize(`${event.nombre} ${event.categoria}`).includes(query)));

  return result.sort((a, b) => {
    if (sort === 'precio') return priceRange(a).min - priceRange(b).min;
    if (sort === 'puntaje') {
      const first = rating(organizers.find((organizer) => organizer.id === a.organizadorId));
      const second = rating(organizers.find((organizer) => organizer.id === b.organizadorId));
      if (first === null && second === null) return new Date(a.fecha) - new Date(b.fecha);
      if (first === null) return 1;
      if (second === null) return -1;
      return second - first || new Date(a.fecha) - new Date(b.fecha);
    }
    return new Date(a.fecha) - new Date(b.fecha);
  });
}

export const statusLabels = {
  CONFIRMADA: 'Confirmada', PENDIENTE: 'Pendiente de pago', UTILIZADA: 'Utilizada', CANCELADA: 'Cancelada', REEMBOLSADA: 'Reembolsada',
};
