import { createMemoryRepository } from './memory.repository.js';

export function createReseniasRepository() {
  const repository = createMemoryRepository();
  return {
    ...repository,
    findByEvento: (evento) => repository.findAll().filter((resenia) => resenia.evento === evento),
    findByComprador: (usuario) => repository.findAll().filter((resenia) => resenia.comprador === usuario),
    findByOrganizador: (usuario) => usuario.obtenerReseniasRecibidas(repository.findAll()),
  };
}
