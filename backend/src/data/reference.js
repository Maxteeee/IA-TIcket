import { Categoria } from '../domain/Categoria.js';
import { Usuario } from '../domain/Usuario.js';
import { RolUsuario } from '../domain/RolUsuario.js';

export function seedCategories(repositories) {
  return ['Música', 'Teatro', 'Festivales', 'Conferencias', 'Deportes'].map((nombre, index) => {
    const id = `demo-categoria-${index + 1}`;
    return repositories.categorias.findById(id)
      ?? repositories.categorias.save(new Categoria({ id, nombre, descripcion: nombre }));
  });
}

// Identidades para el entorno local sin autenticación. No modifica usuarios existentes.
export function seedReferenceData(repositories) {
  seedCategories(repositories);
  for (const [id, nombre, roles] of [
    ['comprador-1', 'Comprador', [RolUsuario.COMPRADOR]],
    ['organizador-1', 'Organizador', [RolUsuario.COMPRADOR, RolUsuario.ORGANIZADOR]],
  ]) {
    if (!repositories.usuarios.findById(id)) {
      repositories.usuarios.save(new Usuario({ id, nombre, apellido: '1', roles }));
    }
  }
  return repositories;
}
