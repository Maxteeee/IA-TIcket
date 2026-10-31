import { eventoDto, reseniaDto, usuarioDto } from '../http/presenters.js';

export function createUsuariosController(service, { now }) {
  return {
    list: (_req, res) => res.json(service.list().map(usuarioDto)),
    get: (req, res) => res.json(usuarioDto(service.get(req.params.id))),
    create: (req, res) => res.status(201).json(usuarioDto(service.create(req.body))),
    update: (req, res) => res.json(usuarioDto(service.update(req.params.id, req.body, req.get('X-Usuario-Id')))),
    delete(req, res) {
      service.delete(req.params.id, req.get('X-Usuario-Id'));
      res.status(204).end();
    },
    listFavorites: (req, res) => res.json(service.listFavorites(req.params.id, req.get('X-Usuario-Id')).map((evento) => eventoDto(evento, now()))),
    addFavorite: (req, res) => res.json(service.addFavorite(req.params.id, req.params.eventoId, req.get('X-Usuario-Id')).map((evento) => eventoDto(evento, now()))),
    removeFavorite(req, res) {
      service.removeFavorite(req.params.id, req.params.eventoId, req.get('X-Usuario-Id'));
      res.status(204).end();
    },
    listReviews: (req, res) => res.json(service.listReviews(req.params.id).map(reseniaDto)),
    reputation: (req, res) => res.json(service.reputation(req.params.id)),
  };
}
