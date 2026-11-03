// Escenarios exclusivos de pruebas; no se importan desde la aplicación.
const relativeDate = (days, hour = 21) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

export const categories = ['Todos', 'Música', 'Teatro', 'Festivales', 'Conferencias', 'Deportes'];
export const organizers = [
  { id: 'norte', nombre: 'Norte Producciones', initials: 'NP', resenias: [
    { id: 'r1', autor: 'Martina R.', puntuacion: 5, detalle: 'Una noche increíble. Todo muy bien organizado.', evento: 'Noche de vinilos' },
    { id: 'r2', autor: 'Tomás G.', puntuacion: 4, detalle: 'Buen sonido y acceso rápido. Volvería sin dudas.', evento: 'Sesiones del río' },
    { id: 'r3', autor: 'Carla P.', puntuacion: 5, detalle: 'De esos planes que querés repetir.', evento: 'Noche de vinilos' },
  ] },
  { id: 'organizador-1', nombre: 'Organizador 1', initials: 'O1', resenias: [
    { id: 'r4', autor: 'Santiago M.', puntuacion: 5, detalle: 'Una experiencia hermosa de principio a fin.', evento: 'La última función' },
    { id: 'r5', autor: 'Julieta F.', puntuacion: 5, detalle: 'Se nota el cuidado en cada detalle.', evento: 'Escena abierta' },
  ] },
  { id: 'futuro', nombre: 'Comunidad Futuro', initials: 'CF', resenias: [] },
];

export const initialEvents = [
  { id: 'after', nombre: 'After Hours · Live Session', categoria: 'Música', fecha: relativeDate(8), lugar: 'Club del Río · Buenos Aires', organizadorId: 'norte', poster: 'night', etiqueta: 'Una noche para recordar', descripcion: 'Bajá un cambio, subí el volumen. Una selección de artistas en vivo, luces y sonidos para compartir una noche distinta. Vení con tu gente y encontrá tu próximo tema favorito.', tiposEntrada: [
    { id: 'after-general', nombre: 'General', descripcion: 'Acceso al show y a todos los espacios comunes.', precio: 5000, cupo: 46 },
    { id: 'after-platea', nombre: 'Platea', descripcion: 'Un lugar privilegiado para disfrutar del escenario.', precio: 10000, cupo: 18 },
    { id: 'after-vip', nombre: 'VIP', descripcion: 'Sector preferencial y acceso exclusivo.', precio: 15000, cupo: 8 },
  ] },
  { id: 'umbral', nombre: 'El umbral', categoria: 'Teatro', fecha: relativeDate(12, 20), lugar: 'Teatro del Encuentro · Buenos Aires', organizadorId: 'organizador-1', poster: 'theater', etiqueta: 'Historias que te atraviesan', descripcion: 'Una puerta, dos desconocidos y todo lo que todavía no se dijeron. Una obra íntima sobre los encuentros que nos cambian, con una puesta que acerca el escenario a cada espectador.', tiposEntrada: [
    { id: 'umbral-general', nombre: 'General', descripcion: 'Ubicación por orden de llegada.', precio: 8000, cupo: 34 },
    { id: 'umbral-platea', nombre: 'Platea', descripcion: 'Primeras filas del teatro.', precio: 12000, cupo: 12 },
  ] },
  { id: 'primavera', nombre: 'Primavera en el parque', categoria: 'Festivales', fecha: relativeDate(20, 16), lugar: 'Parque de las Artes · Buenos Aires', organizadorId: 'organizador-1', poster: 'festival', etiqueta: 'Música, aire libre y amigos', descripcion: 'Una tarde sin apuro para descubrir bandas, compartir sabores y disfrutar al aire libre. Un festival de encuentros, con artistas de la escena local y muchas ganas de celebrar.', tiposEntrada: [
    { id: 'primavera-general', nombre: 'General', descripcion: 'Acceso al festival y a sus escenarios.', precio: 6500, cupo: 120 },
    { id: 'primavera-vip', nombre: 'Experiencia', descripcion: 'Sector de descanso y escenario preferencial.', precio: 14000, cupo: 25 },
  ] },
  { id: 'futuro', nombre: 'Ideas que conectan', categoria: 'Conferencias', fecha: relativeDate(5, 10), lugar: 'Espacio Abierto · Buenos Aires', organizadorId: 'futuro', poster: 'talk', etiqueta: 'El futuro empieza conversando', descripcion: 'Una jornada de ideas, conversaciones y personas que están haciendo cosas distintas. Charlas breves, preguntas grandes y tiempo para conectar con una comunidad curiosa.', tiposEntrada: [
    { id: 'futuro-general', nombre: 'Pase completo', descripcion: 'Todas las charlas y encuentros de la jornada.', precio: 4000, cupo: 60 },
    { id: 'futuro-plus', nombre: 'Pase + taller', descripcion: 'Jornada completa y un taller a elección.', precio: 7000, cupo: 16 },
  ] },
  { id: 'cancha', nombre: 'La ciudad juega', categoria: 'Deportes', fecha: relativeDate(15, 17), lugar: 'Estadio Central · Buenos Aires', organizadorId: 'norte', poster: 'sport', etiqueta: 'La pasión se comparte', descripcion: 'Una jornada para vivir el deporte desde la tribuna. Equipos locales, buena energía y ese momento en que toda la cancha grita al mismo tiempo.', tiposEntrada: [
    { id: 'cancha-general', nombre: 'Popular', descripcion: 'Acceso a tribuna general.', precio: 3500, cupo: 90 },
    { id: 'cancha-platea', nombre: 'Platea', descripcion: 'Tribuna con ubicación preferencial.', precio: 7500, cupo: 24 },
  ] },
  { id: 'vinilos', nombre: 'Noche de vinilos', categoria: 'Música', fecha: relativeDate(-10), finalizadoDemo: true, lugar: 'Club del Río · Buenos Aires', organizadorId: 'norte', poster: 'vinyl', etiqueta: 'Nos quedan las canciones', descripcion: 'Una edición especial dedicada a los discos que siempre vuelven a sonar. Este evento de ejemplo ya finalizó.', tiposEntrada: [
    { id: 'vinilos-general', nombre: 'General', descripcion: 'Acceso al evento.', precio: 4500, cupo: 0 },
  ] },
];

