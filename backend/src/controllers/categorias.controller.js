import { categoriaDto } from '../http/presenters.js';

export function createCategoriasController(service) {
  return {
    list: (_req, res) => res.json(service.list().map(categoriaDto)),
    get: (req, res) => res.json(categoriaDto(service.get(req.params.id))),
    create: (req, res) => res.status(201).json(categoriaDto(service.create(req.body))),
    update: (req, res) => res.json(categoriaDto(service.update(req.params.id, req.body))),
    delete(req, res) {
      service.delete(req.params.id);
      res.status(204).end();
    },
  };
}
