import { randomUUID } from 'node:crypto';

// Unidad de trabajo en memoria: se conserva una instancia canónica por identidad.
// Solo los servicios acceden a estas referencias; HTTP recibe DTOs sin ciclos.
export function createMemoryRepository() {
  const entities = new Map();
  return {
    findAll: () => [...entities.values()],
    findById: (id) => entities.get(id),
    save(entity) {
      if (!entity.id) entity.id = randomUUID();
      entities.set(entity.id, entity);
      return entity;
    },
    delete: (id) => entities.delete(id),
  };
}
