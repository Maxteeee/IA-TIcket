import { eventoDto, reseniaDto, tipoEntradaDto } from '../http/presenters.js';

export function createEventosController(service, { now }) {
  const present = (evento) => eventoDto(evento, now(), service.getReputation(evento));
  return {
    list: (req, res) => res.json(service.list(req.query).map(present)),
    get: (req, res) => res.json(present(service.get(req.params.id))),
    create: (req, res) => res.status(201).json(present(service.create(req.body, req.get('X-Usuario-Id')))),
    update: (req, res) => res.json(present(service.update(req.params.id, req.body, req.get('X-Usuario-Id')))),
    delete(req, res) {
      service.delete(req.params.id, req.get('X-Usuario-Id'));
      res.status(204).end();
    },
    listTickets: (req, res) => res.json(service.listTickets(req.params.id).map(tipoEntradaDto)),
    getTicket: (req, res) => res.json(tipoEntradaDto(service.getTicket(req.params.id, req.params.tipoEntradaId))),
    addTicket: (req, res) => res.status(201).json(tipoEntradaDto(service.addTicket(req.params.id, req.body, req.get('X-Usuario-Id')))),
    updateTicket: (req, res) => res.json(tipoEntradaDto(service.updateTicket(req.params.id, req.params.tipoEntradaId, req.body, req.get('X-Usuario-Id')))),
    deleteTicket(req, res) {
      service.deleteTicket(req.params.id, req.params.tipoEntradaId, req.get('X-Usuario-Id'));
      res.status(204).end();
    },
    listReviews: (req, res) => res.json(service.listReviews(req.params.id).map(reseniaDto)),
    previousReviews: (req, res) => res.json(service.previousReviews(req.params.id).map(reseniaDto)),
  };
}
