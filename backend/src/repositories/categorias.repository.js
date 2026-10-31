import { createMemoryRepository } from './memory.repository.js';

export function createCategoriasRepository() {
  return createMemoryRepository();
}
