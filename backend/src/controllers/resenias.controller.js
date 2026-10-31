import { reseniaDto } from '../http/presenters.js';

export function createReseniasController(service) {
  return {
    list: (req, res) => res.json(service.list(req.query).map(reseniaDto)),
    get: (req, res) => res.json(reseniaDto(service.get(req.params.id))),
    create: (req, res) => res.status(201).json(reseniaDto(service.create(req.body, req.get('X-Usuario-Id')))),
    update: (req, res) => res.json(reseniaDto(service.update(req.params.id, req.body, req.get('X-Usuario-Id')))),
    delete(req, res) {
      service.delete(req.params.id, req.get('X-Usuario-Id'));
      res.status(204).end();
    },
  };
}
