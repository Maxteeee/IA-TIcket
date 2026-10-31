import { createMemoryRepository } from './memory.repository.js';

export function createComprasRepository() {
  const repository = createMemoryRepository();
  return {
    ...repository,
    findByComprador: (usuario) => repository.findAll().filter((compra) => compra.comprador === usuario),
    findByEvento: (evento) => repository.findAll().filter((compra) => compra.evento === evento),
  };
}