export const initialPurchases = [
  { id: 'AT-2048', eventoId: 'after', tipoEntradaId: 'after-general', cantidad: 2, total: 10000, estado: 'CONFIRMADA', compradorId: 'comprador-1', comprador: 'Comprador 1' },
  { id: 'AT-2049', eventoId: 'futuro', tipoEntradaId: 'futuro-plus', cantidad: 1, total: 7000, estado: 'PENDIENTE', compradorId: 'comprador-1', comprador: 'Comprador 1' },
  { id: 'AT-1982', eventoId: 'vinilos', tipoEntradaId: 'vinilos-general', cantidad: 3, total: 13500, estado: 'UTILIZADA', compradorId: 'comprador-1', comprador: 'Comprador 1' },
  { id: 'AT-1960', eventoId: 'cancha', tipoEntradaId: 'cancha-general', cantidad: 1, total: 3500, estado: 'CANCELADA', compradorId: 'comprador-1', comprador: 'Comprador 1' },
  { id: 'AT-1941', eventoId: 'vinilos', tipoEntradaId: 'vinilos-general', cantidad: 1, total: 4500, estado: 'REEMBOLSADA', compradorId: 'comprador-1', comprador: 'Comprador 1' },
  { id: 'AT-2050', eventoId: 'after', tipoEntradaId: 'after-platea', cantidad: 1, total: 10000, estado: 'CONFIRMADA', compradorId: 'organizador-1', comprador: 'Organizador 1' },
  { id: 'AT-3001', eventoId: 'umbral', tipoEntradaId: 'umbral-general', cantidad: 2, total: 16000, estado: 'CONFIRMADA', compradorId: 'comprador-1', comprador: 'Comprador 1' },
  { id: 'AT-3002', eventoId: 'umbral', tipoEntradaId: 'umbral-platea', cantidad: 1, total: 12000, estado: 'PENDIENTE', compradorId: 'nicolas', comprador: 'Nicolás Vega' },
  { id: 'AT-3003', eventoId: 'primavera', tipoEntradaId: 'primavera-general', cantidad: 3, total: 19500, estado: 'CONFIRMADA', compradorId: 'valentina', comprador: 'Valentina Díaz' },
];

export const initialFavoritesByUser = {
  'comprador-1': ['after', 'umbral'],
  'organizador-1': ['futuro'],
};

export const initialMessages = {
  'AT-3001': [
    { id: 'shared-m1', usuarioId: 'comprador-1', texto: '¡Hola! ¿Dónde retiro mis entradas para El umbral?', hora: '11:00' },
    { id: 'shared-m2', usuarioId: 'organizador-1', texto: '¡Hola! Podés presentar tu compra en la entrada del teatro.', hora: '11:02' },
  ],
  'AT-2048': [
    { id: 'm1', usuarioId: 'norte', texto: '¡Hola, Comprador 1! Gracias por sumarte. Por acá podés hacernos cualquier consulta.', hora: '10:30' },
    { id: 'm2', usuarioId: 'comprador-1', texto: '¡Hola! ¿Con cuánto tiempo de anticipación recomiendan llegar?', hora: '10:32' },
    { id: 'm3', usuarioId: 'norte', texto: 'Con media hora está perfecto. ¡Te esperamos!', hora: '10:34' },
  ],
};
