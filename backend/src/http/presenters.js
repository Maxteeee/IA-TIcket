// Contratos HTTP explícitos: nunca serializar directamente el grafo del dominio.
export const usuarioDto = ({ id, nombre, apellido }) => ({ id, nombre, apellido });
export const categoriaDto = ({ id, nombre, descripcion }) => ({ id, nombre, descripcion });
export const tipoEntradaDto = ({ id, nombre, descripcion, precio, cupo }) => ({ id, nombre, descripcion, precio, cupo });

export function eventoDto(evento, ahora = new Date()) {
  return {
    id: evento.id,
    nombre: evento.nombre,
    descripcion: evento.descripcion,
    categoriaId: evento.categoria.id,
    organizadorId: evento.organizador.id,
    categoria: categoriaDto(evento.categoria),
    organizador: usuarioDto(evento.organizador),
    fecha: evento.fecha.toISOString(),
    fechaFin: evento.fechaFin?.toISOString() ?? null,
    finalizado: evento.haFinalizado(ahora),
    multimedia: [...evento.multimedia],
    tiposEntrada: evento.tiposEntrada.map(tipoEntradaDto),
    rangoPrecios: evento.rangoPrecios(),
  };
}

export function compraDto(compra, ahora = new Date()) {
  return {
    id: compra.id,
    compradorId: compra.comprador.id,
    eventoId: compra.evento.id,
    tipoEntradaId: compra.tipoEntrada.id,
    cantidad: compra.cantidad,
    total: compra.total,
    estado: compra.estado,
    diasRestantes: compra.diasRestantes(ahora),
  };
}

export const mensajeDto = ({ id, usuario, mensaje, enviado }) => ({ id, usuarioId: usuario.id, mensaje, enviado: enviado.toISOString() });
export const cambioEstadoDto = ({ id, compra, estado, quien, fechaHora }) => ({ id, compraId: compra.id, estado, quienId: quien.id, fechaHora: fechaHora.toISOString() });
export const reseniaDto = ({ id, comprador, evento, compra, detalle, puntuacion }) => ({ id, compradorId: comprador.id, eventoId: evento.id, compraId: compra?.id ?? null, detalle, puntuacion });
