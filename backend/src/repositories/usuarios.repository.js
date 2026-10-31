import { createMemoryRepository } from './memory.repository.js';

export function createUsuariosRepository() {
  return createMemoryRepository();
}
