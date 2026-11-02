// Contratos HTTP explícitos: nunca serializar directamente el grafo del dominio.
export const usuarioDto = ({ id, nombre, apellido, roles }) => ({ id, nombre, apellido, roles: [...roles] });
export const categoriaDto = ({ id, nombre, descripcion }) => ({ id, nombre, descripcion });
export const tipoEntradaDto = ({ id, nombre, descripcion, precio, cupo }) => ({ id, nombre, descripcion, precio, cupo });

export function eventoDto(evento, ahora = new Date(), reputacion = { puntaje: null, cantidadResenias: 0 }) {
  return {
    id: evento.id,
    nombre: evento.nombre,
    descripcion: evento.descripcion,
    categoriaId: evento.categoria.id,
    organizadorId: evento.organizador.id,
    categoria: categoriaDto(evento.categoria),
    organizador: { ...usuarioDto(evento.organizador), ...reputacion },
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
    evento: { id: compra.evento.id, nombre: compra.evento.nombre, fecha: compra.evento.fecha.toISOString(), organizadorId: compra.evento.organizador.id },
    tipoEntradaId: compra.tipoEntrada.id,
    tipoEntradaNombre: compra.tipoEntradaNombre,
    precioUnitario: compra.precioUnitario,
    cantidad: compra.cantidad,
    total: compra.total,
    estado: compra.estado,
    diasRestantes: compra.diasRestantes(ahora),
    puedeReseniar: compra.puedeReseniar(compra.comprador, ahora),
    puedeCancelar: compra.puedeCancelar(compra.comprador, ahora),
    reembolso: compra.reembolso ? { importe: compra.reembolso.importe, fecha: compra.reembolso.fecha.toISOString(), simulado: true } : null,
  };
}

export function ventasEventoDto({ evento, compras }, ahora = new Date()) {
  return {
    evento: { id: evento.id, nombre: evento.nombre, fecha: evento.fecha.toISOString(),
      organizadorId: evento.organizador.id, tiposEntrada: evento.tiposEntrada.map(tipoEntradaDto) },
    compras: compras.map((compra) => ({ ...compraDto(compra, ahora),
      comprador: { id: compra.comprador.id, nombre: compra.comprador.nombre, apellido: compra.comprador.apellido } })),
  };
}

export const mensajeDto = ({ id, usuario, mensaje, enviado }, compraId) => ({ id, compraId, usuarioId: usuario.id, mensaje, enviado: enviado.toISOString() });
export const cambioEstadoDto = ({ id, compra, estado, quien, fechaHora }) => ({ id, compraId: compra.id, estado, quienId: quien.id, fechaHora: fechaHora.toISOString() });
export const reseniaDto = ({ id, comprador, evento, compra, detalle, puntuacion }) => ({ id, compradorId: comprador.id, eventoId: evento.id, compraId: compra?.id ?? null, detalle, puntuacion });

export const experienciaAnteriorDto = (resenia) => ({
  ...reseniaDto(resenia),
  comprador: { id: resenia.comprador.id, nombre: resenia.comprador.nombre, apellido: resenia.comprador.apellido },
  evento: { id: resenia.evento.id, nombre: resenia.evento.nombre, organizadorId: resenia.evento.organizador.id,
    fecha: resenia.evento.fecha.toISOString(), fechaFin: resenia.evento.fechaFin.toISOString() },
});
