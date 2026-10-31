import { createUsuariosRepository } from './usuarios.repository.js';
import { createCategoriasRepository } from './categorias.repository.js';
import { createEventosRepository } from './eventos.repository.js';
import { createComprasRepository } from './compras.repository.js';
import { createReseniasRepository } from './resenias.repository.js';

export function createRepositories() {
  return {
    usuarios: createUsuariosRepository(),
    categorias: createCategoriasRepository(),
    eventos: createEventosRepository(),
    compras: createComprasRepository(),
    resenias: createReseniasRepository(),
  };
}
