import { cambioEstadoDto, compraDto, mensajeDto } from '../http/presenters.js';

export function createComprasController(service, { now }) {
  return {
    list: (req, res) => res.json(service.list(req.get('X-Usuario-Id'), req.query).map((compra) => compraDto(compra, now()))),
    listByEvent: (req, res) => res.json(service.list(req.get('X-Usuario-Id'), { ...req.query, eventoId: req.params.id }).map((compra) => compraDto(compra, now()))),
    get: (req, res) => res.json(compraDto(service.get(req.params.id, req.get('X-Usuario-Id')), now())),
    create: (req, res) => res.status(201).json(compraDto(service.create(req.body, req.get('X-Usuario-Id')), now())),
    updateState: (req, res) => res.json(compraDto(service.updateState(req.params.id, req.body, req.get('X-Usuario-Id')), now())),
    listMessages: (req, res) => res.json(service.listMessages(req.params.id, req.get('X-Usuario-Id')).map(mensajeDto)),
    addMessage: (req, res) => res.status(201).json(mensajeDto(service.addMessage(req.params.id, req.body, req.get('X-Usuario-Id')))),
    listHistory: (req, res) => res.json(service.listHistory(req.params.id, req.get('X-Usuario-Id')).map(cambioEstadoDto)),
  };
}
