import { eventoDto, reseniaDto, tipoEntradaDto } from '../http/presenters.js';

export function createEventosController(service, { now }) {
  return {
    list: (req, res) => res.json(service.list(req.query).map((evento) => eventoDto(evento, now()))),
    get: (req, res) => res.json(eventoDto(service.get(req.params.id), now())),
    create: (req, res) => res.status(201).json(eventoDto(service.create(req.body, req.get('X-Usuario-Id')), now())),
    update: (req, res) => res.json(eventoDto(service.update(req.params.id, req.body, req.get('X-Usuario-Id')), now())),
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
