import { Categoria } from '../domain/Categoria.js';
import { Usuario } from '../domain/Usuario.js';
import { Evento } from '../domain/Evento.js';
import { TipoEntrada } from '../domain/TipoEntrada.js';
import { Compra } from '../domain/Compra.js';
import { EstadoCompra } from '../domain/EstadoCompra.js';
import { Resenia } from '../domain/Resenia.js';

// Solo se carga al iniciar el servidor con --demo o SEED_DEMO=true.
// IDs estables y sin sobrescritura: volver a invocarlo conserva datos existentes.
export function seedDemoData(repositories, { now = () => new Date() } = {}) {
  const saveIfMissing = (repository, entity) => repository.findById(entity.id) ?? repository.save(entity);
  const organizador = saveIfMissing(repositories.usuarios, new Usuario({
    id: 'demo-organizador', nombre: 'Equipo', apellido: 'Encuentro',
  }));
  const escena = saveIfMissing(repositories.usuarios, new Usuario({
    id: 'demo-organizador-escena', nombre: 'Compañía', apellido: 'Umbral',
  }));
  const comunidad = saveIfMissing(repositories.usuarios, new Usuario({
    id: 'demo-organizador-comunidad', nombre: 'Red', apellido: 'Abierta',
  }));
  const asistente = saveIfMissing(repositories.usuarios, new Usuario({
    id: 'demo-asistente', nombre: 'Asistente', apellido: 'Demo',
  }));
  const categories = ['Música', 'Teatro', 'Festivales', 'Conferencias', 'Deportes'].map((nombre, index) =>
    saveIfMissing(repositories.categorias, new Categoria({ id: `demo-categoria-${index + 1}`, nombre, descripcion: nombre })));
  const dateInDays = (days) => {
    const date = new Date(now());
    date.setUTCDate(date.getUTCDate() + days);
    date.setUTCHours(21, 0, 0, 0);
    return date;
  };
  const examples = [
    { id: 'demo-concierto', nombre: 'Concierto del río', descripcion: 'Música en vivo, guitarras y canciones para compartir.', categoria: 0, days: 8, precio: 5000 },
    { id: 'demo-teatro', nombre: 'El umbral', descripcion: 'Una obra de teatro sobre encuentros que nos cambian.', categoria: 1, days: 12, precio: 8000, organizador: escena },
    { id: 'demo-festival', nombre: 'Primavera en el parque', descripcion: 'Bandas locales y sabores al aire libre.', categoria: 2, days: 20, precio: 6500 },
    { id: 'demo-conferencia', nombre: 'Ideas que conectan', descripcion: 'Charlas sobre tecnología y creatividad.', categoria: 3, days: 5, precio: 4000, organizador: comunidad },
    { id: 'demo-deporte', nombre: 'La ciudad juega', descripcion: 'Una jornada deportiva para vivir desde la tribuna.', categoria: 4, days: 15, precio: 3500, organizador: comunidad },
    { id: 'demo-pasado', nombre: 'Noche de vinilos', descripcion: 'Una edición anterior de música en vivo.', categoria: 0, days: -10, precio: 4500 },
    { id: 'demo-pasado-teatro', nombre: 'La primera función', descripcion: 'Una función anterior de la compañía.', categoria: 1, days: -20, precio: 6000, organizador: escena },
  ];
  for (const example of examples) {
    const fecha = dateInDays(example.days);
    saveIfMissing(repositories.eventos, new Evento({
      id: example.id, nombre: example.nombre, descripcion: example.descripcion,
      categoria: categories[example.categoria], organizador: example.organizador ?? organizador, fecha,
      fechaFin: new Date(fecha.getTime() + 2 * 3600000),
      tiposEntrada: [
        new TipoEntrada({ id: `${example.id}-general`, nombre: 'General', descripcion: 'Acceso general', precio: example.precio, cupo: 50 }),
        new TipoEntrada({ id: `${example.id}-preferencial`, nombre: 'Preferencial', descripcion: 'Ubicación preferencial', precio: example.precio * 2, cupo: 15 }),
      ],
    }));
  }
  // Historial de demostración: compras ya utilizadas de eventos finalizados.
  // No ejecuta pagos ni anticipa la integración de C9; permite comparar 4,5 / 0 / sin reseñas.
  for (const [id, eventId, puntuacion] of [
    ['demo-resenia-1', 'demo-pasado', 4],
    ['demo-resenia-2', 'demo-pasado', 5],
    ['demo-resenia-3', 'demo-pasado-teatro', 0],
  ]) {
    const evento = repositories.eventos.findById(eventId);
    const tipoEntrada = evento.tiposEntrada[0];
    const compra = saveIfMissing(repositories.compras, new Compra({
      id: `${id}-compra`, comprador: asistente, evento, tipoEntrada,
      cantidad: 1, total: tipoEntrada.precio, estado: EstadoCompra.UTILIZADA,
    }));
    saveIfMissing(repositories.resenias, new Resenia({
      id, comprador: asistente, evento, compra, puntuacion, detalle: 'Experiencia de demostración',
    }));
  }
  return repositories;
}
