import { createMemoryRepository } from './memory.repository.js';

export function createEventosRepository() {
  const repository = createMemoryRepository();
  return {
    ...repository,
    findByOrganizador: (usuario) => repository.findAll().filter((evento) => evento.organizador === usuario),
    findByCategoria: (categoria) => repository.findAll().filter((evento) => evento.categoria === categoria),
  };
}
