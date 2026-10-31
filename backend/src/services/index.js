import { createUsuariosService } from './usuarios.service.js';
import { createCategoriasService } from './categorias.service.js';
import { createEventosService } from './eventos.service.js';
import { createComprasService } from './compras.service.js';
import { createReseniasService } from './resenias.service.js';

export function createServices(repositories, { now = () => new Date() } = {}) {
  const clock = { now };
  return {
    usuarios: createUsuariosService(repositories),
    categorias: createCategoriasService(repositories),
    eventos: createEventosService(repositories, clock),
    compras: createComprasService(repositories, clock),
    resenias: createReseniasService(repositories, clock),
  };
}
