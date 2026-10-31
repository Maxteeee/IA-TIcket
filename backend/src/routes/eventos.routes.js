import { Router } from 'express';

export function createEventosRouter(controller, comprasController) {
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.get);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.delete);
  router.get('/:id/tipos-entrada', controller.listTickets);
  router.post('/:id/tipos-entrada', controller.addTicket);
  router.get('/:id/tipos-entrada/:tipoEntradaId', controller.getTicket);
  router.patch('/:id/tipos-entrada/:tipoEntradaId', controller.updateTicket);
  router.delete('/:id/tipos-entrada/:tipoEntradaId', controller.deleteTicket);
  router.get('/:id/compras', comprasController.listByEvent);
  router.get('/:id/resenias', controller.listReviews);
  router.get('/:id/experiencias-anteriores', controller.previousReviews);
  return router;
}
