import { randomUUID } from 'node:crypto';

// Los datos viven únicamente durante la ejecución del servidor.
export function createItemsRepository() {
  const items = [];

  return {
    findAll() {
      return items.map((item) => ({ ...item }));
    },
    create(name) {
      const item = { id: randomUUID(), name };
      items.push(item);
      return { ...item };
    },
  };
}

export const itemsRepository = createItemsRepository();
