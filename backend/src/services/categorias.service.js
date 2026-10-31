import { Categoria } from '../domain/Categoria.js';
import { conflict, fields, required, text } from './validation.js';

export function createCategoriasService({ categorias, eventos }) {
  const get = (id) => required(categorias, id, 'Categoría');
  const values = (data, partial = false) => {
    fields(data, ['nombre', 'descripcion'], partial ? [] : ['nombre']);
    const result = {};
    if (Object.hasOwn(data, 'nombre')) result.nombre = text(data.nombre, 'nombre');
    if (Object.hasOwn(data, 'descripcion')) result.descripcion = text(data.descripcion, 'descripcion', 1500, true);
    return result;
  };
  return {
    list: () => categorias.findAll(),
    get,
    create: (data) => categorias.save(new Categoria({ descripcion: '', ...values(data) })),
    update(id, data) {
      const categoria = get(id);
      Object.assign(categoria, values(data, true));
      return categorias.save(categoria);
    },
    delete(id) {
      const categoria = get(id);
      conflict(eventos.findByCategoria(categoria).length, 'La categoría está siendo utilizada por un evento');
      categorias.delete(id);
    },
  };
}
